import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc, desc } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import { HTMX_HEAD } from "../views/shared.js";
import { ai } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { executeToolCalls } from "../ai/tools.js";
import type Anthropic from "@anthropic-ai/sdk";

type Ctx = Context<{ Variables: AppVariables }>;
export const lessonRoutes = new Hono<{ Variables: AppVariables }>();

lessonRoutes.get("/:number", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, number)
      )
    )
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  const allLessons = await db
    .select({
      number: schema.lessons.number,
      title: schema.lessons.title,
      slug: schema.lessons.slug,
      status: schema.lessons.status,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, missionId))
    .orderBy(asc(schema.lessons.number));

  const prevLesson = allLessons.find((l) => l.number === number - 1);
  const nextLesson = allLessons.find((l) => l.number === number + 1);

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${lesson.title} — ${mission.title} — Learninator</title>
${HTMX_HEAD}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #fdfcf9; color: #2d2d2d; }
  .toolbar { background: #fff; border-bottom: 1px solid #e8e4dc; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 10; }
  .toolbar .left { display: flex; align-items: center; gap: 1rem; }
  .toolbar a { font-size: 0.85rem; color: #888; text-decoration: none; }
  .toolbar a:hover { color: #2d2d2d; }
  .toolbar h1 { font-size: 0.95rem; font-weight: 500; }
  .toolbar .nav { display: flex; gap: 0.5rem; }
  .toolbar .nav a { padding: 0.3rem 0.7rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 0.8rem; }
  .toolbar .nav a:hover { background: #faf7f0; }
  .toolbar .nav a.disabled { color: #ccc; pointer-events: none; border-color: #eee; }
  .lesson-container { max-width: 780px; margin: 0 auto; padding: 1.5rem; }
  .feedback-bar { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .feedback-bar .label { font-size: 0.85rem; color: #555; }
  .feedback-bar button { padding: 0.4rem 0.9rem; border: 1px solid #e8e4dc; border-radius: 20px; background: #fff; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
  .feedback-bar button:hover { border-color: #b8a88a; }
  .feedback-bar button.selected { background: #f0ebe0; border-color: #b8a88a; }
  .feedback-bar .done-btn { margin-left: auto; padding: 0.5rem 1.25rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
  .feedback-bar .done-btn:hover { background: #444; }
  .lesson-chat { margin-top: 1.5rem; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1.25rem; }
  .lesson-chat h3 { font-size: 0.95rem; margin-bottom: 1rem; color: #555; font-weight: 500; }
  #followup-messages { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
  .msg { padding: 0.75rem 1rem; border-radius: 8px; line-height: 1.5; font-size: 0.95rem; }
  .msg.assistant { background: #fff; border: 1px solid #e8e4dc; align-self: flex-start; max-width: 85%; }
  .msg.user { background: #f0ebe0; align-self: flex-end; max-width: 85%; }
  .lesson-chat .chat-form { display: flex; gap: 0.5rem; }
  .lesson-chat .chat-form textarea { flex: 1; padding: 0.7rem 1rem; border: 1px solid #e8e4dc; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: none; }
  .lesson-chat .chat-form textarea:focus { outline: none; border-color: #b8a88a; }
  .lesson-chat .chat-form button { padding: 0.7rem 1.5rem; background: #2d2d2d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  .lesson-chat .chat-form button:hover { background: #444; }
</style>
</head>
<body>
<div class="toolbar">
  <div class="left">
    <a href="/missions/${missionId}">&larr; ${mission.title}</a>
    <h1>${String(number).padStart(4, "0")} — ${lesson.title}</h1>
  </div>
  <div class="nav">
    <a href="/missions/${missionId}/lessons/${number - 1}" class="${prevLesson ? "" : "disabled"}">&larr; Previous</a>
    <a href="/missions/${missionId}/lessons/${number + 1}" class="${nextLesson ? "" : "disabled"}">Next &rarr;</a>
  </div>
</div>
<div class="lesson-container">
  <iframe srcdoc="${lesson.htmlContent.replace(/"/g, '&quot;')}" style="width:100%;min-height:70vh;border:none;background:#fff;border-radius:8px;border:1px solid #e8e4dc;"></iframe>

  <div class="feedback-bar" id="feedback-bar">
    <span class="label">How was this lesson?</span>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_easy"}'>Too easy</button>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"just_right"}'>Just right</button>
    <button hx-post="/missions/${missionId}/lessons/${number}/feedback" hx-target="#feedback-bar" hx-swap="outerHTML" hx-vals='{"rating":"too_hard"}'>Too hard</button>
    <form hx-post="/missions/${missionId}/lessons/${number}/complete" hx-target="#feedback-bar" hx-swap="outerHTML" style="margin-left:auto;">
      <button type="submit" class="done-btn">Mark Complete</button>
    </form>
  </div>

  ${lesson.feedbackRating ? `
    <div class="feedback-bar">
      <span class="label">You rated this: <strong>${lesson.feedbackRating.replace("_", " ")}</strong></span>
      ${lesson.feedbackText ? `<span style="font-size:0.85rem;color:#888;">${lesson.feedbackText}</span>` : ""}
    </div>
  ` : ""}

  <div class="lesson-chat">
    <h3>Questions about this lesson?</h3>
    <div id="followup-messages"></div>
    <form class="chat-form" hx-post="/missions/${missionId}/chat" hx-target="#followup-messages" hx-swap="beforeend" hx-on::before-request="optimisticChat(this)" hx-on::after-request="this.reset()">
      <input type="hidden" name="context" value="Lesson ${number}: ${lesson.title}">
      <textarea name="message" placeholder="What's unclear about this lesson?" rows="2" oninput="autoResize(this)"></textarea>
      <button type="submit">Ask</button>
    </form>
  </div>
</div>
</body>
</html>`);
});

lessonRoutes.post("/:number/feedback", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);
  const body = await c.req.parseBody();
  const rating = String(body.rating || "");

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  await db
    .update(schema.lessons)
    .set({ feedbackRating: rating as "too_easy" | "just_right" | "too_hard" })
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, number)
      )
    );

  return c.html(`
    <div class="feedback-bar" id="feedback-bar">
      <span class="label">Thanks! You rated this: <strong>${rating.replace("_", " ")}</strong></span>
      <form hx-post="/missions/${missionId}/lessons/${number}/complete" hx-target="#feedback-bar" hx-swap="outerHTML" style="margin-left:auto;">
        <button type="submit" class="done-btn">Mark Complete</button>
      </form>
    </div>
  `);
});

lessonRoutes.post("/:number/complete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, number)
      )
    )
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  const alreadyCompleted = lesson.status === "completed";

  if (!alreadyCompleted) {
    await db
      .update(schema.lessons)
      .set({ status: "completed", completedAt: new Date().toISOString() })
      .where(
        and(
          eq(schema.lessons.missionId, missionId),
          eq(schema.lessons.number, number)
        )
      );
  }

  return c.html(`
    <div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.75rem;">
      <span class="label">${alreadyCompleted ? "Lesson already completed." : "Lesson completed!"}</span>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        <label style="font-size:0.85rem;color:#555;">Notes for the next lesson <span style="color:#aaa;">(optional)</span></label>
        <textarea name="notes" placeholder="What should the next lesson cover? Anything to change? e.g. &quot;More hands-on examples&quot; or &quot;Go deeper into X&quot;" rows="3" style="padding:0.7rem;border:1px solid #e8e4dc;border-radius:8px;font-size:0.9rem;font-family:inherit;resize:vertical;width:100%;"></textarea>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        <button hx-post="/missions/${missionId}/lessons/${number}/generate-next" hx-target="#feedback-bar" hx-swap="outerHTML" hx-include="[name='notes']" style="padding:0.5rem 1.25rem;background:#2d2d2d;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;">
          <span class="htmx-indicator-inline">Generating<span style="display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.3rem;"></span></span>
          <span class="btn-label">Create Next Lesson</span>
        </button>
        <a href="/missions/${missionId}" style="font-size:0.85rem;color:#888;text-decoration:none;">Done</a>
      </div>
    </div>
  `);
});

// ── In-memory tracking for generation jobs ──
type GenerationJob = {
  missionId: number;
  completedLessonNumber: number;
  status: "running" | "done" | "error";
  messages: string[];
  result: { lessonNumber: number; lessonTitle: string } | null;
  error: string | null;
};
const generationJobs = new Map<string, GenerationJob>();

function jobKey(missionId: number, number: number) {
  return `${missionId}-${number}`;
}

function toolLabel(name: string, input: Record<string, unknown> | undefined): string {
  switch (name) {
    case "list_lessons":
      return "Looking at previous lessons…";
    case "read_lesson":
      return `Reviewing lesson ${input?.number || ""}…`;
    case "list_reference_docs":
      return "Checking reference documents…";
    case "list_learning_records":
      return "Reviewing learning records…";
    case "create_lesson":
      return `Writing lesson: ${input?.title || "new lesson"}…`;
    case "create_reference_doc":
      return `Creating reference: ${input?.title || "new doc"}…`;
    case "read_mission_content":
      return "Reading mission notes…";
    default:
      return `Working (${name.replace(/_/g, " ")})…`;
  }
}

lessonRoutes.post("/:number/generate-next", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);
  const body = await c.req.parseBody();
  const notes = String(body.notes || "").trim();

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, number)
      )
    )
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  const key = jobKey(missionId, number);
  if (generationJobs.has(key)) {
    return c.html(`<div class="feedback-bar" id="feedback-bar"><span class="label">Already generating your next lesson…</span></div>`);
  }

  const job: GenerationJob = {
    missionId,
    completedLessonNumber: number,
    status: "running",
    messages: ["Starting…"],
    result: null,
    error: null,
  };
  generationJobs.set(key, job);

  // Fire-and-forget the AI generation in the background
  const log = c.get("logger");
  (async () => {
    try {
      let userMessage = `The user just completed Lesson ${number}: "${lesson.title}". Please create the next lesson (lesson ${number + 1}) for this mission.`;
      if (notes) {
        userMessage += `\n\nThe user provided these notes for the next lesson: ${notes}`;
      }
      userMessage += `\n\nReview what's been covered so far (use list_lessons and read references) and create the next appropriate lesson.`;

      const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}
Mission status: ${mission.status}

You are creating the next lesson in a sequence. The user just completed Lesson ${number}: "${lesson.title}". Use create_lesson to make the next one. Make it build on previous lessons. Read existing lessons first to understand what's been covered.`;

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      let currentResponse = await ai.chatWithTools(systemPrompt, messages, TEACHER_TOOLS);
      let priorMessages = messages;

      while (true) {
        const assistantContent = currentResponse.content;
        const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
        for (const block of assistantContent) {
          if (block.type === "text") {
            // Skip text during generation — only track tool calls
          } else if (block.type === "tool_use") {
            toolUseBlocks.push(block);
          }
        }

        if (toolUseBlocks.length === 0) {
          if (currentResponse.stop_reason === "max_tokens") {
            job.messages.push("Response was cut short…");
          }
          break;
        }

        // Update job with tool call labels
        for (const block of toolUseBlocks) {
          job.messages.push(toolLabel(block.name, block.input as Record<string, unknown> | undefined));
        }

        const results = await executeToolCalls(missionId, toolUseBlocks);

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
      }

      // Find the newly created lesson
      const [latestLesson] = await db
        .select()
        .from(schema.lessons)
        .where(eq(schema.lessons.missionId, missionId))
        .orderBy(desc(schema.lessons.number))
        .limit(1);

      if (latestLesson && latestLesson.number > number) {
        job.result = {
          lessonNumber: latestLesson.number,
          lessonTitle: latestLesson.title,
        };
      }
      job.status = "done";
    } catch (err: unknown) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Something went wrong.";
      log.error("generate-next failed:", job.error);
    } finally {
      // Auto-cleanup after 60s so the success/error state can be polled
      setTimeout(() => generationJobs.delete(key), 60_000);
    }
  })();

  // Return a polling container immediately
  return c.html(`
    <div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
         hx-get="/missions/${missionId}/lessons/${number}/generate-next/status"
         hx-trigger="every 1s"
         hx-swap="outerHTML"
         hx-target="#feedback-bar">
      <span class="label">Generating your next lesson…</span>
      <div style="font-size:0.85rem;color:#888;">
        <span class="thinking-dots"><span></span><span></span><span></span></span>
        Starting…
      </div>
    </div>
  `);
});

lessonRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);
  const key = jobKey(missionId, number);
  const job = generationJobs.get(key);

  if (!job) {
    // Job gone (expired or never existed) — fall back to checking if a new lesson exists
    return c.html(`<div class="feedback-bar" id="feedback-bar"><span class="label">Something went wrong. <a href="/missions/${missionId}" style="color:#2d2d2d;">Back to lessons &rarr;</a></span></div>`);
  }

  if (job.status === "error") {
    generationJobs.delete(key);
    return c.html(`
      <div class="feedback-bar" id="feedback-bar">
        <span class="label" style="color:#8b2e2e;">Failed to generate next lesson: ${job.error}</span>
        <a href="/missions/${missionId}" style="font-size:0.85rem;color:#2d2d2d;">Back to lessons &rarr;</a>
      </div>
    `);
  }

  if (job.status === "done" && job.result) {
    generationJobs.delete(key);
    return c.html(`
      <div class="feedback-bar" id="feedback-bar">
        <span class="label">Lesson created! <a href="/missions/${missionId}/lessons/${job.result.lessonNumber}" style="color:#2d2d2d;font-weight:500;">Start Lesson ${String(job.result.lessonNumber).padStart(4, "0")}: ${job.result.lessonTitle} &rarr;</a></span>
      </div>
    `);
  }

  // Still running — show latest progress
  const latestMsg = job.messages.at(-1) || "Working…";
  return c.html(`
    <div class="feedback-bar" id="feedback-bar" style="flex-direction:column;align-items:stretch;gap:0.5rem;"
         hx-get="/missions/${missionId}/lessons/${number}/generate-next/status"
         hx-trigger="every 1s"
         hx-swap="outerHTML"
         hx-target="#feedback-bar">
      <span class="label">Generating your next lesson…</span>
      <div style="font-size:0.85rem;color:#888;">
        <span class="thinking-dots"><span></span><span></span><span></span></span>
        ${latestMsg}
      </div>
    </div>
  `);
});
