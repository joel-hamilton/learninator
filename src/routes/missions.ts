import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import type { AppVariables } from "../types.js";
import type { AiMessageParam, AiTool, AiToolUseBlock } from "../ai/types.js";
import { saveMessage, contentToText, loadMessages } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { missionLayout } from "../views/mission.js";
import { guidedOnboardingLayout, guidedQuestionSection, guidedThinkingSection, onboardingLayout, newMissionPage } from "../views/onboarding.js";
import { chatMessageBubble, generationProgressPanel, emptyLessonsMessage, emptyReferencesMessage, emptyRecordsMessage, lessonCard, referenceDocCard, learningRecordCard } from "../views/fragments.js";
import { validateChatMessage, validateTitle, validateTopic, validateGuidedAnswer, rateLimitedFragment } from "../security/index.js";
import type { MissionStore } from "../db/store.js";
import { renderOobSections } from "./home.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const missionRoutes = new Hono<{ Variables: AppVariables }>();

// ── Rename mission ──
missionRoutes.put("/:missionId/title", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const newTitle = String(body.title || "").trim();
  if (!newTitle) return c.text("Title required", 400);
  const titleErr = validateTitle(newTitle);
  if (titleErr) return c.html(titleErr);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  await store.updateMissionTitle(missionId, newTitle);

  return c.html(`<span class="header-title" id="mission-title-display" style="cursor:pointer" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();">${newTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`);
});

// ── Guided onboarding helpers ───────────────────────────────────────

