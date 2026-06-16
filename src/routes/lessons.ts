import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop } from "../ai/conversation.js";
import { LessonGenerator, buildJobKey } from "../lessons/generator.js";
import { lessonPage } from "../views/lesson.js";
import { lessonActionBar, completedLessonBar, generationPollingBar, generationRunningBar, generationDoneBar, generationErrorBar, generationMissingBar, chatMessageBubble, feedbackThanksBar, feedbackModal } from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { saveMessage, contentToText } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { AIError } from "../ai/index.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const lessonRoutes = new Hono<{ Variables: AppVariables }>();

// ── Helpers ──────────────────────────────────────────────────────────

function parseLessonParam(param: string): { number: number; subNumber: number | null } {
  const parts = param.split(".");
  return {
    number: parseInt(parts[0], 10),
    subNumber: parts.length > 1 ? parseInt(parts[1], 10) : null,
  };
}

function formatLessonNumber(number: number, subNumber: number | null): string {
  const base = String(number).padStart(4, "0");
  return subNumber !== null ? `${base}.${subNumber}` : base;
}

function lessonIdStr(number: number, subNumber: number | null): string {
  return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
}

function lessonUrl(missionId: number, number: number, subNumber: number | null): string {
  return `/missions/${missionId}/lessons/${lessonIdStr(number, subNumber)}`;
}

// ── GET lesson ──

lessonRoutes.get("/:number", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  if (lesson.status === "active") {
    await db
      .update(schema.lessons)
      .set({ status: "in_progress" })
      .where(eq(schema.lessons.id, lesson.id));
  }

  const allLessons = await db
    .select({
      number: schema.lessons.number,
      subNumber: schema.lessons.subNumber,
      title: schema.lessons.title,
      slug: schema.lessons.slug,
      status: schema.lessons.status,
    })
    .from(schema.lessons)
    .where(eq(schema.lessons.missionId, missionId))
    .orderBy(asc(schema.lessons.number), asc(schema.lessons.subNumber));

  const currentIndex = allLessons.findIndex(
    (l) => l.number === number && l.subNumber === subNumber
  );
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : undefined;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : undefined;

  return c.html(lessonPage({
    missionId,
    missionTitle: mission.title,
    lessonNumber: number,
    lessonSubNumber: lesson.subNumber,
    lessonTitle: lesson.title,
    lessonStatus: lesson.status,
    lessonHtmlContent: lesson.htmlContent,
    prevLesson,
    nextLesson,
  }));
});

// ── Feedback ──

lessonRoutes.post("/:number/feedback", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const rating = String(body.rating || "");
  const feedbackText = String(body.feedbackText || "").trim();

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const updateData: Record<string, unknown> = { feedbackRating: rating as "too_easy" | "just_right" | "too_hard" };
  if (feedbackText) {
    updateData.feedbackText = feedbackText;
  }

  await db
    .update(schema.lessons)
    .set(updateData)
    .where(and(...conditions));

  return c.html(feedbackThanksBar(rating, missionId, number, subNumber));
});

// ── Mark incomplete ──

lessonRoutes.post("/:number/incomplete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  await db
    .update(schema.lessons)
    .set({ status: "in_progress", completedAt: null })
    .where(and(...conditions));

  return c.html(lessonActionBar(missionId, number, subNumber));
});

// ── Mark complete ──

lessonRoutes.post("/:number/complete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  if (lesson.status !== "completed") {
    await db
      .update(schema.lessons)
      .set({ status: "completed", completedAt: new Date().toISOString() })
      .where(and(...conditions));
  }

  return c.html(completedLessonBar(missionId, number, subNumber));
});

// ── Feedback modal ──

lessonRoutes.get("/:number/feedback-modal", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const mode = (c.req.query("mode") || "next") as "next" | "more";

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  return c.html(feedbackModal({
    missionId,
    number,
    subNumber,
    lessonTitle: lesson.title,
    mode,
  }));
});

// ── LessonGenerator (lazy singleton) ──
let _generator: LessonGenerator | null = null;

