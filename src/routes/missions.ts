import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { ai } from "../ai/index.js";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { executeToolCalls } from "../ai/tools.js";
import { marked } from "marked";
import type { AppVariables } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";
import { HTMX_HEAD, HTMX_LOADING_BAR } from "../views/shared.js";

function escHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function storedContentToText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return (parsed
        .filter((b) => b.type === "text") as Anthropic.TextBlock[])
        .map((b) => b.text)
        .join("\n");
    }
    return String(parsed);
  } catch {
    return content;
  }
}

function formatMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

async function saveMessage(missionId: number, role: "user" | "assistant", content: unknown) {
  await db.insert(schema.chatMessages).values({
    missionId,
    role,
    content: JSON.stringify(content),
  });
}

async function loadMessages(missionId: number): Promise<Anthropic.MessageParam[]> {
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, missionId))
    .orderBy(asc(schema.chatMessages.createdAt));

  return rows.map((row) => ({
    role: row.role as "user" | "assistant",
    content: JSON.parse(row.content),
  }));
}

// re-eval marker

type Ctx = Context<{ Variables: AppVariables }>;
export const missionRoutes = new Hono<{ Variables: AppVariables }>();

function missionLayout(user: { email: string }, mission: { id: number; title: string; status: string }, content: string, activeTab: string = "lessons") {
  const tabs = [
    { key: "lessons", label: "Lessons", href: `/missions/${mission.id}` },
    { key: "chat", label: "Chat", href: `/missions/${mission.id}/chat` },
    { key: "reference", label: "Reference", href: `/missions/${mission.id}/reference` },
    { key: "records", label: "Learning Records", href: `/missions/${mission.id}/records` },
    { key: "resources", label: "Resources", href: `/missions/${mission.id}/resources` },
  ];

  const tabHtml = tabs.map((t) =>
    `<a href="${t.href}" class="${t.key === activeTab ? "tab active" : "tab"}">${t.label}</a>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; min-height: 100vh; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: #888; text-decoration: none; }
  .header .back:hover { color: #2d2d2d; }
  .header .user { font-size: 0.85rem; color: #888; }
  .header .user a { color: #888; text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: #2d2d2d; }
  .layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); }
  .sidebar { background: #fff; border-right: 1px solid #e8e4dc; padding: 1.5rem; }
  .sidebar h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; margin-bottom: 1rem; }
  .tabs { display: flex; flex-direction: column; gap: 0.25rem; }
  .tab { display: block; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.9rem; color: #555; text-decoration: none; }
  .tab:hover { background: #faf7f0; }
  .tab.active { background: #f0ebe0; color: #2d2d2d; font-weight: 500; }
  .mission-info { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e8e4dc; }
  .mission-info .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; }
  .mission-info .text { font-size: 0.85rem; color: #555; margin-top: 0.25rem; line-height: 1.5; }
  .main { padding: 2rem; overflow: auto; }
  .lesson-list { display: grid; gap: 0.5rem; }
  .lesson-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; text-decoration: none; color: inherit; cursor: pointer; transition: border-color 0.15s; }
  .lesson-card:hover { border-color: #b8a88a; }
  .lesson-card .num { font-size: 0.8rem; color: #aaa; font-family: monospace; margin-right: 0.75rem; }
  .lesson-card .info { display: flex; align-items: center; gap: 0.75rem; }
  .lesson-card h3 { font-size: 0.95rem; }
  .lesson-card .status { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .status-active { background: #faf7f0; color: #888; }
  .status-in-progress { background: #fef5e7; color: #8b6914; }
  .status-completed { background: #e8f0e4; color: #2d5a27; }
  .empty { text-align: center; color: #888; padding: 3rem; }
  .ref-list { display: grid; gap: 0.5rem; }
  .ref-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .ref-card:hover { border-color: #b8a88a; }
  .ref-card h3 { font-size: 0.95rem; }
  .ref-card .type { font-size: 0.75rem; color: #aaa; text-transform: uppercase; }
  .record-list { display: grid; gap: 0.5rem; }
  .record-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .record-card:hover { border-color: #b8a88a; }
  .record-card h3 { font-size: 0.95rem; margin-bottom: 0.5rem; }
  .record-card .content { font-size: 0.85rem; color: #555; line-height: 1.5; }
  .record-card .meta { font-size: 0.75rem; color: #aaa; }
  .record-card .superseded { background: #fef5f5; color: #8b2e2e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
  .resource-markdown { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.5rem; line-height: 1.6; font-size: 0.9rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="left">
    <a href="/" class="back">&larr; Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="layout">
  <aside class="sidebar">
    <h2>Workspace</h2>
    <nav class="tabs">
      ${tabHtml}
    </nav>
    <div class="mission-info">
      <div class="label">Mission</div>
      <div class="text">${mission.title} &middot; ${mission.status}</div>
    </div>
  </aside>
  <main class="main">
    ${content}
  </main>
</div>
</body>
</html>`;
}

/** Chat-focused page for onboarding missions. */
function onboardingLayout(user: { email: string }, mission: { id: number; title: string }, messagesHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .header .left { display: flex; align-items: center; gap: 1rem; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header .back { font-size: 0.85rem; color: #888; text-decoration: none; }
  .header .back:hover { color: #2d2d2d; }
  .header .user { font-size: 0.85rem; color: #888; }
  .header .user a { color: #888; text-decoration: none; margin-left: 0.5rem; }
  .header .user a:hover { color: #2d2d2d; }
  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <div class="left">
    <a href="/" class="back">&larr; Dashboard</a>
    <h1>${mission.title}</h1>
  </div>
  <div class="user">${user.email} <a href="/logout">Log out</a></div>
</header>
<div class="container">
  <div id="chat-messages">
    ${messagesHtml}
  </div>
  <form class="chat-form" hx-post="/missions/${mission.id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
    <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
    <button type="submit">Send</button>
  </form>
</div>
</body>
</html>`;
}

// ── New mission page (GET) ──
missionRoutes.get("/new", auth.requireAuth, (c: Ctx) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Start a New Mission — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .header { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 2rem; display: flex; align-items: center; height: 56px; }
  .header a { color: #888; text-decoration: none; font-size: 0.85rem; }
  .header a:hover { color: #2d2d2d; }
  .container { max-width: 700px; margin: 3rem auto; padding: 0 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
${HTMX_LOADING_BAR}
<header class="header">
  <a href="/">&larr; Dashboard</a>
</header>
<div class="container">
  <h1>Start a new mission</h1>
  <p class="subtitle">Your AI teacher will help you define your learning goals.</p>
  <div id="chat-messages">
    <div class="msg assistant">Hi! I'm your teacher. What would you like to learn? Be as specific as you can — for example, "I want to be able to solo on guitar anywhere on the neck" or "I want to ship a Rust CLI tool."</div>
  </div>
  <form class="chat-form" hx-post="/missions" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
    <textarea name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off" rows="2" oninput="autoResize(this)"></textarea>
    <button type="submit">Send</button>
  </form>
</div>
</body>
</html>`);
});

// ── Create mission from first chat message (POST /missions) ──
missionRoutes.post("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();

  if (!message) {
    return c.html(`<div class="msg assistant">I didn't catch that — could you tell me what you'd like to learn?</div>`);
  }

  const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const title = message.length > 80 ? message.slice(0, 80) + "…" : message;
  const [mission] = await db
    .insert(schema.missions)
    .values({ userId: user.id, title, slug, status: "onboarding" })
    .returning();
  const missionId = mission.id;

  const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}. The mission is in onboarding status. Your goal is to interview the user to understand their learning goals thoroughly (why, success criteria, constraints, out of scope). Use write_mission_content to save MISSION.md when it's well-defined. Also use write_mission_content for NOTES.md to capture preferences. When the mission is fully defined, call mark_mission_active and tell the user to go to their dashboard.`;

  const log = c.get("logger");

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: message },
    ];

    await saveMessage(missionId, "user", message);

    let currentResponse = await ai.chatWithTools(systemPrompt, messages, TEACHER_TOOLS);
    let didActivate = false;
    const textBlocks: string[] = [];
    let priorMessages = messages;

    while (true) {
      const assistantContent = currentResponse.content;
      const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
      for (const block of assistantContent) {
        if (block.type === "text") {
          textBlocks.push(block.text);
        } else if (block.type === "tool_use") {
          toolUseBlocks.push(block);
        }
      }

      if (toolUseBlocks.length === 0) {
        if (currentResponse.stop_reason === "max_tokens") {
          textBlocks.push("\n\n[My response was cut short. Could you ask again?]");
        }
        await saveMessage(missionId, "assistant", assistantContent);
        break;
      }

      if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
        didActivate = true;
      }

      log.debug("Onboarding tool calls:", toolUseBlocks.map((b) => b.name).join(", "));

      await saveMessage(missionId, "assistant", assistantContent);

      const results = await executeToolCalls(missionId, toolUseBlocks);
      await saveMessage(missionId, "user", results);

      currentResponse = await ai.continueWithToolResults(
        priorMessages,
        { role: "assistant", content: assistantContent },
        results,
        systemPrompt,
        TEACHER_TOOLS
      );

      priorMessages = [
        ...priorMessages,
        { role: "assistant" as const, content: assistantContent },
        { role: "user" as const, content: results },
      ];

      log.debug("Onboarding tool round complete, stop_reason:", currentResponse.stop_reason);
    }

    if (didActivate) {
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }
  } catch (err: unknown) {
    // Mission and user message are saved; redirect to the chat page even on AI error.
  }

  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
});