function getOnboardingPrompt(missionId: number, mode: string): string {
  const modeInstructions = mode === "guided"
    ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active. Do NOT create lessons during onboarding — wait until the mission is active.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
    : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active.`;

  return TEACHER_SYSTEM_PROMPT + modeInstructions;
}

async function generateMissionTitle(c: Ctx, missionId: number): Promise<string | null> {
  const store = c.get("store");
  const messages = await loadMessages(store, missionId);
  if (messages.length === 0) return null;

  const conversationText = messages.map((m) => {
    const text = typeof m.content === "string" ? contentToText(m.content) : m.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return `${m.role}: ${text}`;
  }).join("\n\n");

  const ai = c.get("ai");
  const title = await ai.chat(
    "Generate a short, descriptive title (max 8 words) for a learning mission based on this conversation. Return ONLY the title, no quotes, no punctuation at the end. Make it specific and concrete.",
    [{ role: "user", content: `Here is the conversation:\n\n${conversationText.slice(-3000)}` }],
    { model: "low", maxTokens: 50, disableThinking: true }
  );

  const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 120);
  if (!cleanTitle) return null;

  await store.updateMissionTitle(missionId, cleanTitle);

  return cleanTitle;
}

interface RunConversationResult {
  didActivate: boolean;
  pausedToolUse?: AiToolUseBlock;
  text: string;
}

async function runConversationLoop(
  c: Ctx,
  missionId: number,
  systemPrompt: string,
  messages: AiMessageParam[],
  tools: AiTool[],
  opts?: { pauseOnTools?: Set<string>; workflowType?: "chat" | "lesson_generation" | "mission_activation"; workflowLabel?: string },
): Promise<RunConversationResult> {
  const log = c.get("logger");
  const store = c.get("store");
  const events = c.get("events");
  const wfState = c.get("workflowState");
  const user = c.get("user")!;
  let didActivate = false;

  const wfType = opts?.workflowType ?? "chat";
  const wfLabel = opts?.workflowLabel ?? `Chat`;
  const workflowId = wfState.startWorkflow(user.id, wfType, wfLabel, missionId, `/missions/${missionId}/chat`);

  const standardHooks = createStandardHooks({ missionId, store, emit: events.emit.bind(events), logger: log });

  try {
    const result = await conversationLoop({
      client: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      missionId,
      systemPrompt,
      initialMessages: messages,
      tools,
      logger: log,
      pauseOnTools: opts?.pauseOnTools,
      hooks: {
        ...standardHooks,
        onBeforeToolExecution: async (toolUseBlocks) => {
          await standardHooks.onBeforeToolExecution!(toolUseBlocks);
          if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
            didActivate = true;
          }
          // Emit workflow step for site-wide indicator
          for (const block of toolUseBlocks) {
            wfState.stepUpdate(workflowId, block.name);
          }
        },
      },
    });

    wfState.completeWorkflow(workflowId);
    return { didActivate, pausedToolUse: result.pausedToolUse, text: result.text };
  } catch (err: unknown) {
    const msg = err instanceof AIError ? err.message : "Something went wrong.";
    wfState.failWorkflow(workflowId, msg);
    throw err;
  }
}


// ── New mission page (GET) ──
missionRoutes.get("/new", auth.requireAuth, (c: Ctx) => {
  return c.html(newMissionPage());
});

// ── Create mission from first chat message (POST /missions) ──
missionRoutes.post("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const mode = (String(body.mode || "") === "chat" ? "chat" : "guided") as "guided" | "chat";

  if (!message) {
    return c.html(`<div class="msg assistant">I didn't catch that — could you tell me what you'd like to learn?</div>`);
  }
  const topicErr = validateTopic(message);
  if (topicErr) return c.html(topicErr);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "mission_create", 5, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const title = message.length > 80 ? message.slice(0, 80) + "…" : message;
  const mission = await store.createMission({ userId: user.id, title, slug, onboardingMode: mode });
  const missionId = mission.id;

  const systemPrompt = getOnboardingPrompt(missionId, mode);

  try {
    const messages: AiMessageParam[] = [
      { role: "user", content: message },
    ];

    await saveMessage(store, missionId, "user", message);

    const opts = {
      workflowType: "mission_activation" as const,
      workflowLabel: `Setting up: ${title}`,
      ...(mode === "guided" ? { pauseOnTools: new Set(["ask_guided_question"]) } : {}),
    };
    const result = await runConversationLoop(c, missionId, systemPrompt, messages, TEACHER_TOOLS, opts);

    if (result.didActivate) {
      await generateMissionTitle(c, missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }
  } catch (err: unknown) {
    // Mission and user message are saved; redirect to the onboarding page even on AI error.
  }

  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
});

// ── Create mission from dashboard topic (POST /missions/new) ──
missionRoutes.post("/new", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const body = await c.req.parseBody();
  const topic = String(body.topic || "").trim();
  if (!topic) return c.redirect("/missions/new");
  const topicErr = validateTopic(topic);
  if (topicErr) return c.html(topicErr);

  const rateLimiter2 = c.get("rateLimiter");
  if (rateLimiter2 && !rateLimiter2.check(user.id, "mission_create", 5, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mode = (String(body.mode || "") === "chat" ? "chat" : "guided") as "guided" | "chat";
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const mission = await store.createMission({ userId: user.id, title: topic, slug, onboardingMode: mode });

  return c.redirect(`/missions/${mission.id}`);
});

// ── View mission ──
missionRoutes.get("/:missionId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);

  // ── Onboarding: show appropriate page based on mode ──
  if (mission.status === "onboarding") {
    const chatRows = await store.getChatMessages(id);
    const pendingQuestion = await store.getPendingQuestion(id);

    let messagesHtml = "";
    if (chatRows.length === 0) {
      messagesHtml = `<div class="msg assistant">Hi! I'm your teacher. I'll help you define your learning goals for <strong>${mission.title}</strong>.</div>`;
    } else {
      for (const row of chatRows) {
        const text = contentToText(row.content);
        if (!text.trim()) continue;
        if (row.role === "user") {
          messagesHtml += chatMessageBubble("user", formatMarkdown(text));
        } else {
          messagesHtml += chatMessageBubble("assistant", formatMarkdown(text));
        }
      }
    }

    const currentMode = (mission as Record<string, unknown>).onboardingMode as string || "guided";

    // Guided mode: show question card if there's a pending question, otherwise trigger a turn
    if (currentMode === "guided") {
      if (pendingQuestion) {
        const options: string[] = JSON.parse(pendingQuestion.options as string);
        return c.html(guidedOnboardingLayout(user, mission, messagesHtml, pendingQuestion.id, pendingQuestion.question as string, options, false));
      }
      // No messages yet — trigger initial guided turn
      if (chatRows.length === 0) {
        return c.html(guidedOnboardingLayout(user, mission, messagesHtml, null, null, [], true));
      }
      // Has messages but no pending question — trigger a guided turn to get next question
      return c.html(guidedOnboardingLayout(user, mission, messagesHtml, null, null, [], true));
    }

    // Chat mode: show chat interface
    return c.html(onboardingLayout(user, mission, messagesHtml));
  }

  // ── Active / archived: show tabbed layout ──
  const lessonRows = await store.listLessonSummaries(id);

  if (lessonRows.length === 0) {
    return c.html(missionLayout(user, mission, `${generationProgressPanel()}${emptyLessonsMessage(id)}`, "lessons"));
  }

  const parentNums = new Set<number>();
  const lastSubs = new Set<string>();
  const maxSubByNum = new Map<number, number>();
  for (const l of lessonRows) {
    if (l.subNumber !== null) {
      parentNums.add(l.number);
      const curr = maxSubByNum.get(l.number) ?? 0;
      if (l.subNumber > curr) maxSubByNum.set(l.number, l.subNumber);
    }
  }
  for (const l of lessonRows) {
    if (l.subNumber !== null && l.subNumber === maxSubByNum.get(l.number)) {
      lastSubs.add(`${l.number}:${l.subNumber}`);
    }
  }

  const lessonCards = lessonRows.map((l) => lessonCard(id, l, {
    hasSubLessons: l.subNumber === null && parentNums.has(l.number),
    isLastSub: l.subNumber !== null && lastSubs.has(`${l.number}:${l.subNumber}`),
  })).join("");

  return c.html(missionLayout(user, mission, `
    ${generationProgressPanel()}
    <div class="section-header">
      <h2>Lessons</h2>
    </div>
    <div class="lesson-list stagger">${lessonCards}</div>
  `, "lessons"));
});

// ── Guided onboarding: start/continue conversation ──
missionRoutes.post("/:missionId/guided/start", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const systemPrompt = getOnboardingPrompt(missionId, "guided");
  const messages = await loadMessages(store, missionId);

  try {
    const result = await runConversationLoop(
      c, missionId, systemPrompt, messages, TEACHER_TOOLS,
      { pauseOnTools: new Set(["ask_guided_question"]), workflowType: "mission_activation", workflowLabel: `Setting up mission` },
    );

    if (result.didActivate) {
      await generateMissionTitle(c, missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }

    // Check for paused question
    if (result.pausedToolUse) {
      const pq = await store.getPendingQuestion(missionId);
      if (pq) {
        const options: string[] = JSON.parse(pq.options as string);
        return c.html(guidedQuestionSection(missionId, pq.id, pq.question as string, options));
      }
    }

    // No question generated — AI must have sent text. Trigger again.
    return c.html(guidedThinkingSection(missionId));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? err.message
      : "Something went wrong. Please try again.";
    return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${msg}</p></div></div>`);
  }
});

