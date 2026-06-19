import {
  conversationLoop,
  getBridgingSystemPrompt,
  getRegenerateSystemPrompt,
  TEACHER_SYSTEM_PROMPT,
  TEACHER_TOOLS,
} from "../ai/index.js";
import type { AiClient, AiMessageParam, ToolExecutor } from "../ai/index.js";
import type { MissionStore, LessonStore } from "../db/store.js";
import type { EventBus } from "../ai/events.js";
import type { Logger } from "../logger.js";
import { formatLessonNumber } from "../shared/lesson-numbers.js";

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

// ── GenerationConfig types ──

interface MissionInfo {
  title: string;
  status: string;
}

interface LessonInfo {
  number: number;
  subNumber: number | null;
  title: string;
}

interface GenerationOpts {
  feedback?: string;
  notes?: string;
}

interface LessonResult {
  lessonNumber: number;
  lessonSubNumber: number | null;
  lessonTitle: string;
}

interface GenerationConfig {
  jobKeyType: "next" | "sub" | "regenerate" | "bridge";
  errorLabel: string;
  buildSystemPrompt: (
    missionId: number,
    mission: MissionInfo,
    lesson: LessonInfo,
    direction?: "harder" | "easier",
  ) => string;
  buildUserMessage: (
    lesson: LessonInfo,
    opts?: GenerationOpts,
    direction?: "harder" | "easier",
  ) => string;
  findResult: (
    missionId: number,
    lesson: LessonInfo,
  ) => Promise<LessonResult | null>;
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
    return this.runGeneration(
      {
        jobKeyType: "next",
        errorLabel: "generate-next",
        buildSystemPrompt: (mid, m, l) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          return (
            TEACHER_SYSTEM_PROMPT +
            [
              "",
              `The current mission ID is ${mid}.`,
              `Mission title: ${m.title}`,
              `Mission status: ${m.status}`,
              "",
              `You are creating the next main lesson after Lesson ${displayNum}: "${l.title}". ALWAYS call list_feedback_history first to check past difficulty ratings — this is required. Then review existing lessons to understand what's been covered. Calibrate difficulty based on the student's feedback pattern: multiple "too_hard" ratings → use simpler language, more scaffolding, smaller steps; multiple "too_easy" ratings → increase depth, add advanced material; mixed ratings → maintain current difficulty. ALWAYS use create_lesson for a NEW main lesson. Do NOT use create_sub_lesson — this action is reserved for "Dive Deeper".`,
            ].join("\n")
          );
        },
        buildUserMessage: (l, opts) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          let msg = `The user just completed Lesson ${displayNum}: "${l.title}". Please create the next logical lesson.`;
          if (opts?.feedback) {
            msg += `\n\nThe user gave this feedback on the lesson: ${opts.feedback}`;
          }
          if (opts?.notes) {
            msg += `\n\nThe user requested the next lesson cover: ${opts.notes}`;
          }
          msg += `\n\nReview what's been covered so far (use list_lessons and read references). Create the next main lesson using create_lesson. Do NOT use create_sub_lesson.`;
          return msg;
        },
        findResult: async (mid, l) => {
          const latest = await this.deps.store.getLatestLesson(mid);
          if (
            latest &&
            (latest.number !== l.number ||
              latest.subNumber !== l.subNumber)
          ) {
            return {
              lessonNumber: latest.number,
              lessonSubNumber: latest.subNumber,
              lessonTitle: latest.title,
            };
          }
          return null;
        },
      },
      missionId,
      lesson,
      mission,
      opts,
    );
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
    return this.runGeneration(
      {
        jobKeyType: "sub",
        errorLabel: "generate-sub-lesson",
        buildSystemPrompt: (mid, m, l) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          return (
            TEACHER_SYSTEM_PROMPT +
            [
              "",
              `The current mission ID is ${mid}.`,
              `Mission title: ${m.title}`,
              `Mission status: ${m.status}`,
              "",
              `You are creating a sub-lesson of Lesson ${displayNum}: "${l.title}". ALWAYS call list_feedback_history first to check past difficulty ratings — this is required. Then review existing lessons to understand what has been covered. Calibrate difficulty based on the student's feedback pattern: multiple "too_hard" ratings → use simpler language, more scaffolding, smaller steps; multiple "too_easy" ratings → increase depth, add advanced material; mixed ratings → maintain current difficulty. Use create_sub_lesson.`,
            ].join("\n")
          );
        },
        buildUserMessage: (l) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          return `The user wants to go deeper on Lesson ${displayNum}: "${l.title}". Please create a sub-lesson that covers related material, a deeper dive, or clarification on the same topic. Use create_sub_lesson with parent_lesson_number: ${l.number}.`;
        },
        findResult: async (mid, l) => {
          const latest = await this.deps.store.getLatestLesson(mid);
          if (
            latest &&
            (latest.number !== l.number ||
              latest.subNumber !== l.subNumber)
          ) {
            return {
              lessonNumber: latest.number,
              lessonSubNumber: latest.subNumber,
              lessonTitle: latest.title,
            };
          }
          return null;
        },
      },
      missionId,
      lesson,
      mission,
    );
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
    return this.runGeneration(
      {
        jobKeyType: "regenerate",
        errorLabel: "regenerate",
        buildSystemPrompt: (mid, m, l, direction) =>
          getRegenerateSystemPrompt({
            missionId: mid,
            missionTitle: m.title,
            lessonNumber: l.number,
            lessonTitle: l.title,
            direction: direction!,
          }),
        buildUserMessage: (l, _opts, direction) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          return `Please regenerate Lesson ${displayNum}: "${l.title}". The student rated it as ${direction === "harder" ? "too easy" : "too hard"}. Read the current lesson content, check feedback history, then use regenerate_lesson to rewrite it at an ${direction === "harder" ? "more challenging" : "easier"} level.`;
        },
        findResult: async (mid, l) => {
          const found = await this.deps.store.getLesson(
            mid,
            l.number,
            l.subNumber,
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
      },
      missionId,
      lesson,
      mission,
      undefined,
      direction,
    );
  }

  /**
   * Start a background job to create a bridging sub-lesson.
   */
  generateBridging(
    missionId: number,
    lesson: { number: number; subNumber: number | null; title: string },
    mission: { title: string; status: string },
  ): string {
    return this.runGeneration(
      {
        jobKeyType: "bridge",
        errorLabel: "generate-bridging",
        buildSystemPrompt: (mid, m, l) =>
          getBridgingSystemPrompt({
            missionId: mid,
            missionTitle: m.title,
            lessonNumber: l.number,
            lessonTitle: l.title,
          }),
        buildUserMessage: (l) => {
          const displayNum = formatLessonNumber(l.number, l.subNumber);
          return `Create a bridging sub-lesson for Lesson ${displayNum}: "${l.title}". The student found it too hard and needs prerequisite content before they can succeed with the main lesson.`;
        },
        findResult: async (mid, l) => {
          const latest = await this.deps.store.getLatestLesson(mid);
          if (
            latest &&
            (latest.number !== l.number ||
              latest.subNumber !== l.subNumber)
          ) {
            return {
              lessonNumber: latest.number,
              lessonSubNumber: latest.subNumber,
              lessonTitle: latest.title,
            };
          }
          return null;
        },
      },
      missionId,
      lesson,
      mission,
    );
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
   * Template method that captures the shared lesson generation lifecycle:
   * 1. Build job key from config.jobKeyType
   * 2. Dedup by job key
   * 3. Build system prompt via config.buildSystemPrompt
   * 4. Build user message via config.buildUserMessage
   * 5. Run job via runGenerationJob with config.findResult
   *
   * Returns the job key for polling via getJobStatus.
   */
  private runGeneration(
    config: GenerationConfig,
    missionId: number,
    lesson: LessonInfo,
    mission: MissionInfo,
    opts?: GenerationOpts,
    direction?: "harder" | "easier",
  ): string {
    const key = buildJobKey(missionId, lesson.number, lesson.subNumber, config.jobKeyType);
    if (this.jobs.has(key)) return key;

    const systemPrompt = config.buildSystemPrompt(missionId, mission, lesson, direction);
    const userMessage = config.buildUserMessage(lesson, opts, direction);

    this.runGenerationJob(
      key,
      missionId,
      systemPrompt,
      [{ role: "user" as const, content: userMessage }],
      () => config.findResult(missionId, lesson),
      config.errorLabel,
    );

    return key;
  }

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
   * Common conversation loop with hooks that update job messages.
   * Event emission is handled by conversationLoop via the events field.
   */
  private async runConversation(
    missionId: number,
    job: InternalJob,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
  ): Promise<void> {
    const { ai, toolExecutor, events } = this.deps;

    await conversationLoop({
      client: ai,
      toolExecutor,
      missionId,
      systemPrompt,
      initialMessages,
      tools: TEACHER_TOOLS,
      events,
      hooks: {
        onBeforeToolExecution: async (toolUseBlocks) => {
          for (const block of toolUseBlocks) {
            const label = this.toolLabel(
              block.name,
              block.input as Record<string, unknown> | undefined,
            );
            job.messages.push(label);
          }
        },
        onTruncated: async () => {
          job.messages.push("Response was cut short…");
        },
      },
    });
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
