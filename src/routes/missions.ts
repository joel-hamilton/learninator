import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { AIError } from "../ai/index.js";
import type { AppVariables } from "../types.js";
import { createMissionConversation } from "../ai/mission-conversation.js";

import { contentToText } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { missionLayout } from "../views/mission.js";
import { onboardingLayout, newMissionPage } from "../views/onboarding.js";
import { chatMessageBubble, emptyLessonsMessage, emptyReferencesMessage, emptyRecordsMessage, lessonCard, referenceDocCard, learningRecordCard } from "../views/fragments.js";
import { GUIDED_QUESTION_SCRIPT, HTMX_HEAD, HTMX_LOADING_BAR, svgIcon, userInitial, userMenu } from "../views/shared.js";
import { subscribe } from "../ai/events.js";
import { createOnboarding } from "../onboarding/index.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const missionRoutes = new Hono<{ Variables: AppVariables }>();

// ── Rename mission ──
missionRoutes.put("/:missionId/title", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const newTitle = String(body.title || "").trim();
  if (!newTitle) return c.text("Title required", 400);

  await db
    .update(schema.missions)
    .set({ title: newTitle, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)));

  return c.html(`<span class="header-title" id="mission-title-display" style="cursor:pointer" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();">${newTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`);
});

/** Guided onboarding page with question card UI. */
function guidedOnboardingLayout(
  user: { email: string; name?: string | null },
  mission: { id: number; title: string },
  messagesHtml: string,
  questionId: number | null,
  question: string | null,
  options: string[],
  needsTrigger: boolean
) {
  let questionCardHtml = "";
  if (needsTrigger) {
    questionCardHtml = `<div class="question-card" id="question-card">
      <div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div>
      <div hx-post="/missions/${mission.id}/guided/start" hx-target="#question-card" hx-swap="outerHTML" hx-trigger="load"></div>
    </div>`;
  } else if (questionId && question) {
    questionCardHtml = guidedQuestionCard(mission.id, questionId, question, options);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  :root { --bg: #fdfcf9; --surface: #ffffff; --border: #e8e4dc; --border-hover: #d4cdbc; --text: #2d2d2d; --text-secondary: #6b6b6b; --text-muted: #a3a3a3; --primary: #2d2d2d; --primary-hover: #444444; --primary-light: #f5f2eb; --warning: #8b6914; --warning-bg: #fef5e7; --radius: 8px; --radius-lg: 12px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.04); --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); --transition: 150ms ease; --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1); }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }
  .header { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: var(--text-secondary); text-decoration: none; }
  .header .back:hover { color: var(--text); }
  .header .right { display: flex; align-items: center; gap: 0.75rem; }
  .header .user { font-size: 0.85rem; color: var(--text-secondary); }
  .header .user a { color: var(--text-secondary); text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: var(--text); }
  .container { max-width: 700px; margin: 2rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .subtitle { color: var(--text-secondary); margin-bottom: 0.3rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; max-height: 30vh; overflow-y: auto; padding: 0.25rem; }
  .msg { padding: 0.6rem 0.9rem; border-radius: 8px; line-height: 1.5; font-size: 0.9rem; }
  .msg.assistant { background: var(--surface); border: 1px solid var(--border); align-self: flex-start; max-width: 90%; }
  .msg.user { background: var(--primary-light); align-self: flex-end; max-width: 90%; }
  .question-card { background: var(--surface); border: 2px solid var(--border-hover); border-radius: 12px; padding: 1.75rem; animation: fadeInUp 0.3s ease-out; }
  .question-card h2 { font-size: 1.15rem; margin-bottom: 1.25rem; line-height: 1.4; }
  .option-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 0.85rem; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .option-row:hover { border-color: var(--primary); background: var(--primary-light); }
  .option-row.selected { border-color: var(--warning); background: var(--warning-bg); }
  .option-row input[type="radio"] { accent-color: var(--warning); width: 1.1em; height: 1.1em; cursor: pointer; }
  .option-row label { flex: 1; cursor: pointer; font-size: 0.95rem; }
  .other-input { margin-top: 0.5rem; margin-bottom: 0.75rem; display: none; }
  .other-input.visible { display: block; }
  .other-input input { width: 100%; padding: 0.6rem 0.85rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; font-family: inherit; }
  .other-input input:focus { outline: none; border-color: var(--primary); }
  .question-card .submit-btn { margin-top: 1rem; padding: 0.7rem 2rem; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .question-card .submit-btn:hover { background: var(--primary-hover); }
  .question-card .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .skip-btn { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; text-decoration: none; }
  .skip-btn:hover { border-color: #ccc; color: var(--text-secondary); }
  .skip-btn.htmx-request { opacity: 0.5; pointer-events: none; border-color: var(--warning); color: var(--warning); }
  .skip-btn.htmx-request::after { content: " (working...)"; }
  .thinking-bubble { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; display: inline-block; }
  .thinking-dots { display: flex; gap: 0.3rem; }
  .thinking-dots span { width: 0.5em; height: 0.5em; background: #ccc; border-radius: 50%; animation: dotPulse 1.4s infinite ease-in-out; }
  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dotPulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
	.tool-banner {
	  position: sticky;
	  top: 0;
	  z-index: 99;
	  background: var(--warning-bg);
	  border-bottom: 1px solid var(--warning);
	  font-size: 0.75rem;
	  color: var(--warning);
	  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	  max-height: 0;
	  overflow: hidden;
	  transition: all 0.2s ease;
	  padding: 0 2rem;
	  display: flex;
	  align-items: center;
	  gap: 0.5rem;
	}
	.tool-banner.visible {
	  max-height: 36px;
	  padding: 0.4rem 2rem;
	}
</style>
</head>
<body data-user-initial="${userInitial(user)}">
<div id="htmx-loading-bar" class="htmx-indicator" style="position:fixed;top:0;left:0;height:3px;background:var(--primary);z-index:9999;opacity:0;transition:opacity 150ms;width:0;"></div>
<header class="header">
  <div class="left">
    <a href="/" class="back">${svgIcon("arrowLeft")} Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="right">${userMenu(user)}</div>
</header>
	<div id="tool-banner" class="tool-banner"></div>
<div class="container">
  <h1>Mission Setup</h1>
  <p class="subtitle">Answer each question to define your learning goals.</p>
  <form hx-post="/missions/${mission.id}/mode" hx-target="body" hx-swap="outerHTML" style="margin-bottom:1.5rem;"><input type="hidden" name="mode" value="chat"><button type="submit" style="background:none;border:none;padding:0;font:inherit;color:var(--text-secondary);font-size:0.85rem;text-decoration:underline;text-decoration-style:dotted;cursor:pointer;text-underline-offset:2px;">Prefer free-form chat instead?</button></form>
  <div id="chat-messages">${messagesHtml}</div>
  <div id="question-section">
    ${questionCardHtml}
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${mission.id}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>
</div>
	${GUIDED_QUESTION_SCRIPT}
<script>
(function() {
  var banner = document.getElementById("tool-banner");
  if (!banner) return;
  var missionId = ${mission.id};
  var activeTools = [];
  var inFlight = 0;
  var shownAt = 0;
  var hideTimer = 0;
  var MIN_SHOW_MS = 1200;

  document.addEventListener("htmx:beforeRequest", function() {
    inFlight++;
    showBanner("Working...");
  });

  document.addEventListener("htmx:afterRequest", function() {
    inFlight--;
    if (inFlight <= 0 && activeTools.length === 0) {
      inFlight = 0;
      hideBanner();
    }
  });

  var es = new EventSource("/missions/" + missionId + "/chat/tool-events");
  es.addEventListener("message", function(e) {
    try {
      var event = JSON.parse(e.data);
      if (event.type === "tool_start") {
        event.names.forEach(function(n) { if (activeTools.indexOf(n) === -1) activeTools.push(n); });
        showBanner(activeTools.join(", "));
      } else if (event.type === "tool_end") {
        activeTools = activeTools.filter(function(t) { return event.names.indexOf(t) === -1; });
        if (activeTools.length === 0) {
          if (inFlight > 0) showBanner("Working...");
          else hideBanner();
        }
      }
    } catch(ex) {}
  });

  es.addEventListener("error", function() {});

  function showBanner(msg) {
    shownAt = Date.now();
    clearTimeout(hideTimer);
    banner.innerHTML = '<span class="spinner"></span> ' + (msg || activeTools.join(", "));
    banner.classList.add("visible");
  }

  function hideBanner() {
    var elapsed = Date.now() - shownAt;
    if (elapsed < MIN_SHOW_MS) {
      hideTimer = setTimeout(function() { banner.classList.remove("visible"); }, MIN_SHOW_MS - elapsed);
    } else {
      banner.classList.remove("visible");
    }
  }
})();
</script>
</body>
</html>`;
}

/** Renders a single guided question card with radio options. */
function guidedQuestionCard(missionId: number, questionId: number, question: string, options: string[]) {
  const optionRows = options.map((opt, i) => {
    const isOther = i === options.length - 1;
    const escaped = opt.replace(/"/g, "&quot;");
    return `<div class="option-row" onclick="selectOption(this, ${i})">
      <input type="radio" name="answer" value="${escaped}" id="opt-${i}" onchange="onOptionChange(${i})">
      <label for="opt-${i}">${opt}</label>
    </div>`;
  }).join("");

  return `<div class="question-card" id="question-card">
    <h2>${question}</h2>
    <div id="options-container">
      ${optionRows}
    </div>
    <div class="other-input" id="other-input">
      <input type="text" name="other_text" id="other-text" placeholder="Type your answer..." autocomplete="off" oninput="onOtherInput(this)">
    </div>
    <form hx-post="/missions/${missionId}/guided/answer" hx-target="#question-section" hx-swap="outerHTML" hx-on::before-request="return submitGuidedAnswer()" hx-on::after-request="this.reset()">
      <input type="hidden" name="question_id" value="${questionId}">
      <input type="hidden" name="answer" id="answer-hidden">
      <input type="hidden" name="other_text" id="other-text-hidden">
      <button type="submit" class="submit-btn" id="submit-btn" disabled>Submit</button>
    </form>
  </div>`;
}

/** Full question section (card + skip button) for AJAX responses. */
function guidedQuestionSection(missionId: number, questionId: number, question: string, options: string[]) {
  return `<div id="question-section">
    ${guidedQuestionCard(missionId, questionId, question, options)}
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${missionId}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>`;
}

/** Thinking state section that triggers a guided turn. */
function guidedThinkingSection(missionId: number) {
  return `<div id="question-section">
    <div class="question-card" id="question-card">
      <div class="msg assistant thinking-bubble"><span class="thinking-dots"><span></span><span></span><span></span></span></div>
      <div hx-post="/missions/${missionId}/guided/start" hx-target="#question-section" hx-swap="outerHTML" hx-trigger="load"></div>
    </div>
    <div style="text-align:center;">
      <button class="skip-btn" hx-post="/missions/${missionId}/guided/skip" hx-target="body" hx-swap="outerHTML">I've answered enough — just create the mission</button>
    </div>
  </div>`;
}

// ── New mission page (GET) ──
missionRoutes.get("/new", auth.requireAuth, (c: Ctx) => {
  return c.html(newMissionPage());
});

// ── Create mission from first chat message (POST /missions) ──
missionRoutes.post("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const mode = (String(body.mode || "") === "chat" ? "chat" : "guided") as "guided" | "chat";

  if (!message) {
    return c.html(`<div class="msg assistant">I didn't catch that — could you tell me what you'd like to learn?</div>`);
  }

  const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const title = message.length > 80 ? message.slice(0, 80) + "…" : message;
  const [mission] = await db
    .insert(schema.missions)
    .values({ userId: user.id, title, slug, status: "onboarding", onboardingMode: mode })
    .returning();
  const missionId = mission.id;

  const onboarding = createOnboarding({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  await onboarding.start(missionId, message, mode);

  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
});

// ── Create mission from dashboard topic (POST /missions/new) ──
missionRoutes.post("/new", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const topic = String(body.topic || "").trim();
  if (!topic) return c.redirect("/missions/new");

  const mode = (String(body.mode || "") === "chat" ? "chat" : "guided") as "guided" | "chat";
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const [mission] = await db
    .insert(schema.missions)
    .values({ userId: user.id, title: topic, slug, status: "onboarding", onboardingMode: mode })
    .returning();

  return c.redirect(`/missions/${mission.id}`);
});

// ── View mission ──
missionRoutes.get("/:missionId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);

  if (!mission) return c.text("Not found", 404);

  // ── Onboarding: show appropriate page based on mode ──
  if (mission.status === "onboarding") {
    const chatRows = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.missionId, id))
      .orderBy(asc(schema.chatMessages.createdAt));

    // Check for pending guided question
    const [pendingQuestion] = await db
      .select()
      .from(schema.guidedQuestions)
      .where(and(eq(schema.guidedQuestions.missionId, id), eq(schema.guidedQuestions.status, "pending")))
      .orderBy(asc(schema.guidedQuestions.createdAt))
      .limit(1);

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
  const lessonRows = await db
    .select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      status: schema.lessons.status,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, id))
    .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));

  if (lessonRows.length === 0) {
    return c.html(missionLayout(user, mission, emptyLessonsMessage(id), "lessons"));
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
    <div class="section-header">
      <h2>Lessons</h2>
    </div>
    <div class="lesson-list stagger">${lessonCards}</div>
  `, "lessons"));
});

// ── Guided onboarding: start/continue conversation ──
missionRoutes.post("/:missionId/guided/start", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const onboarding = createOnboarding({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  const result = await onboarding.continueGuided(missionId);

  switch (result.type) {
    case "redirect":
      c.header("HX-Redirect", result.url);
      return c.body(null);
    case "question":
      return c.html(guidedQuestionSection(missionId, result.questionId, result.question, result.options));
    case "thinking":
      return c.html(guidedThinkingSection(missionId));
    case "error":
      return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${result.message}</p></div></div>`);
  }
});

// ── Guided onboarding: answer a question ──
missionRoutes.post("/:missionId/guided/answer", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const questionId = parseInt(String(body.question_id || ""));
  const selectedAnswer = String(body.answer || "").trim();
  const otherText = String(body.other_text || "").trim();

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const onboarding = createOnboarding({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  const result = await onboarding.answerQuestion(missionId, questionId, selectedAnswer, otherText);

  switch (result.type) {
    case "redirect":
      c.header("HX-Redirect", result.url);
      return c.body(null);
    case "question":
      return c.html(guidedQuestionSection(missionId, result.questionId, result.question, result.options));
    case "thinking":
      return c.html(guidedThinkingSection(missionId));
    case "error":
      return c.html(`<div id="question-section"><div class="question-card"><p style="color:#c00;">${result.message}</p></div></div>`);
  }
});

// ── Guided onboarding: skip remaining questions ──
missionRoutes.post("/:missionId/guided/skip", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const onboarding = createOnboarding({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  const result = await onboarding.skipQuestions(missionId);

  c.header("HX-Redirect", (result as { url: string }).url);
  return c.body(null);
});

// ── Toggle onboarding mode ──
missionRoutes.post("/:missionId/mode", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const newMode = String(body.mode || "guided") as "guided" | "chat";

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission || mission.status !== "onboarding") return c.text("Not found", 404);

  const onboarding = createOnboarding({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  await onboarding.switchMode(missionId, newMode);

  // Re-render the page by redirecting to the same URL
  return c.redirect(`/missions/${missionId}`);
});

// ── Reference docs ──
missionRoutes.get("/:missionId/reference", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const refs = await db
    .select()
    .from(schema.referenceDocs)
    .where(eq(schema.referenceDocs.missionId, id))
    .orderBy(asc(schema.referenceDocs.createdAt));

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
  const missionId = parseInt(c.req.param("missionId")!);
  const refId = parseInt(c.req.param("refId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const [ref] = await db
    .select()
    .from(schema.referenceDocs)
    .where(and(eq(schema.referenceDocs.id, refId), eq(schema.referenceDocs.missionId, missionId)))
    .limit(1);
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
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const records = await db
    .select()
    .from(schema.learningRecords)
    .where(eq(schema.learningRecords.missionId, id))
    .orderBy(asc(schema.learningRecords.number));

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
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const [resources] = await db
    .select()
    .from(schema.missionContent)
    .where(
      and(
        eq(schema.missionContent.missionId, id),
        eq(schema.missionContent.contentType, "resources")
      )
    )
    .limit(1);

  return c.html(missionLayout(user, mission, `
    <div class="section-header">
      <h2>Resources</h2>
    </div>
    <div class="resource-markdown markdown-body">${formatMarkdown(resources?.markdownContent || "No resources curated yet.")}</div>
  `, "resources", `/missions/${id}`, "Mission"));
});

// ── Delete ──
missionRoutes.post("/:missionId/delete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  await db.delete(schema.chatMessages).where(eq(schema.chatMessages.missionId, id));
  await db.delete(schema.guidedQuestions).where(eq(schema.guidedQuestions.missionId, id));
  await db.delete(schema.lessons).where(eq(schema.lessons.missionId, id));
  await db.delete(schema.referenceDocs).where(eq(schema.referenceDocs.missionId, id));
  await db.delete(schema.learningRecords).where(eq(schema.learningRecords.missionId, id));
  await db.delete(schema.missionContent).where(eq(schema.missionContent.missionId, id));
  await db.delete(schema.missions).where(eq(schema.missions.id, id));
  return c.html("");
});

// ── SSE endpoint for tool call events (dev visibility) ──
missionRoutes.get("/:missionId/chat/tool-events", auth.requireAuth, async (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);

  return streamSSE(c, async (stream) => {
    const log = c.get("logger");
    log.debug("SSE client connected for mission %d", missionId);

    const unsub = subscribe(missionId, async (event) => {
      log.debug("SSE sending %s: %s", event.type, event.names.join(", "));
      try {
        await stream.writeSSE({ data: JSON.stringify(event) });
      } catch (e) {
        log.debug("SSE write error: %s", e);
      }
    });

    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        log.debug("SSE client disconnected for mission %d", missionId);
        unsub();
        resolve();
      });
    });
  });
});

// ── Chat page (for active missions) ──
missionRoutes.get("/:missionId/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const chatRows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, id))
    .orderBy(asc(schema.chatMessages.createdAt));

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
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  if (!message) return c.text("");

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const mc = createMissionConversation({
    ai: c.get("ai"),
    toolExecutor: c.get("toolExecutor"),
    db,
    logger: c.get("logger"),
  });

  try {
    const result = await mc.run({
      missionId,
      missionStatus: mission.status,
      onboardingMode: (mission as Record<string, unknown>).onboardingMode as "guided" | "chat" | undefined,
      userMessage: message,
    });

    if (result.type === "activated") {
      c.header("HX-Redirect", result.redirectUrl);
      return c.body(null);
    }

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text)));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:#c00;">${msg}</div>`);
  }
});
