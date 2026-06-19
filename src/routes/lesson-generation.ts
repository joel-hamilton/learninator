import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import {
  generationPollingBar,
  generationRunningBar,
  generationDoneBar,
  generationErrorBar,
  generationMissingBar,
  regenerationPollingBar,
  regenerationRunningBar,
  regenerationDoneBar,
  regenerationErrorBar,
  bridgingPollingBar,
  bridgingRunningBar,
  bridgingDoneBar,
  bridgingErrorBar,
} from "../views/fragments.js";
import { validateNotes, rateLimitedFragment } from "../security/index.js";
import { buildJobKey } from "../lessons/generator.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const lessonGenerationRoutes = new Hono<{ Variables: AppVariables }>();

function parseLessonParam(param: string): { number: number; subNumber: number | null } {
  const parts = param.split(".");
  return {
    number: parseInt(parts[0], 10),
    subNumber: parts.length > 1 ? parseInt(parts[1], 10) : null,
  };
}

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

  if (kind === "regenerate") {
    return c.html(regenerationRunningBar(missionId, number, subNumber, status.message));
  }
  if (kind === "bridge") {
    return c.html(bridgingRunningBar(missionId, number, subNumber, status.message));
  }
  const isSub = kind === "sub";
  return c.html(generationRunningBar(missionId, number, subNumber, isSub, status.message));
}

lessonGenerationRoutes.post("/:number/generate-next", auth.requireAuth, async (c: Ctx) => {
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

lessonGenerationRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "next");
});

lessonGenerationRoutes.post("/:number/generate-sub-lesson", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

lessonGenerationRoutes.get("/:number/generate-sub-lesson/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "sub");
});

lessonGenerationRoutes.post("/:number/regenerate", auth.requireAuth, async (c: Ctx) => {
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

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

lessonGenerationRoutes.get("/:number/regenerate/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "regenerate");
});

lessonGenerationRoutes.post("/:number/generate-bridging", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
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

lessonGenerationRoutes.get("/:number/generate-bridging/status", auth.requireAuth, (c: Ctx) => {
  return renderJobStatus(c, "bridge");
});
