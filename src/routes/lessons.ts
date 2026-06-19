import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { lessonPage } from "../views/lesson.js";
import {
  lessonActionBar,
  completedLessonBar,
  chatMessageBubble,
  feedbackThanksBar,
  feedbackModal,
} from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { formatMarkdown } from "../shared/markdown.js";
import { formatAIError } from "../shared/errors.js";
import { requireMissionAccess } from "../shared/require-mission-access.js";
import { validateFeedback } from "../security/index.js";
import { lessonGenerationRoutes } from "./lesson-generation.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const lessonRoutes = new Hono<{ Variables: AppVariables }>();

// ── Sub-routers ──────────────────────────────────────────────────────
lessonRoutes.route("/", lessonGenerationRoutes);

// ── Helpers ──────────────────────────────────────────────────────────

function parseLessonParam(param: string): { number: number; subNumber: number | null } {
  const parts = param.split(".");
  return {
    number: parseInt(parts[0], 10),
    subNumber: parts.length > 1 ? parseInt(parts[1], 10) : null,
  };
}

// ── GET lesson ──

lessonRoutes.get("/:number", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const mission = await requireMissionAccess(store, missionId, user.id);
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

  const mission = await requireMissionAccess(store, missionId, user.id);
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

  const mission = await requireMissionAccess(store, missionId, user.id);
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

  const mission = await requireMissionAccess(store, missionId, user.id);
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

  const mission = await requireMissionAccess(store, missionId, user.id);
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

  const mission = await requireMissionAccess(store, missionId, user.id);
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
    const msg = formatAIError(err);
    return c.html(`<div class="msg assistant" style="color:var(--danger);"><strong>${msg}</strong></div>`);
  }
});
