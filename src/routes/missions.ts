import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { ai } from "../ai/index.js";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { executeToolCalls } from "../ai/tools.js";
import type { AppVariables } from "../types.js";
import type Anthropic from "@anthropic-ai/sdk";
import { HTMX_HEAD } from "../views/shared.js";

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

// re-eval marker

type Ctx = Context<{ Variables: AppVariables }>;
export const missionRoutes = new Hono<{ Variables: AppVariables }>();

function missionLayout(user: { email: string }, mission: { id: number; title: string; status: string }, content: string, activeTab: string = "lessons") {
  const tabs = [
    { key: "lessons", label: "Lessons", href: `/missions/${mission.id}` },
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
  .lesson-card { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; }
  .lesson-card:hover { border-color: #b8a88a; }
  .lesson-card .num { font-size: 0.8rem; color: #aaa; font-family: monospace; margin-right: 0.75rem; }
  .lesson-card .info { display: flex; align-items: center; gap: 0.75rem; }
  .lesson-card h3 { font-size: 0.95rem; }
  .lesson-card .status { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
  .status-active { background: #faf7f0; color: #888; }
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
  .record-card .content { font-size: 0.85rem; color: #555; line-height: 1.5; white-space: pre-wrap; }
  .record-card .meta { font-size: 0.75rem; color: #aaa; }
  .record-card .superseded { background: #fef5f5; color: #8b2e2e; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
  .resource-markdown { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.5rem; line-height: 1.6; white-space: pre-wrap; font-size: 0.9rem; }
  #chat-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .chat-form { display: flex; gap: 0.5rem; }
  .chat-form input { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; }
  .chat-form input:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
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

// ── New mission (GET) ──
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
  .chat-form input { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; }
  .chat-form input:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<header class="header">
  <a href="/">&larr; Dashboard</a>
</header>
<div class="container">
  <h1>Start a new mission</h1>
  <p class="subtitle">Your AI teacher will help you define your learning goals.</p>
  <div id="chat-messages">
    <div class="msg assistant">Hi! I'm your teacher. What would you like to learn? Be as specific as you can — for example, "I want to be able to solo on guitar anywhere on the neck" or "I want to ship a Rust CLI tool."</div>
  </div>
  <form class="chat-form" hx-post="/missions/new/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::after-request="this.reset()">
    <input type="text" name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off">
    <button type="submit">Send</button>
  </form>
  <div id="thinking"></div>
</div>
</body>
</html>`);
});

// ── New mission (POST from dashboard) ──
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
  .chat-form input { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; }
  .chat-form input:focus { outline: none; border-color: #b8a88a; }
  .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .chat-form button:hover { background: #444; }
  .spinner { display: inline-block; width: 1em; height: 1em; border: 2px solid #ccc; border-top-color: #888; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 0.5rem; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<header class="header">
  <a href="/">&larr; Dashboard</a>
</header>
<div class="container">
  <h1>Starting: ${topic}</h1>
  <p class="subtitle">Your AI teacher will help you define your learning goals.</p>
  <div id="chat-messages">
    <div class="msg assistant">You want to learn about <strong>${topic}</strong>. Great! To give you the best lessons, I need to understand your goals better. Why do you want to learn this? What specific things do you want to be able to do?</div>
  </div>
  <form class="chat-form" hx-post="/missions/new/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::after-request="this.reset()">
    <input type="hidden" name="missionId" value="${mission.id}">
    <input type="text" name="message" id="chat-input" placeholder="Type your answer..." autofocus autocomplete="off">
    <button type="submit" id="chat-submit-btn">Send</button>
  </form>
</div>
</body>
</html>`);
});

// ── New mission chat (POST) ──
missionRoutes.post("/new/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();

  if (!message) {
    return c.html(`<div class="msg assistant">I didn't catch that — could you tell me what you'd like to learn?</div>`);
  }

  const existingMessages = String(body.messages || "");
  const isFirstMessage = !existingMessages;

  let missionId: number;
  if (isFirstMessage) {
    const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: user.id, title: message, slug, status: "onboarding" })
      .returning();
    missionId = mission.id;
  } else {
    missionId = parseInt(String(body.missionId || "0"));
  }

  const messages: Anthropic.MessageParam[] = [];
  if (existingMessages) {
    try {
      const parsed = JSON.parse(existingMessages);
      messages.push(...parsed);
    } catch {}
  }
  messages.push({ role: "user", content: message });

  try {
    // Save user message to DB
    await db.insert(schema.chatMessages).values({
      missionId,
      role: "user",
      content: JSON.stringify(message),
    });

    const response = await ai.chatWithTools(
      TEACHER_SYSTEM_PROMPT + `\n\nThe current mission ID is ${missionId}. The mission is in onboarding status. Your goal is to interview the user to understand their learning goals thoroughly (why, success criteria, constraints, out of scope). Use the write_mission_content tool to save the MISSION.md when it's well-defined. Also use write_mission_content for NOTES.md to capture any preferences. When the mission is fully defined, call mark_mission_active and tell the user they can go to their dashboard to start learning.`,
      messages,
      TEACHER_TOOLS
    );

    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
    const textBlocks: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textBlocks.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    if (response.stop_reason === "max_tokens" && toolUseBlocks.length === 0) {
      textBlocks.push("\n\n[My response was cut short. Could you ask again?]");
    }

    let updatedMessages: Anthropic.MessageParam[];

    if (toolUseBlocks.length > 0) {
      const results = await executeToolCalls(missionId, toolUseBlocks);

      // Save assistant message with tool_use blocks
      await db.insert(schema.chatMessages).values({
        missionId,
        role: "assistant",
        content: JSON.stringify(response.content),
      });

      // Check for mark_mission_active
      const didActivate = toolUseBlocks.some((b) => b.name === "mark_mission_active");
      if (didActivate) {
        await db.insert(schema.chatMessages).values({
          missionId,
          role: "user",
          content: JSON.stringify(results),
        });
        return c.html(`
          <div class="msg user">${escHtml(message)}</div>
          <div class="msg assistant">
            <p>Your mission is ready! I've defined your learning goals based on our conversation.</p>
            <p><a href="/missions/${missionId}" style="color:#2d2d2d;font-weight:500;">Go to your mission workspace &rarr;</a></p>
          </div>
          <script>setTimeout(() => window.location.href = '/missions/${missionId}', 1500);</script>`);
      }

      const followup = await ai.continueWithToolResults(messages, { role: "assistant", content: response.content }, results, TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS);
      for (const block of followup.content) {
        if (block.type === "text") {
          textBlocks.push(block.text);
        }
      }

      const followupText = (followup.content
        .filter((b) => b.type === "text") as Anthropic.TextBlock[])
        .map((b) => b.text)
        .join("\n");
      updatedMessages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: results },
        { role: "assistant" as const, content: followupText || "Done." },
      ];

      await db.insert(schema.chatMessages).values({
        missionId,
        role: "user",
        content: JSON.stringify(results),
      });
      await db.insert(schema.chatMessages).values({
        missionId,
        role: "assistant",
        content: JSON.stringify(followupText || "Done."),
      });
    } else {
      updatedMessages = [
        ...messages,
        { role: "assistant" as const, content: response.content },
      ];

      await db.insert(schema.chatMessages).values({
        missionId,
        role: "assistant",
        content: JSON.stringify(response.content),
      });
    }

    const text = textBlocks.join("\n") || "I've saved that. What else should I know?";

    return c.html(`
      <div class="msg user">${escHtml(message)}</div>
      <div class="msg assistant">${text.replace(/\n/g, "<br>")}</div>
      <input type="hidden" name="messages" value="${JSON.stringify(updatedMessages).replace(/"/g, "&quot;")}">
      <input type="hidden" name="missionId" value="${missionId}">
    `);
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>${err.recoverable ? " It may help to wait a moment and retry." : ""}`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:#8b2e2e;">${msg}</div>`);
  }
});