// ── Guided onboarding: answer a question ──
missionRoutes.post("/:missionId/guided/answer", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const questionId = parseInt(String(body.question_id || ""));
  const selectedAnswer = String(body.answer || "").trim();
  const otherText = String(body.other_text || "").trim();

  const answerErr = validateGuidedAnswer(selectedAnswer, otherText);
  if (answerErr) return c.html(answerErr);

  const mission = await store.getMission(missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  // Mark the question as answered
  const finalAnswer = otherText || selectedAnswer;
  if (questionId && finalAnswer) {
    await store.answerQuestion(questionId, selectedAnswer, otherText || null);
  }

  // Feed answer into conversation — get question text from pending before we answered
  // (it's already answered now, but we have the qText from the form submission flow)
  const userMessage = `Question: (answered)\nAnswer: ${finalAnswer}`;
  await saveMessage(store, missionId, "user", userMessage);

  const systemPrompt = getOnboardingPrompt(missionId, "guided");
  const messages = await loadMessages(store, missionId);

  try {
    const result = await runConversationLoop(
      c, missionId, systemPrompt, messages, TEACHER_TOOLS,
      { pauseOnTools: new Set(["ask_guided_question"]), workflowType: "mission_activation", workflowLabel: `Setting up mission` },
    );

    if (result.didActivate) {
      await generateMissionTitle(c, missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }

    if (result.pausedToolUse) {
      const pq = await store.getPendingQuestion(missionId);
      if (pq) {
        const options: string[] = JSON.parse(pq.options as string);
        return c.html(guidedQuestionSection(missionId, pq.id, pq.question as string, options));
      }
    }

    // Fallback: trigger another turn
    return c.html(guidedThinkingSection(missionId));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? err.message
      : "Something went wrong. Please try again.";
    return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${msg}</p></div></div>`);
  }
});

// ── Guided onboarding: skip remaining questions ──
missionRoutes.post("/:missionId/guided/skip", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  // Mark any pending questions as answered
  await store.skipPendingQuestions(missionId);

  const systemPrompt = getOnboardingPrompt(missionId, "guided") + `\n\nThe user has requested that you stop asking questions and proceed immediately. Use your best judgment for all remaining decisions. Write MISSION.md and NOTES.md if you haven't already, call mark_mission_active, and create the first lesson. Do NOT ask any more questions or prompt the user for input.`;

  // Remove ask_guided_question so the AI can't use it
  const skipTools = TEACHER_TOOLS.filter((t) => t.name !== "ask_guided_question");

  const messages = await loadMessages(store, missionId);
  const skipMessage = "[I've answered enough questions. Please use your best judgment for the rest and create the mission and first lesson.]";
  await saveMessage(store, missionId, "user", skipMessage);
  const allMessages = await loadMessages(store, missionId);

  try {
    const result = await runConversationLoop(c, missionId, systemPrompt, allMessages, skipTools, {
      workflowType: "mission_activation",
      workflowLabel: `Setting up mission`,
    });

    if (result.didActivate) {
      await generateMissionTitle(c, missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }
  } catch (err: unknown) {
    // Continue to redirect even on error — mission exists
  }

  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
});

// ── Toggle onboarding mode ──
missionRoutes.post("/:missionId/mode", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const newMode = String(body.mode || "guided") as "guided" | "chat";

  const mission = await store.getMission(missionId, user.id);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  // When switching from guided to chat, inject any pending question as a message
  if (mission.onboardingMode === "guided" && newMode === "chat") {
    const pendingQuestions = await store.getChatMessages(missionId);
    // Actually need to get pending questions — use store.getPendingQuestion loop
    let pq = await store.getPendingQuestion(missionId);
    while (pq) {
      const options: string[] = JSON.parse(pq.options as string);
      const optionsText = options.map((o: string) => `- ${o}`).join("\n");
      const questionMsg = `**${pq.question}**\n\n${optionsText}`;
      await saveMessage(store, missionId, "assistant", questionMsg);
      await store.answerQuestion(pq.id, "(switched to chat)");
      pq = await store.getPendingQuestion(missionId);
    }
  }

  await store.updateMissionOnboardingMode(missionId, newMode);

  // Re-render the page by redirecting to the same URL
  return c.redirect(`/missions/${missionId}`);
});

// ── Reference docs ──
missionRoutes.get("/:missionId/reference", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);

  const refs = await store.listReferenceDocs(id);

  if (refs.length === 0) {
    return c.html(missionLayout(user, mission, emptyReferencesMessage(), "reference", `/missions/${id}`, "Mission"));
  }

  const cards = refs.map((r) => referenceDocCard(id, r)).join("");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Reference Documents</h2>
    </div>
    <div class="ref-list stagger">${cards}</div>
  `, "reference", `/missions/${id}`, "Mission"));
});

// ── View single reference doc ──
missionRoutes.get("/:missionId/reference/:refId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const refId = parseInt(c.req.param("refId")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const ref = await store.getReferenceDoc(refId, missionId);
  if (!ref) return c.text("Not found", 404);

  const safeHtml = ref.htmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/<\/body>/i, `<script>function r(){const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);parent.postMessage({type:'lessonResize',height:h},'*');}new ResizeObserver(r).observe(document.body);r();<\/script></body>`);
  return c.html(missionLayout(user, mission, `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h2 style="font-size:1.15rem;font-weight:600;">${ref.title}</h2>
      <span class="badge badge-default">${ref.docType}</span>
    </div>
    <div class="ref-iframe-container" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
      <iframe id="ref-frame" scrolling="no" srcdoc="${safeHtml}" style="width:100%;border:none;display:block;min-height:400px;"></iframe>
    </div>
    <script>
    const refFrame = document.getElementById('ref-frame');
    window.addEventListener('message', function(e) {
      if (e.data?.type === 'lessonResize' && e.data.height) {
        refFrame.style.height = e.data.height + 'px';
        refFrame.style.minHeight = '0';
      }
    });
    </script>
  `, "reference", `/missions/${missionId}/reference`, "Reference"));
});

// ── Learning records ──
missionRoutes.get("/:missionId/records", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);

  const records = await store.listLearningRecords(id);

  if (records.length === 0) {
    return c.html(missionLayout(user, mission, emptyRecordsMessage(), "records", `/missions/${id}`, "Mission"));
  }

  const cards = records.map((r) => learningRecordCard({
    number: r.number,
    title: r.title,
    markdownContent: formatMarkdown(r.markdownContent),
    status: r.status,
    supersededBy: r.supersededBy,
  })).join("");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Learning Records</h2>
    </div>
    <div class="record-list stagger">${cards}</div>
  `, "records", `/missions/${id}`, "Mission"));
});