// ── Create mission from dashboard topic (POST /missions/new) ──
missionRoutes.post("/new", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const topic = String(body.topic || "").trim();
  if (!topic) return c.redirect("/missions/new");

  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const [mission] = await db
    .insert(schema.missions)
    .values({ userId: user.id, title: topic, slug, status: "onboarding" })
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

  // ── Onboarding: show chat-focused page ──
  if (mission.status === "onboarding") {
    const chatRows = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.missionId, id))
      .orderBy(asc(schema.chatMessages.createdAt));

    let messagesHtml = "";
    if (chatRows.length === 0) {
      messagesHtml = `<div class="msg assistant">Hi! I'm your teacher. I'll help you define your learning goals for <strong>${mission.title}</strong>. Why do you want to learn this? What specific things do you want to be able to do?</div>`;
    } else {
      for (const row of chatRows) {
        const text = storedContentToText(row.content);
        if (row.role === "user") {
          messagesHtml += `<div class="msg user">${formatMarkdown(text)}</div>`;
        } else {
          messagesHtml += `<div class="msg assistant markdown-body" style="background:#fff;border:1px solid #e8e4dc;">${formatMarkdown(text)}</div>`;
        }
      }
    }

    return c.html(onboardingLayout(user, mission, messagesHtml));
  }

  // ── Active / archived: show tabbed layout ──
  const lessonRows = await db
    .select()
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, id))
    .orderBy(asc(schema.lessons.number));

  if (lessonRows.length === 0) {
    return c.html(missionLayout(user, mission, `
      <div class="empty">
        <p>No lessons yet. Your AI teacher will create them as you go.</p>
        <p style="margin-top:0.5rem;font-size:0.85rem;">Go to the <a href="/missions/${id}/chat" style="color:#2d2d2d;">chat</a> to ask for your first lesson.</p>
      </div>
    `, "lessons"));
  }

  const lessonCards = lessonRows.map((l) => {
    const statusLabel = l.status === "completed" ? "Completed" : l.status === "in_progress" ? "In Progress" : "";
    const statusClass = l.status === "completed" ? "status-completed" : l.status === "in_progress" ? "status-in-progress" : "status-active";
    return `
    <a href="/missions/${id}/lessons/${l.number}" class="lesson-card">
      <div class="info">
        <span class="num">${String(l.number).padStart(4, "0")}</span>
        <h3>${l.title}</h3>
      </div>
      ${statusLabel ? `<span class="status ${statusClass}">${statusLabel}</span>` : ""}
    </a>
  `}).join("");

  return c.html(missionLayout(user, mission, `
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Lessons</h2>
    <div class="lesson-list">${lessonCards}</div>
  `, "lessons"));
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
    return c.html(missionLayout(user, mission, `<div class="empty"><p>No reference documents yet. Your AI teacher will create cheat sheets and other references alongside lessons.</p></div>`, "reference"));
  }

  const cards = refs.map((r) => `
    <div class="ref-card">
      <span class="type">${r.docType}</span>
      <h3>${r.title}</h3>
      <a href="/missions/${id}/reference/${r.id}" style="font-size:0.85rem;color:#2d2d2d;">View &rarr;</a>
    </div>
  `).join("");

  return c.html(missionLayout(user, mission, `
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Reference Documents</h2>
    <div class="ref-list">${cards}</div>
  `, "reference"));
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

  return c.html(missionLayout(user, mission, `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h2 style="font-size:1.2rem;">${ref.title}</h2>
      <span style="font-size:0.8rem;color:#888;">${ref.docType}</span>
    </div>
    <iframe srcdoc="${ref.htmlContent.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="width:100%;height:calc(100vh - 200px);border:1px solid #e8e4dc;border-radius:8px;background:#fff;"></iframe>
  `, "reference"));
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
    return c.html(missionLayout(user, mission, `<div class="empty"><p>No learning records yet. These are created as you demonstrate understanding.</p></div>`, "records"));
  }

  const cards = records.map((r) => `
    <div class="record-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
        <span class="meta">LR${String(r.number).padStart(4, "0")}</span>
        ${r.status === "superseded" ? `<span class="superseded">Superseded by LR${String(r.supersededBy || 0).padStart(4, "0")}</span>` : ""}
      </div>
      <h3>${r.title}</h3>
      <div class="content markdown-body">${formatMarkdown(r.markdownContent)}</div>
    </div>
  `).join("");

  return c.html(missionLayout(user, mission, `
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Learning Records</h2>
    <div class="record-list">${cards}</div>
  `, "records"));
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
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Resources</h2>
    <div class="resource-markdown markdown-body">${formatMarkdown(resources?.markdownContent || "No resources curated yet.")}</div>
  `, "resources"));
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
  await db.delete(schema.lessons).where(eq(schema.lessons.missionId, id));
  await db.delete(schema.referenceDocs).where(eq(schema.referenceDocs.missionId, id));
  await db.delete(schema.learningRecords).where(eq(schema.learningRecords.missionId, id));
  await db.delete(schema.missionContent).where(eq(schema.missionContent.missionId, id));
  await db.delete(schema.missions).where(eq(schema.missions.id, id));
  return c.html("");
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
    messagesHtml = `<div class="msg assistant markdown-body" style="background:#fff;border:1px solid #e8e4dc;">Hi! I'm your teacher for <strong>${mission.title}</strong>. What would you like to discuss?</div>`;
  } else {
    for (const row of chatRows) {
      const text = storedContentToText(row.content);
      if (row.role === "user") {
        messagesHtml += `<div class="msg user">${formatMarkdown(text)}</div>`;
      } else {
        messagesHtml += `<div class="msg assistant markdown-body" style="background:#fff;border:1px solid #e8e4dc;">${formatMarkdown(text)}</div>`;
      }
    }
  }

  return c.html(missionLayout(user, mission, `
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Chat</h2>
    <div id="chat-messages">${messagesHtml}</div>
    <form class="chat-form" hx-post="/missions/${id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <textarea name="message" placeholder="Ask your teacher something..." rows="2" oninput="autoResize(this)"></textarea>
      <button type="submit">Send</button>
    </form>
  `, "chat"));
});