function initGenerator(c: Ctx): LessonGenerator {
  if (!_generator) {
    _generator = new LessonGenerator({
      ai: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      db,
      logger: c.get("logger"),
    });
  }
  return _generator;
}

lessonRoutes.post("/:number/generate-next", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const notes = String(body.notes || "").trim();
  const feedback = String(body.feedback || "").trim();

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  // Save feedback text if provided
  if (feedback) {
    await db
      .update(schema.lessons)
      .set({ feedbackText: feedback })
      .where(and(...conditions));
  }

  const generator = initGenerator(c);
  generator.generateNext(
    missionId,
    { number: lesson.number, subNumber: lesson.subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
    { feedback, notes },
  );

  return c.html(generationPollingBar(missionId, number, subNumber, false));
});

lessonRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const key = buildJobKey(missionId, number, subNumber, "next");
  const generator = initGenerator(c);
  const status = generator.getJobStatus(key);

  if (status.status === "not_found") {
    return c.html(generationMissingBar(missionId));
  }

  if (status.status === "error") {
    return c.html(generationErrorBar(missionId, status.error));
  }

  if (status.status === "done") {
    return c.html(generationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle));
  }

  return c.html(generationRunningBar(missionId, number, subNumber, false, status.message));
});

// ── Generate sub-lesson ──

lessonRoutes.post("/:number/generate-sub-lesson", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const conditions = [
    eq(schema.lessons.missionId, missionId),
    eq(schema.lessons.number, number),
  ];
  if (subNumber !== null) {
    conditions.push(eq(schema.lessons.subNumber, subNumber));
  } else {
    conditions.push(isNull(schema.lessons.parentLessonId));
  }

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(...conditions))
    .limit(1);
  if (!lesson) return c.text("Lesson not found", 404);

  const generator = initGenerator(c);
  generator.generateSubLesson(
    missionId,
    { number: lesson.number, subNumber: lesson.subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
  );

  return c.html(generationPollingBar(missionId, number, subNumber, true));
});

lessonRoutes.get("/:number/generate-sub-lesson/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const key = buildJobKey(missionId, number, subNumber, "sub");
  const generator = initGenerator(c);
  const status = generator.getJobStatus(key);

  if (status.status === "not_found") {
    return c.html(generationMissingBar(missionId));
  }

  if (status.status === "error") {
    return c.html(generationErrorBar(missionId, status.error));
  }

  if (status.status === "done") {
    return c.html(generationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle));
  }

  return c.html(generationRunningBar(missionId, number, subNumber, true, status.message));
});

// ── Lesson chat ──

lessonRoutes.post("/:number/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const lessonTitle = String(body.lesson_title || "");
  const lessonNumber = String(body.lesson_number || "");
  if (!message) return c.text("");

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}

The user is currently viewing Lesson ${lessonNumber}: "${lessonTitle}". They may ask you to:
- Explain concepts from this lesson in more detail
- Provide examples or practice exercises related to this lesson
- Create the next lesson or a sub-lesson that builds on this material

If they ask for a new lesson, use create_lesson or create_sub_lesson as appropriate. Review existing lessons first to avoid duplicates.`;

  // Store user message in the shared mission chat
  await saveMessage(missionId, "user", `[Re: Lesson ${lessonNumber}: ${lessonTitle}]\n${message}`);

  try {
    const result = await conversationLoop({
      client: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      missionId,
      systemPrompt,
      initialMessages: [
        { role: "user" as const, content: `[The user is on Lesson ${lessonNumber}: "${lessonTitle}". They said:] ${message}` },
      ],
      tools: TEACHER_TOOLS,
      hooks: {
        onAssistantMessage: async (content) => {
          await saveMessage(missionId, "assistant", content);
        },
        onAfterToolExecution: async (results) => {
          await saveMessage(missionId, "user", results);
        },
      },
    });

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text || "Let me think about that…"), userInitial(user)));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:var(--danger);">${msg}</div>`);
  }
});
