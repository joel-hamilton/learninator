import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import { HTMX_HEAD } from "../views/shared.js";

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
  .ask-followup { margin-top: 1rem; }
  .ask-followup details { background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; padding: 1rem; }
  .ask-followup summary { cursor: pointer; font-size: 0.9rem; color: #555; }
  .ask-followup form { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
  .ask-followup input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #e8e4dc; border-radius: 6px; font-size: 0.9rem; }
  .ask-followup button { padding: 0.5rem 1rem; background: #2d2d2d; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .response { font-size: 0.85rem; color: #555; margin-top: 0.5rem; padding: 0.5rem; background: #faf7f0; border-radius: 6px; }
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

  <div class="ask-followup">
    <details>
      <summary>Ask a follow-up question about this lesson</summary>
      <form hx-post="/missions/${missionId}/chat" hx-target="this" hx-swap="afterend">
        <input type="hidden" name="context" value="Lesson ${number}: ${lesson.title}">
        <input type="text" name="message" placeholder="What's unclear about this lesson?">
        <button type="submit">Ask</button>
      </form>
      <div class="response"></div>
    </details>
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

  await db
    .update(schema.lessons)
    .set({ status: "completed", completedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.lessons.missionId, missionId),
        eq(schema.lessons.number, number)
      )
    );

  return c.html(`
    <div class="feedback-bar" id="feedback-bar">
      <span class="label">Lesson completed! <a href="/missions/${missionId}" style="color:#2d2d2d;">Back to lessons &rarr;</a></span>
    </div>
  `);
});
