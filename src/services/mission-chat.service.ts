import type { AiClient, AiTool, AiToolUseBlock, ToolExecutor } from "../ai/types.js";
import type { Logger } from "../logger.js";
import type { EventBus } from "../ai/events.js";
import type { WorkflowStateManager } from "../ai/workflow-state.js";
import type { MissionStore, ChatStore, ContentStore } from "../db/store.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { saveMessage, loadMessages } from "../shared/messages.js";
import { AIError } from "../ai/errors.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface MissionChatDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & ChatStore & ContentStore;
  logger: Pick<Logger, "debug" | "info" | "error">;
  events: EventBus;
  workflowState: WorkflowStateManager;
}

export interface MissionChatInput {
  missionId: number;
  userId: number;
  message: string;
  missionTitle: string;
  missionStatus: string;
  onboardingMode?: string;
  /** Additional context to prepend to the user message (e.g. lesson info). */
  context?: string;
  /** Lesson context for lesson-specific chat. */
  lesson?: { number: string; title: string };
  /** Tools to use. Defaults to TEACHER_TOOLS. */
  tools?: AiTool[];
  /** Tool names that should pause the loop instead of continuing. */
  pauseOnTools?: Set<string>;
  /** Workflow type for the workflow state manager. */
  workflowType?: "chat" | "lesson_generation" | "mission_activation";
  /** Workflow label for the workflow state manager. */
  workflowLabel?: string;
}

export interface MissionChatResult {
  text: string;
  didActivate: boolean;
  pausedToolUse?: AiToolUseBlock;
}

// ── Service ───────────────────────────────────────────────────────────

export type MissionChatService = ReturnType<typeof createMissionChatService>;

export function createMissionChatService(deps: MissionChatDeps) {
  const { ai, toolExecutor, store, logger, events, workflowState } = deps;

  async function buildSystemPrompt(
    missionId: number,
    missionStatus: string,
    onboardingMode?: string,
    lesson?: { number: string; title: string },
  ): Promise<string> {
    if (missionStatus === "onboarding") {
      const mode = onboardingMode || "guided";
      const modeInstructions =
        mode === "guided"
          ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active. Do NOT create lessons during onboarding — wait until the mission is active.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
          : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active.`;
      return TEACHER_SYSTEM_PROMPT + modeInstructions;
    }

    if (lesson) {
      return (
        TEACHER_SYSTEM_PROMPT +
        `\nThe current mission ID is ${missionId}.\n\n` +
        `The user is currently viewing Lesson ${lesson.number}: "${lesson.title}". They may ask you to:\n` +
        `- Explain concepts from this lesson in more detail\n` +
        `- Provide examples or practice exercises related to this lesson\n` +
        `- Create the next lesson or a sub-lesson that builds on this material\n\n` +
        `If they ask for a new lesson, use create_lesson or create_sub_lesson as appropriate. Review existing lessons first to avoid duplicates.`
      );
    }

    let prompt = TEACHER_SYSTEM_PROMPT + `\nThe current mission ID is ${missionId}.\n`;
    const storedContent = await store.getMissionContent(missionId, "mission");
    if (storedContent?.markdownContent) {
      prompt += `\n\nCurrent mission goals:\n${storedContent.markdownContent}`;
    }
    return prompt;
  }

  async function run(input: MissionChatInput): Promise<MissionChatResult> {
    const {
      missionId,
      userId,
      message,
      missionTitle,
      missionStatus,
      onboardingMode,
      context,
      lesson,
      tools = TEACHER_TOOLS,
      pauseOnTools,
      workflowType = "chat",
      workflowLabel = `Chat: ${missionTitle}`,
    } = input;

    const wfId = workflowState.startWorkflow(
      userId,
      workflowType,
      workflowLabel,
      missionId,
      `/missions/${missionId}/chat`,
    );

    let didActivate = false;

    const stdHooks = createStandardHooks({
      missionId,
      store,
      emit: events.emit.bind(events),
      logger,
    });

    try {
      // Build the user message content and save if non-empty
      if (message) {
        let userContent = message;
        if (lesson) {
          userContent = `[The user is on Lesson ${lesson.number}: "${lesson.title}". They said:] ${message}`;
        } else if (context) {
          userContent = `[Context: ${context}]\n\n${message}`;
        }

        if (lesson) {
          await saveMessage(store, missionId, "user", `[Re: Lesson ${lesson.number}: ${lesson.title}]\n${message}`);
        } else {
          await saveMessage(store, missionId, "user", userContent);
        }
      }

      const systemPrompt = await buildSystemPrompt(
        missionId,
        missionStatus,
        onboardingMode,
        lesson,
      );

      const messages = await loadMessages(store, missionId);

      const result = await conversationLoop({
        client: ai,
        toolExecutor,
        missionId,
        systemPrompt,
        initialMessages: messages,
        tools,
        logger,
        pauseOnTools,
        hooks: {
          ...stdHooks,
          onBeforeToolExecution: async (toolUseBlocks) => {
            await stdHooks.onBeforeToolExecution!(toolUseBlocks);
            if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
              didActivate = true;
            }
            for (const block of toolUseBlocks) {
              workflowState.stepUpdate(wfId, block.name);
            }
          },
        },
      });

      workflowState.completeWorkflow(wfId);
      return {
        text: result.text || "Let us continue.",
        didActivate,
        pausedToolUse: result.pausedToolUse,
      };
    } catch (err: unknown) {
      const msg = err instanceof AIError ? err.message : "Something went wrong.";
      workflowState.failWorkflow(wfId, msg);
      throw err;
    }
  }

  async function generateTitle(missionId: number): Promise<string | null> {
    try {
      const messages = await loadMessages(store, missionId);
      if (messages.length === 0) return null;

      const conversationText = messages
        .map((m) => {
          const text =
            typeof m.content === "string"
              ? m.content
              : Array.isArray(m.content)
                ? m.content
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join("")
                : "";
          return `${m.role}: ${text}`;
        })
        .join("\n\n");

      const title = await ai.chat(
        "Generate a short, descriptive title (max 8 words) for a learning mission based on this conversation. Return ONLY the title, no quotes, no punctuation at the end. Make it specific and concrete.",
        [
          {
            role: "user",
            content: `Here is the conversation:\n\n${conversationText.slice(-3000)}`,
          },
        ],
        { model: "low", maxTokens: 50, disableThinking: true }
      );

      const cleanTitle = title
        .trim()
        .replace(/^["']|["']$/g, "")
        .slice(0, 120);
      if (cleanTitle) {
        await store.updateMissionTitle(missionId, cleanTitle);
      }
      return cleanTitle || null;
    } catch {
      return null;
    }
  }

  return { run, generateTitle };
}
