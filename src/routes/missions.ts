import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { contentToText } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { generateSlug } from "../shared/slug.js";
import { formatAIError } from "../shared/errors.js";
import { requireMissionAccess } from "../shared/require-mission-access.js";
import { missionLayout } from "../views/mission.js";
import { guidedOnboardingLayout, onboardingLayout, newMissionPage } from "../views/onboarding.js";
import { chatMessageBubble, generationProgressPanel, emptyLessonsMessage, lessonCard } from "../views/fragments.js";
import { validateChatMessage, validateTitle, validateTopic, rateLimitedFragment } from "../security/index.js";
import { renderOobSections } from "./home.js";
import { onboardingRoutes } from "./onboarding.js";
import { missionTabRoutes } from "./mission-tabs.js";

type Ctx = Context<{ Variables: AppVariables }>;

export const missionRoutes = new Hono<{ Variables: AppVariables }>();

// ── Sub-routers ──────────────────────────────────────────────────────
missionRoutes.route("/", onboardingRoutes);
missionRoutes.route("/", missionTabRoutes);

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

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  await store.updateMissionTitle(missionId, newTitle);

  return c.html(`<span class="header-title" id="mission-title-display" style="cursor:pointer" title="Click to rename" onclick="this.style.display='none';document.getElementById('mission-title-edit').style.display='inline-flex';document.getElementById('title-input').focus();document.getElementById('title-input').select();">${newTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`);
});

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

  const slug = generateSlug(message);
  const title = message.length > 80 ? message.slice(0, 80) + "…" : message;
  const mission = await store.createMission({ userId: user.id, title, slug, onboardingMode: mode });
  const missionId = mission.id;

  const missionChatService = c.get("missionChatService");
  const pauseOpts = mode === "guided" ? { pauseOnTools: new Set(["ask_guided_question"]) } : {};

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message,
      missionTitle: title,
      missionStatus: "onboarding",
      onboardingMode: mode,
      workflowType: "mission_activation",
      workflowLabel: `Setting up: ${title}`,
      ...pauseOpts,
    });

    if (result.didActivate) {
      await missionChatService.generateTitle(missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }
  } catch {
    // Mission and user message are saved; redirect to onboarding even on AI error.
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
  const slug = generateSlug(topic);
  const mission = await store.createMission({ userId: user.id, title: topic, slug, onboardingMode: mode });

  return c.redirect(`/missions/${mission.id}`);
});

// ── View mission ──
missionRoutes.get("/:missionId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, id, user.id);
  if (!mission) return c.text("Not found", 404);

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
    if (currentMode === "guided") {
      if (pendingQuestion) {
        const options: string[] = JSON.parse(pendingQuestion.options as string);
        return c.html(guidedOnboardingLayout(user, mission, messagesHtml, pendingQuestion.id, pendingQuestion.question as string, options, false));
      }
      return c.html(guidedOnboardingLayout(user, mission, messagesHtml, null, null, [], true));
    }
    return c.html(onboardingLayout(user, mission, messagesHtml));
  }

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
    <div class="section-header"><h2>Lessons</h2></div>
    <div class="lesson-list stagger">${lessonCards}</div>
  `, "lessons"));
});

// ── Archive ──
missionRoutes.post("/:missionId/archive", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const id = parseInt(c.req.param("missionId")!);

  const mission = await requireMissionAccess(store, id, user.id);
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

  const mission = await requireMissionAccess(store, id, user.id);
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

  const mission = await requireMissionAccess(store, id, user.id);
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

  const mission = await requireMissionAccess(store, id, user.id);
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
    <div class="section-header"><h2>Chat</h2></div>
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

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const mode = (mission as Record<string, unknown>).onboardingMode as string || "guided";
  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message,
      missionTitle: mission.title,
      missionStatus: mission.status,
      onboardingMode: mission.status === "onboarding" ? mode : undefined,
    });

    if (result.didActivate) {
      await missionChatService.generateTitle(missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text || "Let us continue.")));
  } catch (err: unknown) {
    const msg = formatAIError(err);
    return c.html(`<div class="msg assistant" style="color:#c00;"><strong>${msg}</strong></div>`);
  }
});