// ── View mission (lessons tab) ──
missionRoutes.get("/:missionId", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);

  if (!mission) return c.text("Not found", 404);

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

  const lessonCards = lessonRows.map((l) => `
    <div class="lesson-card">
      <div class="info">
        <span class="num">${String(l.number).padStart(4, "0")}</span>
        <h3>${l.title}</h3>
        <span class="status ${l.status === "completed" ? "status-completed" : "status-active"}">${l.status === "completed" ? "Completed" : "Active"}</span>
      </div>
      <a href="/missions/${id}/lessons/${l.number}" class="btn-primary" style="font-size:0.85rem;text-decoration:none;padding:0.4rem 0.9rem;border-radius:6px;">${l.status === "completed" ? "Review" : "Start"}</a>
    </div>
  `).join("");

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
    <iframe srcdoc="${ref.htmlContent.replace(/"/g, '&quot;')}" style="width:100%;height:calc(100vh - 200px);border:1px solid #e8e4dc;border-radius:8px;background:#fff;"></iframe>
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
      <div class="content">${r.markdownContent}</div>
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
    <div class="resource-markdown">${resources?.markdownContent || "No resources curated yet."}</div>
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

  await db.delete(schema.missions).where(eq(schema.missions.id, id));
  return c.html("");
});

// ── Chat page ──
missionRoutes.get("/:missionId/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const id = parseInt(c.req.param("missionId")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, id), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  // Load existing chat messages from DB
  const chatRows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, id))
    .orderBy(asc(schema.chatMessages.createdAt));

  let messagesHtml = "";
  const serializedMessages: Anthropic.MessageParam[] = [];

  if (chatRows.length === 0) {
    messagesHtml = `<div class="msg assistant">
      I'm your teacher. You can ask me to:
      <ul style="margin:0.5rem 0 0 1rem;font-size:0.9rem;">
        <li>Create your next lesson</li>
        <li>Explain something that was unclear</li>
        <li>Create a reference document</li>
        <li>Write a learning record for something you've mastered</li>
      </ul>
      What would you like to work on?
    </div>`;
  } else {
    for (const row of chatRows) {
      const parsed = JSON.parse(row.content);
      serializedMessages.push({ role: row.role as "user" | "assistant", content: parsed });
      const text = storedContentToText(row.content);
      if (row.role === "user") {
        messagesHtml += `<div class="msg user" style="background:#f0ebe0;align-self:flex-end;padding:0.75rem 1rem;border-radius:8px;max-width:85%;">${escHtml(text)}</div>`;
      } else {
        messagesHtml += `<div class="msg assistant" style="background:#fff;border:1px solid #e8e4dc;padding:0.75rem 1rem;border-radius:8px;line-height:1.5;max-width:85%;">${text.replace(/\n/g, "<br>")}</div>`;
      }
    }
  }

  const messagesJson = JSON.stringify(serializedMessages).replace(/"/g, "&quot;");

  return c.html(missionLayout(user, mission, `
    <div id="chat-container">
      <div id="chat-messages">
        ${messagesHtml}
      </div>
      <form class="chat-form" hx-post="/missions/${id}/chat" hx-target="#chat-messages" hx-swap="beforeend" hx-on::after-request="this.reset()" style="display:flex;gap:0.5rem;">
        <input type="hidden" name="messages" value="${messagesJson}">
        <input type="text" name="message" style="flex:1;padding:0.7rem 1rem;border:1px solid #e8e4dc;border-radius:8px;font-size:1rem;" placeholder="Ask your teacher..." autofocus>
        <button type="submit" style="padding:0.7rem 1.5rem;background:#2d2d2d;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;">Send</button>
      </form>
    </div>
  `, "lessons"));
});
