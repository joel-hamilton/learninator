import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { lessonPage } from "../views/lesson.js";
import {
  lessonActionBar,
  completedLessonBar,
  generationPollingBar,
  generationRunningBar,
  generationDoneBar,
  generationErrorBar,
  generationMissingBar,
  chatMessageBubble,
  feedbackThanksBar,
  feedbackModal,
  regenerationPollingBar,
  regenerationRunningBar,
  regenerationDoneBar,
  regenerationErrorBar,
  bridgingPollingBar,
  bridgingRunningBar,
  bridgingDoneBar,
  bridgingErrorBar,
} from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { saveMessage } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { AIError } from "../ai/index.js";
import { validateFeedback, validateNotes, rateLimitedFragment } from "../security/index.js";
import { buildJobKey } from "../lessons/generator.js";

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

function lessonIdStr(number: number, subNumber: number | null): string {
  return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
}

// ── GET lesson ──

lessonRoutes.get("/:number", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  if (lesson.status === "active") {
    await store.updateLessonStatus(missionId, number, subNumber, "in_progress");
  }

  const allLessons = await store.listLessonSummaries(missionId);

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
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const rating = String(body.rating || "");
  const feedbackText = String(body.feedbackText || "").trim();
  if (feedbackText.length > 2000) return c.text("Feedback too long (max 2,000 characters)", 400);

  const fbErr = validateFeedback(feedbackText);
  if (fbErr) return c.html(fbErr);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  await store.updateLessonFeedback(missionId, number, subNumber, rating, feedbackText || undefined);

  return c.html(feedbackThanksBar(rating, missionId, number, subNumber));
});

// ── Mark incomplete ──

lessonRoutes.post("/:number/incomplete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  await store.updateLessonStatus(missionId, number, subNumber, "in_progress", null);

  return c.html(lessonActionBar(missionId, number, subNumber));
});

// ── Mark complete ──

lessonRoutes.post("/:number/complete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  if (lesson.status !== "completed") {
    await store.updateLessonStatus(missionId, number, subNumber, "completed", new Date().toISOString());
  }

  return c.html(completedLessonBar(missionId, number, subNumber));
});

// ── Feedback modal ──

lessonRoutes.get("/:number/feedback-modal", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const mode = (c.req.query("mode") || "next") as "next" | "more";

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  return c.html(feedbackModal({
    missionId,
    number,
    subNumber,
    lessonTitle: lesson.title,
    mode,
  }));
});

// ── Generation routes (delegate to LessonGenerator) ──

function renderJobStatus(
  c: Ctx,
  kind: "next" | "sub" | "regenerate" | "bridge",
): Response {
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const generator = c.get("lessonGenerator");
  const key = buildJobKey(missionId, number, subNumber, kind);
  const status = generator.getJobStatus(key);

  if (status.status === "not_found") {
    return c.html(generationMissingBar(missionId));
  }
  if (status.status === "error") {
    if (kind === "regenerate") return c.html(regenerationErrorBar(missionId, status.error));
    if (kind === "bridge") return c.html(bridgingErrorBar(missionId, status.error));
    return c.html(generationErrorBar(missionId, status.error));
  }
  if (status.status === "done") {
    if (kind === "regenerate") {
      return c.html(regenerationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle));
    }
    if (kind === "bridge") {
      return c.html(bridgingDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle));
    }
    return c.html(generationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle));
  }

  // running
  if (kind === "regenerate") {
    return c.html(regenerationRunningBar(missionId, number, subNumber, status.message));
  }
  if (kind === "bridge") {
    return c.html(bridgingRunningBar(missionId, number, subNumber, status.message));
  }
  const isSub = kind === "sub";
  return c.html(generationRunningBar(missionId, number, subNumber, isSub, status.message));
}

lessonRoutes.post("/:number/generate-next", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const notes = String(body.notes || "").trim();
  const feedback = String(body.feedback || "").trim();

  const notesErr = validateNotes(notes);
  if (notesErr) return c.html(notesErr);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  if (feedback) {
    await store.updateLessonFeedback(missionId, number, subNumber, lesson.feedbackRating || "just_right", feedback);
  }

  const generator = c.get("lessonGenerator");
  generator.generateNext(
    missionId,
    { number, subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
    { feedback: feedback || undefined, notes: notes || undefined },
  );

  return c.html(generationPollingBar(missionId, number, subNumber, false));
});

lessonRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "next");
});

// ── Generate sub-lesson ──

lessonRoutes.post("/:number/generate-sub-lesson", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const generator = c.get("lessonGenerator");
  generator.generateSubLesson(
    missionId,
    { number, subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
  );

  return c.html(generationPollingBar(missionId, number, subNumber, true));
});

lessonRoutes.get("/:number/generate-sub-lesson/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "sub");
});

// ── Regenerate (in-place difficulty adjustment) ──

lessonRoutes.post("/:number/regenerate", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const direction = String(body.direction || "");
  if (direction !== "harder" && direction !== "easier") {
    return c.text("Invalid direction", 400);
  }

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);
  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  const generator = c.get("lessonGenerator");
  generator.generateRegenerate(
    missionId,
    { number, subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
    direction,
  );

  return c.html(regenerationPollingBar(missionId, number, subNumber));
});

lessonRoutes.get("/:number/regenerate/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "regenerate");
});

// ── Bridging sub-lesson ──

lessonRoutes.post("/:number/generate-bridging", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);
  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  const generator = c.get("lessonGenerator");
  generator.generateBridging(
    missionId,
    { number, subNumber, title: lesson.title },
    { title: mission.title, status: mission.status },
  );

  return c.html(bridgingPollingBar(missionId, number, subNumber));
});

lessonRoutes.get("/:number/generate-bridging/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "bridge");
});

// ── Lesson chat ──

lessonRoutes.post("/:number/chat", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const lessonTitle = String(body.lesson_title || "");
  const lessonNumber = String(body.lesson_number || "");
  if (!message) return c.text("");
  if (message.length > 10000) return c.text("Message too long", 400);

  const mission = await store.getMission(missionId, user.id);
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
  await saveMessage(store, missionId, "user", `[Re: Lesson ${lessonNumber}: ${lessonTitle}]\n${message}`);

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
      hooks: createStandardHooks({ missionId, store }),
    });

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text || "Let me think about that…"), userInitial(user)));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:var(--danger);">${msg}</div>`);
  }
});
