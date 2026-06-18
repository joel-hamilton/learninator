import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { TOOL_DISPLAY_NAMES } from "../ai/tools.js";
import { lessonPage } from "../views/lesson.js";
import { lessonActionBar, completedLessonBar, generationPollingBar, generationRunningBar, generationDoneBar, generationErrorBar, generationMissingBar, chatMessageBubble, feedbackThanksBar, feedbackModal } from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { saveMessage, contentToText } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { AIError } from "../ai/index.js";
import { validateFeedback, validateNotes, rateLimitedFragment } from "../security/index.js";
import type { MissionStore } from "../db/store.js";

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

// ── In-memory tracking for generation jobs ──
type GenerationJob = {
  missionId: number;
  completedLessonNumber: number;
  completedSubNumber: number | null;
  status: "running" | "done" | "error";
  messages: string[];
  result: { lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string } | null;
  error: string | null;
};
const generationJobs = new Map<string, GenerationJob>();

function jobKey(missionId: number, number: number, subNumber: number | null, type: "next" | "sub" = "next") {
  return `${missionId}-${number}-${subNumber ?? "m"}-${type}`;
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

  // Save feedback text if provided
  if (feedback) {
    await store.updateLessonFeedback(missionId, number, subNumber, lesson.feedbackRating || "just_right", feedback);
  }

  const key = jobKey(missionId, number, subNumber, "next");
  if (generationJobs.has(key)) {
    return c.html(`<div class="feedback-bar" id="feedback-bar"><span class="label">Already generating your next lesson…</span></div>`);
  }

  const job: GenerationJob = {
    missionId,
    completedLessonNumber: number,
    completedSubNumber: subNumber,
    status: "running",
    messages: ["Starting…"],
    result: null,
    error: null,
  };
  generationJobs.set(key, job);

  const log = c.get("logger");
  const capturedAi = c.get("ai");
  const capturedToolExecutor = c.get("toolExecutor");
  const events = c.get("events");
  (async () => {
    try {
      const displayNum = formatLessonNumber(number, subNumber);
      let userMessage = `The user just completed Lesson ${displayNum}: "${lesson.title}". Please create the next logical lesson.`;
      if (feedback) {
        userMessage += `\n\nThe user gave this feedback on the lesson: ${feedback}`;
      }
      if (notes) {
        userMessage += `\n\nThe user requested the next lesson cover: ${notes}`;
      }
      userMessage += `\n\nReview what's been covered so far (use list_lessons and read references). Decide whether the next step is a new topic (use create_lesson) or a same-topic follow-up / deeper dive (use create_sub_lesson with parent_lesson_number: ${number}).`;

      const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}
Mission status: ${mission.status}

You are creating the next lesson after Lesson ${displayNum}: "${lesson.title}". Review existing lessons first to understand what's been covered. If this is a continuation of the same topic, use create_sub_lesson. If it's a genuinely new topic, use create_lesson.`;

      const messages = [
        { role: "user" as const, content: userMessage },
      ];

      let pendingToolNames: string[] = [];

      await conversationLoop({
        client: capturedAi,
        toolExecutor: capturedToolExecutor,
        missionId,
        systemPrompt,
        initialMessages: messages,
        tools: TEACHER_TOOLS,
        hooks: {
          onBeforeToolExecution: async (toolUseBlocks) => {
            pendingToolNames = toolUseBlocks.map((b) => TOOL_DISPLAY_NAMES[b.name] || b.name);
            job.messages.push(...pendingToolNames);
            events.emit(missionId, { type: "tool_start", names: pendingToolNames });
          },
          onAfterToolExecution: async (_results) => {
            events.emit(missionId, { type: "tool_end", names: pendingToolNames });
          },
          onTruncated: async () => {
            job.messages.push("Response was cut short…");
          },
        },
      });

      const latestLesson = await store.getLatestLesson(missionId);

      if (latestLesson && latestLesson.id !== lesson.id) {
        job.result = {
          lessonNumber: latestLesson.number,
          lessonSubNumber: latestLesson.subNumber,
          lessonTitle: latestLesson.title,
        };
      }
      job.status = "done";
    } catch (err: unknown) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Something went wrong.";
      log.error("generate-next failed:", job.error);
    } finally {
      setTimeout(() => generationJobs.delete(key), 60_000);
    }
  })();

  return c.html(generationPollingBar(missionId, number, subNumber, false));
});

lessonRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const key = jobKey(missionId, number, subNumber, "next");
  const job = generationJobs.get(key);

  if (!job) {
    return c.html(generationMissingBar(missionId));
  }

  if (job.status === "error") {
    generationJobs.delete(key);
    return c.html(generationErrorBar(missionId, job.error || "Something went wrong."));
  }

  if (job.status === "done" && job.result) {
    generationJobs.delete(key);
    return c.html(generationDoneBar(missionId, job.result.lessonNumber, job.result.lessonSubNumber, job.result.lessonTitle));
  }

  const latestMsg = job.messages.at(-1) || "Working…";
  return c.html(generationRunningBar(missionId, number, subNumber, false, latestMsg));
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

  const rateLimiterSub = c.get("rateLimiter");
  if (rateLimiterSub && !rateLimiterSub.check(user.id, "lesson_gen", 10, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const key = jobKey(missionId, number, subNumber, "sub");
  if (generationJobs.has(key)) {
    return c.html(`<div class="feedback-bar" id="feedback-bar"><span class="label">Already generating a sub-lesson…</span></div>`);
  }

  const job: GenerationJob = {
    missionId,
    completedLessonNumber: number,
    completedSubNumber: subNumber,
    status: "running",
    messages: ["Starting…"],
    result: null,
    error: null,
  };
  generationJobs.set(key, job);

  const log = c.get("logger");
  const capturedAi = c.get("ai");
  const capturedToolExecutor = c.get("toolExecutor");
  const events = c.get("events");
  (async () => {
    try {
      const displayNum = formatLessonNumber(number, subNumber);
      const userMessage = `The user wants to go deeper on Lesson ${displayNum}: "${lesson.title}". Please create a sub-lesson that covers related material, a deeper dive, or clarification on the same topic. Use create_sub_lesson with parent_lesson_number: ${number}.`;

      const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}
Mission status: ${mission.status}

You are creating a sub-lesson of Lesson ${displayNum}: "${lesson.title}". Review existing lessons first to understand what has been covered. Use create_sub_lesson.`;

      const messages = [{ role: "user" as const, content: userMessage }];

      let pendingToolNames: string[] = [];

      await conversationLoop({
        client: capturedAi,
        toolExecutor: capturedToolExecutor,
        missionId,
        systemPrompt,
        initialMessages: messages,
        tools: TEACHER_TOOLS,
        hooks: {
          onBeforeToolExecution: async (toolUseBlocks) => {
            pendingToolNames = toolUseBlocks.map((b) => TOOL_DISPLAY_NAMES[b.name] || b.name);
            job.messages.push(...pendingToolNames);
            events.emit(missionId, { type: "tool_start", names: pendingToolNames });
          },
          onAfterToolExecution: async (_results) => {
            events.emit(missionId, { type: "tool_end", names: pendingToolNames });
          },
          onTruncated: async () => {
            job.messages.push("Response was cut short…");
          },
        },
      });

      const latestLesson = await store.getLatestLesson(missionId);

      if (latestLesson && latestLesson.id !== lesson.id) {
        job.result = {
          lessonNumber: latestLesson.number,
          lessonSubNumber: latestLesson.subNumber,
          lessonTitle: latestLesson.title,
        };
      }
      job.status = "done";
    } catch (err: unknown) {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Something went wrong.";
      log.error("generate-sub-lesson failed:", job.error);
    } finally {
      setTimeout(() => generationJobs.delete(key), 60_000);
    }
  })();

  return c.html(generationPollingBar(missionId, number, subNumber, true));
});

lessonRoutes.get("/:number/generate-sub-lesson/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const { number, subNumber } = parseLessonParam(c.req.param("number")!);
  const key = jobKey(missionId, number, subNumber, "sub");
  const job = generationJobs.get(key);

  if (!job) {
    return c.html(generationMissingBar(missionId));
  }

  if (job.status === "error") {
    generationJobs.delete(key);
    return c.html(generationErrorBar(missionId, job.error || "Something went wrong."));
  }

  if (job.status === "done" && job.result) {
    generationJobs.delete(key);
    return c.html(generationDoneBar(missionId, job.result.lessonNumber, job.result.lessonSubNumber, job.result.lessonTitle));
  }

  const latestMsg = job.messages.at(-1) || "Working…";
  return c.html(generationRunningBar(missionId, number, subNumber, true, latestMsg));
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
