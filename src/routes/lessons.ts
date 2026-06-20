import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import {
  AIError,
  conversationLoop,
  createStandardHooks,
  TEACHER_SYSTEM_PROMPT,
  TEACHER_TOOLS,
} from "../ai/index.js";
import { lessonPage } from "../views/lesson.js";
import {
  lessonActionBar,
  completedLessonBar,
  chatMessageBubble,
  feedbackThanksBar,
  feedbackModal,
  generationRunningBar,
  generationDoneBar,
  generationErrorBar,
  regenerationRunningBar,
  regenerationDoneBar,
  regenerationErrorBar,
  bridgingRunningBar,
  bridgingDoneBar,
  bridgingErrorBar,
} from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { formatMarkdown } from "../shared/markdown.js";
import { parseLessonParam } from "../shared/lesson-numbers.js";
import { computeLessonNavigation } from "../view-models/lesson-navigation.js";
import { validateFeedback, validateNotes, rateLimitedFragment } from "../security/index.js";
import { buildJobKey, type LessonGenerator } from "../lessons/generator.js";
import { lessonGenerationRoutes } from "./lesson-generation.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const lessonRoutes = new Hono<{ Variables: AppVariables }>();

// ── Sub-routers ──────────────────────────────────────────────────────
lessonRoutes.route("/", lessonGenerationRoutes);

// ── GET lesson ──

/** Check for a running/done/errored generation job so the bar survives page reload. */
function resolveGenerationBar(
  generator: LessonGenerator,
  missionId: number,
  number: number,
  subNumber: number | null,
): string | null {
  const checks = [
    { kind: "next" as const, isSub: false },
    { kind: "sub" as const, isSub: true },
    { kind: "regenerate" as const },
    { kind: "bridge" as const },
  ];

  for (const { kind, isSub } of checks) {
    const key = buildJobKey(missionId, number, subNumber, kind);
    const status = generator.getJobStatus(key);
    if (status.status === "not_found") continue;

    if (kind === "regenerate") {
      if (status.status === "running") return regenerationRunningBar(missionId, number, subNumber, status.message);
      if (status.status === "done") return regenerationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle);
      return regenerationErrorBar(missionId, status.error);
    }
    if (kind === "bridge") {
      if (status.status === "running") return bridgingRunningBar(missionId, number, subNumber, status.message);
      if (status.status === "done") return bridgingDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle);
      return bridgingErrorBar(missionId, status.error);
    }
    // next or sub
    if (status.status === "running") return generationRunningBar(missionId, number, subNumber, !!isSub, status.message);
    if (status.status === "done") return generationDoneBar(missionId, status.lessonNumber, status.lessonSubNumber, status.lessonTitle);
    return generationErrorBar(missionId, status.error);
  }

  return null;
}

lessonRoutes.get("/:number", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const lesson = await store.getLesson(missionId, number, subNumber);
  if (!lesson) return c.text("Lesson not found", 404);

  if (lesson.status === "active") {
    await store.updateLessonStatus(missionId, number, subNumber, "in_progress");
  }

  const allLessons = await store.listLessonSummaries(missionId);

  const { prevLesson, nextLesson } = computeLessonNavigation(allLessons, number, subNumber);

  const generator = c.get("lessonGenerator");
  const generationBarHtml = resolveGenerationBar(generator, missionId, number, subNumber);

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
    generationBarHtml,
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  await store.updateLessonFeedback(missionId, number, subNumber, rating, feedbackText || undefined);

  return c.html(feedbackThanksBar(rating, missionId, number, subNumber, feedbackText || undefined));
});

// ── Mark incomplete ──

lessonRoutes.post("/:number/incomplete", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message,
      missionTitle: mission.title,
      missionStatus: mission.status,
      lesson: { number: lessonNumber, title: lessonTitle },
    });

    return c.html(chatMessageBubble("assistant", formatMarkdown(result.text || "Let me think about that…"), userInitial(user)));
  } catch (err: unknown) {
    const msg = err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:var(--danger);"><strong>${msg}</strong></div>`);
  }
});
