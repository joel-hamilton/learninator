import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc, desc } from "drizzle-orm";
import type { AppVariables } from "../types.js";
import { ai } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { executeToolCalls } from "../ai/tools.js";
import type Anthropic from "@anthropic-ai/sdk";
import { lessonPage } from "../views/lesson.js";
import { feedbackThanksBar, completeBar, generationPollingBar, generationRunningBar, generationDoneBar, generationErrorBar, generationMissingBar } from "../views/fragments.js";

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

  if (lesson.status === "active") {
    await db
      .update(schema.lessons)
      .set({ status: "in_progress" })
      .where(
        and(
          eq(schema.lessons.missionId, missionId),
          eq(schema.lessons.number, number)
        )
      );
  }

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

  return c.html(lessonPage({
    missionId,
    missionTitle: mission.title,
    lessonNumber: number,
    lessonTitle: lesson.title,
    lessonHtmlContent: lesson.htmlContent,
    feedbackRating: lesson.feedbackRating,
    feedbackText: lesson.feedbackText,
    prevLesson,
    nextLesson,
  }));
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

  return c.html(feedbackThanksBar(rating, missionId, number));
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

  return c.html(completeBar(alreadyCompleted, missionId, number));
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
  return c.html(generationPollingBar(missionId, number));
});

lessonRoutes.get("/:number/generate-next/status", auth.requireAuth, (c: Ctx) => {
  const missionId = parseInt(c.req.param("missionId")!);
  const number = parseInt(c.req.param("number")!);
  const key = jobKey(missionId, number);
  const job = generationJobs.get(key);

  if (!job) {
    // Job gone (expired or never existed) — fall back to checking if a new lesson exists
    return c.html(generationMissingBar(missionId));
  }

  if (job.status === "error") {
    generationJobs.delete(key);
    return c.html(generationErrorBar(missionId, job.error || "Something went wrong."));
  }

  if (job.status === "done" && job.result) {
    generationJobs.delete(key);
    return c.html(generationDoneBar(missionId, job.result.lessonNumber, job.result.lessonTitle));
  }

  // Still running — show latest progress
  const latestMsg = job.messages.at(-1) || "Working…";
  return c.html(generationRunningBar(missionId, number, latestMsg));
});