// ── Resources ──
missionRoutes.get("/:missionId/resources", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);

  const resources = await store.getMissionContent(id, "resources");

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Resources</h2>
    </div>
    <div class="resource-markdown markdown-body">${formatMarkdown(resources?.markdownContent || "No resources curated yet.")}</div>
  `, "resources", `/missions/${id}`, "Mission"));
});

// ── Archive ──
missionRoutes.post("/:missionId/archive", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);
  if (mission.status === "archived") return c.text("Already archived", 400);

  await store.updateMissionStatus(id, "archived");
  return c.html(await renderOobSections(store, user.id));
});

// ── Restore ──
missionRoutes.post("/:missionId/restore", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);
  if (mission.status !== "archived") return c.text("Not archived", 400);

  await store.updateMissionStatus(id, "active");
  return c.html(await renderOobSections(store, user.id));
});

// ── Delete (archived only) ──
missionRoutes.post("/:missionId/delete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);
  if (mission.status !== "archived") return c.text("Must be archived first", 400);

  await store.deleteMission(id);
  return c.html(await renderOobSections(store, user.id));
});

// ── Chat page (for active missions) ──
missionRoutes.get("/:missionId/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await store.getMission(id, user.id);
  if (!mission) return c.text("Not found", 404);

  const chatRows = await store.getChatMessages(id);

  let messagesHtml = "";
  if (chatRows.length === 0) {
    messagesHtml = chatMessageBubble("assistant", `Hi! I'm your teacher for <strong>${mission.title}</strong>. What would you like to discuss?`);
  } else {
    for (const row of chatRows) {
      const text = contentToText(row.content);
      if (!text.trim()) continue;
      if (row.role === "user") {
        messagesHtml += chatMessageBubble("user", formatMarkdown(text));
      } else {
        messagesHtml += chatMessageBubble("assistant", formatMarkdown(text));
      }
    }
  }

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Chat</h2>
    </div>
    <div id="chat-messages">${messagesHtml}</div>
    <form class="chat-form" hx-post="/missions/${id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <div class="textarea-wrapper">
        <textarea name="message" placeholder="Ask your teacher something..." rows="2" oninput="autoResize(this)"></textarea>
        <span class="textarea-hint">Press Enter to send \Shift + Enter for newlinemiddot; Shift + Enter for newline</span>
      </div>
      <button type="submit">Send</button>
    </form>
  `, "chat", `/missions/${id}`, "Mission"));
});

// ── Chat message handler (all missions) ──
missionRoutes.post("/:missionId/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  if (!message) return c.text("");
  const chatErr = validateChatMessage(message);
  if (chatErr) return c.html(chatErr);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "chat", 20, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const mode = (mission as Record<string, unknown>).onboardingMode as string || "guided";
  const systemPrompt = getOnboardingPrompt(missionId, mode);

  await saveMessage(store, missionId, "user", message);
  const messages = await loadMessages(store, missionId);

  try {
    const result = await runConversationLoop(c, missionId, systemPrompt, messages, TEACHER_TOOLS, {
      workflowType: "chat",
      workflowLabel: `Chat: ${mission.title}`,
    });

    if (result.didActivate) {
      await generateMissionTitle(c, missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text || "Let us continue.")));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:#c00;">${msg}</div>`);
  }
});
