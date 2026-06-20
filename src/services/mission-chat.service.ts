import type { AiClient, AiTool, AiToolUseBlock, ToolExecutor, AiMessageParam } from "../ai/types.js";
import type { Logger } from "../logger.js";
import type { ToolEventBus, WorkflowEventBus } from "../ai/events.js";
import type { WorkflowStateManager } from "../ai/workflow-state.js";
import type { MissionStore, ChatStore, ContentStore } from "../db/store.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { saveMessage, loadMessages } from "../ai/persistence.js";
import { AIError } from "../ai/errors.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface MissionChatDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & ChatStore & ContentStore;
  missionStore: MissionStore;
  chatStore: ChatStore;
  contentStore: ContentStore;
  logger: Pick<Logger, "debug" | "info" | "error">;
  events: ToolEventBus & WorkflowEventBus;
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

// ── Internal dependency types ──────────────────────────────────────────

export interface ExecuteDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  workflowState: WorkflowStateManager;
  chatStore: ChatStore;
  logger: Pick<Logger, "debug" | "info" | "error">;
  events: ToolEventBus & WorkflowEventBus;
}

// ── Extracted pipeline functions ───────────────────────────────────────

/**
 * Build the system prompt for a mission chat interaction.
 * Four branches:
 * 1. Onboarding + guided mode
 * 2. Onboarding + chat mode
 * 3. Lesson-specific chat
 * 4. Default active mission (optionally appends stored mission content)
 */
export async function buildSystemPrompt(
  missionId: number,
  missionStatus: string,
  onboardingMode?: string,
  lesson?: { number: string; title: string },
  contentStore?: ContentStore,
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
  if (contentStore) {
    const storedContent = await contentStore.getMissionContent(missionId, "mission");
    if (storedContent?.markdownContent) {
      prompt += `\n\nCurrent mission goals:\n${storedContent.markdownContent}`;
    }
  }
  return prompt;
}

/**
 * Stage 1: Prepare messages for the conversation.
 * Saves the user message (with context/lesson prefixing), builds the system prompt,
 * and loads prior messages from the store.
 */
export async function prepareMessages(
  input: MissionChatInput,
  chatStore: ChatStore,
  contentStore: ContentStore,
): Promise<{ systemPrompt: string; messages: AiMessageParam[] }> {
  const { missionId, message, lesson, context, missionStatus, onboardingMode } = input;

  // Save user message if non-empty
  if (message) {
    if (lesson) {
      await saveMessage(chatStore, missionId, "user", `[Re: Lesson ${lesson.number}: ${lesson.title}]\n${message}`);
    } else {
      let userContent = message;
      if (context) {
        userContent = `[Context: ${context}]\n\n${message}`;
      }
      await saveMessage(chatStore, missionId, "user", userContent);
    }
  }

  const systemPrompt = await buildSystemPrompt(
    missionId,
    missionStatus,
    onboardingMode,
    lesson,
    contentStore,
  );

  const messages = await loadMessages(chatStore, missionId);

  return { systemPrompt, messages };
}

/**
 * Stage 2: Execute the conversation loop.
 * Starts a workflow, runs conversationLoop with the prepared messages,
 * detects activation (mark_mission_active), and manages workflow lifecycle.
 */
export async function executeConversation(
  systemPrompt: string,
  messages: AiMessageParam[],
  tools: AiTool[],
  pauseOnTools: Set<string> | undefined,
  missionId: number,
  userId: number,
  workflowType: "chat" | "lesson_generation" | "mission_activation",
  workflowLabel: string,
  deps: ExecuteDeps,
): Promise<{ text: string; didActivate: boolean; pausedToolUse?: AiToolUseBlock }> {
  const { ai, toolExecutor, workflowState, chatStore, logger, events } = deps;

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
    store: chatStore,
    logger,
  });

  try {
    const result = await conversationLoop({
      client: ai,
      toolExecutor,
      missionId,
      systemPrompt,
      initialMessages: messages,
      tools,
      logger,
      pauseOnTools,
      events,
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
      text: result.text,
      didActivate,
      pausedToolUse: result.pausedToolUse,
    };
  } catch (err: unknown) {
    const msg = err instanceof AIError ? err.message : "Something went wrong.";
    workflowState.failWorkflow(wfId, msg);
    throw err;
  }
}

/**
 * Stage 3: Handle post-chat logic.
 * Maps the conversation result to MissionChatResult and triggers title
 * generation if the mission was activated.
 */
export async function handlePostChat(
  params: { text: string; didActivate: boolean; pausedToolUse?: AiToolUseBlock },
  missionId: number,
  ai: AiClient,
  chatStore: ChatStore,
  missionStore: MissionStore,
): Promise<MissionChatResult> {
  if (params.didActivate) {
    await generateTitle(missionId, ai, chatStore, missionStore);
  }

  return {
    text: params.text || "Let us continue.",
    didActivate: params.didActivate,
    pausedToolUse: params.pausedToolUse,
  };
}

/**
 * Generate a title for a mission based on the conversation history.
 * Uses the low-cost AI model. Returns null if there are no messages,
 * the title is empty, or the AI call fails.
 */
export async function generateTitle(
  missionId: number,
  ai: AiClient,
  chatStore: ChatStore,
  missionStore: MissionStore,
): Promise<string | null> {
  try {
    const messages = await loadMessages(chatStore, missionId);
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
      await missionStore.updateMissionTitle(missionId, cleanTitle);
    }
    return cleanTitle || null;
  } catch {
    return null;
  }
}

// ── Service ───────────────────────────────────────────────────────────

export type MissionChatService = ReturnType<typeof createMissionChatService>;

export function createMissionChatService(deps: MissionChatDeps) {
  const { ai, toolExecutor, store, missionStore, chatStore, contentStore, logger, events, workflowState } = deps;

  return {
    async run(input: MissionChatInput): Promise<MissionChatResult> {
      const {
        tools = TEACHER_TOOLS,
        pauseOnTools,
        workflowType = "chat",
        workflowLabel = `Chat: ${input.missionTitle}`,
      } = input;

      const { systemPrompt, messages } = await prepareMessages(input, chatStore, contentStore);
      const convResult = await executeConversation(
        systemPrompt,
        messages,
        tools,
        pauseOnTools,
        input.missionId,
        input.userId,
        workflowType,
        workflowLabel,
        { ai, toolExecutor, workflowState, chatStore, logger, events },
      );
      return handlePostChat(convResult, input.missionId, ai, chatStore, missionStore);
    },
    generateTitle: (missionId: number) => generateTitle(missionId, ai, chatStore, missionStore),
  };
}
