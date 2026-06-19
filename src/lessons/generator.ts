import {
  conversationLoop,
  getBridgingSystemPrompt,
  getRegenerateSystemPrompt,
  TEACHER_SYSTEM_PROMPT,
  TEACHER_TOOLS,
  TOOL_DISPLAY_NAMES,
} from "../ai/index.js";
import type { AiClient, AiMessageParam, ToolExecutor } from "../ai/index.js";
import type { MissionStore, LessonStore } from "../db/store.js";
import type { EventBus } from "../ai/events.js";
import type { Logger } from "../logger.js";

// ── Public types ──

export type JobStatus =
  | { status: "running"; message: string }
  | { status: "done"; lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string }
  | { status: "error"; error: string }
  | { status: "not_found" };

export interface GeneratorDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & LessonStore;
  events?: EventBus;
  logger: Logger;
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

type FindResultFn = () => Promise<{
  lessonNumber: number;
  lessonSubNumber: number | null;
  lessonTitle: string;
} | null>;

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
  private deps: GeneratorDeps;

  constructor(deps: GeneratorDeps) {
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

    this.runGenerationJob(
      key,
      missionId,
      systemPrompt,
      [{ role: "user" as const, content: userMessage }],
      async () => {
        const latest = await this.deps.store.getLatestLesson(missionId);
        if (
          latest &&
          (latest.number !== lesson.number ||
            latest.subNumber !== lesson.subNumber)
        ) {
          return {
            lessonNumber: latest.number,
            lessonSubNumber: latest.subNumber,
            lessonTitle: latest.title,
          };
        }
        return null;
      },
      "generate-next",
    );

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

    this.runGenerationJob(
      key,
      missionId,
      systemPrompt,
      [{ role: "user" as const, content: userMessage }],
      async () => {
        const latest = await this.deps.store.getLatestLesson(missionId);
        if (
          latest &&
          (latest.number !== lesson.number ||
            latest.subNumber !== lesson.subNumber)
        ) {
          return {
            lessonNumber: latest.number,
            lessonSubNumber: latest.subNumber,
            lessonTitle: latest.title,
          };
        }
        return null;
      },
      "generate-sub-lesson",
    );

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

    const systemPrompt = getRegenerateSystemPrompt({
      missionId,
      missionTitle: mission.title,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      direction,
    });

    const displayNum = this.formatLessonNumber(lesson.number, lesson.subNumber);
    const userMessage = `Please regenerate Lesson ${displayNum}: "${lesson.title}". The student rated it as ${direction === "harder" ? "too easy" : "too hard"}. Read the current lesson content, check feedback history, then use regenerate_lesson to rewrite it at an ${direction === "harder" ? "more challenging" : "easier"} level.`;

    this.runGenerationJob(
      key,
      missionId,
      systemPrompt,
      [{ role: "user" as const, content: userMessage }],
      async () => {
        const found = await this.deps.store.getLesson(
          missionId,
          lesson.number,
          lesson.subNumber,
        );
        if (found) {
          return {
            lessonNumber: found.number,
            lessonSubNumber: found.subNumber,
            lessonTitle: found.title,
          };
        }
        return null;
      },
      "regenerate",
    );

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

    const systemPrompt = getBridgingSystemPrompt({
      missionId,
      missionTitle: mission.title,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
    });

    const displayNum = this.formatLessonNumber(lesson.number, lesson.subNumber);
    const messages = [{ role: "user" as const, content: `Create a bridging sub-lesson for Lesson ${displayNum}: "${lesson.title}". The student found it too hard and needs prerequisite content before they can succeed with the main lesson.` }];

    this.runGenerationJob(
      key,
      missionId,
      systemPrompt,
      messages,
      async () => {
        const latest = await this.deps.store.getLatestLesson(missionId);
        if (
          latest &&
          (latest.number !== lesson.number ||
            latest.subNumber !== lesson.subNumber)
        ) {
          return {
            lessonNumber: latest.number,
            lessonSubNumber: latest.subNumber,
            lessonTitle: latest.title,
          };
        }
        return null;
      },
      "generate-bridging",
    );

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
   * Shared async job lifecycle: dedup is handled by callers.
   * Encapsulates job creation, conversation loop, result-finding,
   * error handling, and 60-second cleanup.
   */
  private runGenerationJob(
    key: string,
    missionId: number,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
    findResult: FindResultFn,
    errorLabel: string,
  ): void {
    const job: InternalJob = {
      status: "running",
      messages: ["Starting…"],
      result: null,
      error: null,
    };
    this.jobs.set(key, job);

    const { logger } = this.deps;

    (async () => {
      try {
        await this.runConversation(missionId, job, systemPrompt, initialMessages);
        job.result = await findResult();
        job.status = "done";
      } catch (err: unknown) {
        job.status = "error";
        job.error =
          err instanceof Error ? err.message : "Something went wrong.";
        logger.error(`${errorLabel} failed:`, job.error);
      } finally {
        setTimeout(() => this.jobs.delete(key), 60_000);
      }
    })();
  }

  /**
   * Common conversation loop with hooks that update job messages and emit events.
   */
  private async runConversation(
    missionId: number,
    job: InternalJob,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
  ): Promise<void> {
    const { ai, toolExecutor, events } = this.deps;
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
          events?.emit(missionId, { type: "tool_start", names: pendingToolNames });
        },
        onAfterToolExecution: async (_results) => {
          events?.emit(missionId, { type: "tool_end", names: pendingToolNames });
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

export function createLessonGenerator(deps: GeneratorDeps): LessonGenerator {
  return new LessonGenerator(deps);
}
