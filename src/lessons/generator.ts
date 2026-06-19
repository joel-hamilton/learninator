import { conversationLoop } from "../ai/conversation.js";
import type { ConversationLoopParams } from "../ai/conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS, getRegenerateSystemPrompt, getBridgingSystemPrompt } from "../ai/teacher.js";
import { TOOL_DISPLAY_NAMES } from "../ai/tools.js";
import type { EventBus } from "../ai/events.js";
import { eq, and, isNull, desc } from "drizzle-orm";
import * as schema from "../db/schema.js";
import type { AiClient, AiMessageParam, ToolExecutor } from "../ai/types.js";
import type { Logger } from "../logger.js";

// ── Public types ──

export type JobStatus =
  | { status: "running"; message: string }
  | { status: "done"; lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string }
  | { status: "error"; error: string }
  | { status: "not_found" };

export interface Deps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  db: any;
  logger: Logger;
  events?: EventBus;
}

// ── Internal types ──

interface InternalJob {
  status: "running" | "done" | "error";
  messages: string[];
  result: {
    lessonNumber: number;
    lessonSubNumber: number | null;
    lessonTitle: string;
  } | null;
  error: string | null;
}

// ── Key helpers ──

export function buildJobKey(
  missionId: number,
  number: number,
  subNumber: number | null,
  type: "next" | "sub" | "regenerate" | "bridge",
): string {
  return `${type}-${missionId}-${number}-${subNumber ?? "m"}`;
}

// ── LessonGenerator ──

export class LessonGenerator {
  private jobs = new Map<string, InternalJob>();
  private deps: Deps;

  constructor(deps: Deps) {
    this.deps = deps;
  }

  /**
   * Start a background job to generate the next lesson.
   * Returns a job key that can be passed to getJobStatus() for polling.
   */
  generateNext(
    missionId: number,
    lesson: { number: number; subNumber: number | null; title: string },
    mission: { title: string; status: string },
    opts?: { feedback?: string; notes?: string },
  ): string {
    const key = buildJobKey(missionId, lesson.number, lesson.subNumber, "next");
    if (this.jobs.has(key)) return key;

    const job: InternalJob = {
      status: "running",
      messages: ["Starting…"],
      result: null,
      error: null,
    };
    this.jobs.set(key, job);

    const { db, logger } = this.deps;

    (async () => {
      try {
        const displayNum = this.formatLessonNumber(
          lesson.number,
          lesson.subNumber,
        );
        let userMessage = `The user just completed Lesson ${displayNum}: "${lesson.title}". Please create the next logical lesson.`;
        if (opts?.feedback) {
          userMessage += `\n\nThe user gave this feedback on the lesson: ${opts.feedback}`;
        }
        if (opts?.notes) {
          userMessage += `\n\nThe user requested the next lesson cover: ${opts.notes}`;
        }
        userMessage += `\n\nReview what's been covered so far (use list_lessons and read references). Create the next main lesson using create_lesson. Do NOT use create_sub_lesson.`;

        const systemPrompt =
          TEACHER_SYSTEM_PROMPT +
          [
            "",
            `The current mission ID is ${missionId}.`,
            `Mission title: ${mission.title}`,
            `Mission status: ${mission.status}`,
            "",
            `You are creating the next main lesson after Lesson ${displayNum}: "${lesson.title}". ALWAYS call list_feedback_history first to check past difficulty ratings — this is required. Then review existing lessons to understand what's been covered. Calibrate difficulty based on the student's feedback pattern: multiple "too_hard" ratings → use simpler language, more scaffolding, smaller steps; multiple "too_easy" ratings → increase depth, add advanced material; mixed ratings → maintain current difficulty. ALWAYS use create_lesson for a NEW main lesson. Do NOT use create_sub_lesson — this action is reserved for "Dive Deeper".`,
          ].join("\n");

        await this.runConversation(missionId, job, systemPrompt, [
          { role: "user" as const, content: userMessage },
        ]);

        // Find the most recently created lesson for this mission
        const [latestLesson] = await db
          .select({
            id: schema.lessons.id,
            number: schema.lessons.number,
            subNumber: schema.lessons.subNumber,
            title: schema.lessons.title,
          })
          .from(schema.lessons)
          .where(eq(schema.lessons.missionId, missionId))
          .orderBy(desc(schema.lessons.id))
          .limit(1);

        if (
          latestLesson &&
          (latestLesson.number !== lesson.number ||
            latestLesson.subNumber !== lesson.subNumber)
        ) {
          job.result = {
            lessonNumber: latestLesson.number,
            lessonSubNumber: latestLesson.subNumber,
            lessonTitle: latestLesson.title,
          };
        }
        job.status = "done";
      } catch (err: unknown) {
        job.status = "error";
        job.error =
          err instanceof Error ? err.message : "Something went wrong.";
        logger.error("generate-next failed:", job.error);
      } finally {
        setTimeout(() => this.jobs.delete(key), 60_000);
      }
    })();

    return key;
  }

