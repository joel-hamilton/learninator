import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop } from "../ai/conversation.js";
import type { AppVariables } from "../types.js";
import type { AiMessageParam } from "../ai/types.js";
import { saveMessage, contentToText } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { missionLayout } from "../views/mission.js";
import { onboardingLayout, newMissionPage } from "../views/onboarding.js";
import { chatMessageBubble, emptyLessonsMessage, emptyReferencesMessage, emptyRecordsMessage, lessonCard, referenceDocCard, learningRecordCard } from "../views/fragments.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const missionRoutes = new Hono<{ Variables: AppVariables }>();

// ── New mission page (GET) ──
missionRoutes.get("/new", auth.requireAuth, (c: Ctx) => {
  return c.html(newMissionPage());
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
    const messages: AiMessageParam[] = [
      { role: "user", content: message },
    ];

    await saveMessage(missionId, "user", message);

    let didActivate = false;

    await conversationLoop({
      client: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      missionId,
      systemPrompt,
      initialMessages: messages,
      tools: TEACHER_TOOLS,
      logger: log,
      hooks: {
        onAssistantMessage: async (content) => {
          await saveMessage(missionId, "assistant", content);
        },
        onBeforeToolExecution: async (toolUseBlocks) => {
          if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
            didActivate = true;
          }
          log.debug("Onboarding tool calls:", toolUseBlocks.map((b) => b.name).join(", "));
        },
        onAfterToolExecution: async (results) => {
          await saveMessage(missionId, "user", results);
        },
      },
    });

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
        const text = contentToText(row.content);
        if (row.role === "user") {
          messagesHtml += chatMessageBubble("user", formatMarkdown(text));
        } else {
          messagesHtml += chatMessageBubble("assistant", formatMarkdown(text));
        }
      }
    }

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

  const lessonCards = lessonRows.map((l) => lessonCard(id, l)).join("");

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
    return c.html(missionLayout(user, mission, emptyReferencesMessage(), "reference"));
  }

  const cards = refs.map((r) => referenceDocCard(id, r)).join("");

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
    return c.html(missionLayout(user, mission, emptyRecordsMessage(), "records"));
  }

  const cards = records.map((r) => learningRecordCard({
    number: r.number,
    title: r.title,
    markdownContent: formatMarkdown(r.markdownContent),
    status: r.status,
    supersededBy: r.supersededBy,
  })).join("");

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
    messagesHtml = chatMessageBubble("assistant", `Hi! I'm your teacher for <strong>${mission.title}</strong>. What would you like to discuss?`);
  } else {
    for (const row of chatRows) {
      const text = contentToText(row.content);
      if (row.role === "user") {
        messagesHtml += chatMessageBubble("user", formatMarkdown(text));
      } else {
        messagesHtml += chatMessageBubble("assistant", formatMarkdown(text));
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