  /**
   * Start a background job to generate a sub-lesson.
   * Returns a job key that can be passed to getJobStatus() for polling.
   */
  generateSubLesson(
    missionId: number,
    lesson: { number: number; subNumber: number | null; title: string },
    mission: { title: string; status: string },
  ): string {
    const key = buildJobKey(missionId, lesson.number, lesson.subNumber, "sub");
    if (this.jobs.has(key)) return key;

    const job: InternalJob = {
      status: "running",
      messages: ["Starting…"],
      result: null,
      error: null,
    };
    this.jobs.set(key, job);

    const { db, logger } = this.deps;

    (async () => {
      try {
        const displayNum = this.formatLessonNumber(
          lesson.number,
          lesson.subNumber,
        );
        const userMessage = `The user wants to go deeper on Lesson ${displayNum}: "${lesson.title}". Please create a sub-lesson that covers related material, a deeper dive, or clarification on the same topic. Use create_sub_lesson with parent_lesson_number: ${lesson.number}.`;

        const systemPrompt =
          TEACHER_SYSTEM_PROMPT +
          [
            "",
            `The current mission ID is ${missionId}.`,
            `Mission title: ${mission.title}`,
            `Mission status: ${mission.status}`,
            "",
            `You are creating a sub-lesson of Lesson ${displayNum}: "${lesson.title}". ALWAYS call list_feedback_history first to check past difficulty ratings — this is required. Then review existing lessons to understand what has been covered. Calibrate difficulty based on the student's feedback pattern: multiple "too_hard" ratings → use simpler language, more scaffolding, smaller steps; multiple "too_easy" ratings → increase depth, add advanced material; mixed ratings → maintain current difficulty. Use create_sub_lesson.`,
          ].join("\n");

        await this.runConversation(missionId, job, systemPrompt, [
          { role: "user" as const, content: userMessage },
        ]);

        const [latestLesson] = await db
          .select({
            id: schema.lessons.id,
            number: schema.lessons.number,
            subNumber: schema.lessons.subNumber,
            title: schema.lessons.title,
          })
          .from(schema.lessons)
          .where(eq(schema.lessons.missionId, missionId))
          .orderBy(desc(schema.lessons.id))
          .limit(1);

        if (
          latestLesson &&
          (latestLesson.number !== lesson.number ||
            latestLesson.subNumber !== lesson.subNumber)
        ) {
          job.result = {
            lessonNumber: latestLesson.number,
            lessonSubNumber: latestLesson.subNumber,
            lessonTitle: latestLesson.title,
          };
        }
        job.status = "done";
      } catch (err: unknown) {
        job.status = "error";
        job.error =
          err instanceof Error ? err.message : "Something went wrong.";
        logger.error("generate-sub-lesson failed:", job.error);
      } finally {
        setTimeout(() => this.jobs.delete(key), 60_000);
      }
    })();

    return key;
  }

  /**
   * Start a background job to regenerate a lesson at a different difficulty.
   */
  generateRegenerate(
    missionId: number,
    lesson: { number: number; subNumber: number | null; title: string },
    mission: { title: string; status: string },
    direction: "harder" | "easier",
  ): string {
    const key = buildJobKey(missionId, lesson.number, lesson.subNumber, "regenerate");
    if (this.jobs.has(key)) return key;

    const job: InternalJob = {
      status: "running",
      messages: ["Starting…"],
      result: null,
      error: null,
    };
    this.jobs.set(key, job);

    const { db, logger } = this.deps;

    (async () => {
      try {
        const systemPrompt = getRegenerateSystemPrompt({
          missionId,
          missionTitle: mission.title,
          lessonNumber: lesson.number,
          lessonTitle: lesson.title,
          direction,
        });

        const displayNum = this.formatLessonNumber(lesson.number, lesson.subNumber);
        const userMessage = `Please regenerate Lesson ${displayNum}: "${lesson.title}". The student rated it as ${direction === "harder" ? "too easy" : "too hard"}. Read the current lesson content, check feedback history, then use regenerate_lesson to rewrite it at an ${direction === "harder" ? "more challenging" : "easier"} level.`;

        await this.runConversation(missionId, job, systemPrompt, [
          { role: "user" as const, content: userMessage },
        ]);

        // Lesson was regenerated in-place — reference it by number
        const conditions = [
          eq(schema.lessons.missionId, missionId),
          eq(schema.lessons.number, lesson.number),
        ];
        if (lesson.subNumber !== null) {
          conditions.push(eq(schema.lessons.subNumber, lesson.subNumber));
        } else {
          conditions.push(isNull(schema.lessons.parentLessonId));
        }

        const [found] = await db
          .select({
            number: schema.lessons.number,
            subNumber: schema.lessons.subNumber,
            title: schema.lessons.title,
          })
          .from(schema.lessons)
          .where(and(...conditions))
          .limit(1);

        if (found) {
          job.result = {
            lessonNumber: found.number,
            lessonSubNumber: found.subNumber,
            lessonTitle: found.title,
          };
        }
        job.status = "done";
      } catch (err: unknown) {
        job.status = "error";
        job.error = err instanceof Error ? err.message : "Something went wrong.";
        logger.error("regenerate failed:", job.error);
      } finally {
        setTimeout(() => this.jobs.delete(key), 60_000);
      }
    })();

    return key;
  }

  /**
   * Start a background job to create a bridging sub-lesson.
   */
  generateBridging(
    missionId: number,
    lesson: { number: number; subNumber: number | null; title: string },
    mission: { title: string; status: string },
  ): string {
    const key = buildJobKey(missionId, lesson.number, lesson.subNumber, "bridge");
    if (this.jobs.has(key)) return key;

    const job: InternalJob = {
      status: "running",
      messages: ["Starting…"],
      result: null,
      error: null,
    };
    this.jobs.set(key, job);

    const { db, logger } = this.deps;

    (async () => {
      try {
        const systemPrompt = getBridgingSystemPrompt({
          missionId,
          missionTitle: mission.title,
          lessonNumber: lesson.number,
          lessonTitle: lesson.title,
        });

        const displayNum = this.formatLessonNumber(lesson.number, lesson.subNumber);
        const messages = [{ role: "user" as const, content: `Create a bridging sub-lesson for Lesson ${displayNum}: "${lesson.title}". The student found it too hard and needs prerequisite content before they can succeed with the main lesson.` }];

        await this.runConversation(missionId, job, systemPrompt, messages);

        // Find the newly created sub-lesson
        const [latestLesson] = await db
          .select({
            id: schema.lessons.id,
            number: schema.lessons.number,
            subNumber: schema.lessons.subNumber,
            title: schema.lessons.title,
          })
          .from(schema.lessons)
          .where(eq(schema.lessons.missionId, missionId))
          .orderBy(desc(schema.lessons.id))
          .limit(1);

        if (
          latestLesson &&
          (latestLesson.number !== lesson.number ||
            latestLesson.subNumber !== lesson.subNumber)
        ) {
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
        logger.error("generate-bridging failed:", job.error);
      } finally {
        setTimeout(() => this.jobs.delete(key), 60_000);
      }
    })();

    return key;
  }

  /**
   * Poll the status of a generation job by key.
   * Consumes terminal states: once "done" or "error" is returned,
   * the job is removed from internal storage.
   */
  getJobStatus(key: string): JobStatus {
    const job = this.jobs.get(key);
    if (!job) return { status: "not_found" };

    if (job.status === "error") {
      this.jobs.delete(key);
      return { status: "error", error: job.error || "Something went wrong." };
    }

    if (job.status === "done") {
      this.jobs.delete(key);
      if (job.result) {
        return {
          status: "done",
          lessonNumber: job.result.lessonNumber,
          lessonSubNumber: job.result.lessonSubNumber,
          lessonTitle: job.result.lessonTitle,
        };
      }
    }

    return { status: "running", message: job.messages.at(-1) || "Working…" };
  }

  // ── Private ──

  /**
   * Common conversation loop with hooks that update job messages and emit events.
   */
  private async runConversation(
    missionId: number,
    job: InternalJob,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
  ): Promise<void> {
    const { ai, toolExecutor } = this.deps;
    let pendingToolNames: string[] = [];

    await conversationLoop({
      client: ai,
      toolExecutor,
      missionId,
      systemPrompt,
      initialMessages,
      tools: TEACHER_TOOLS,
      hooks: {
        onBeforeToolExecution: async (toolUseBlocks) => {
          pendingToolNames = [];
          for (const block of toolUseBlocks) {
            const label = this.toolLabel(
              block.name,
              block.input as Record<string, unknown> | undefined,
            );
            job.messages.push(label);
            pendingToolNames.push(
              TOOL_DISPLAY_NAMES[block.name] || block.name,
            );
          }
          this.deps.events?.emit(missionId, { type: "tool_start", names: pendingToolNames });
        },
        onAfterToolExecution: async (_results) => {
          this.deps.events?.emit(missionId, { type: "tool_end", names: pendingToolNames });
        },
        onTruncated: async () => {
          job.messages.push("Response was cut short…");
        },
      },
    });
  }

  private formatLessonNumber(
    number: number,
    subNumber: number | null,
  ): string {
    const base = String(number).padStart(4, "0");
    return subNumber !== null ? `${base}.${subNumber}` : base;
  }

  private toolLabel(
    name: string,
    input: Record<string, unknown> | undefined,
  ): string {
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
      case "create_sub_lesson":
        return `Writing sub-lesson: ${input?.title || "new sub-lesson"}…`;
      case "create_reference_doc":
        return `Creating reference: ${input?.title || "new doc"}…`;
      case "read_mission_content":
        return "Reading mission notes…";
      case "list_feedback_history":
        return "Checking feedback history…";
      case "regenerate_lesson":
        return `Regenerating lesson: ${input?.title || ""}…`;
      default:
        return `Working (${name.replace(/_/g, " ")})…`;
    }
  }
}

export function createLessonGenerator(deps: Deps): LessonGenerator {
  return new LessonGenerator(deps);
}
