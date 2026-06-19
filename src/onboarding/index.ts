import type { AiClient, AiMessageParam, AiTool, AiToolUseBlock } from "../ai/types.js";
import type { ToolExecutor } from "../ai/types.js";
import type { Logger } from "../logger.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { AIError } from "../ai/index.js";
import { saveMessage, loadMessages, contentToText } from "../shared/messages.js";
import type { MissionStore } from "../db/store.js";
import type { EventBus } from "../ai/events.js";
import type { WorkflowStateManager } from "../ai/workflow-state.js";

// ── Public types ──

export type OnboardingResult =
  | { type: "redirect"; url: string }
  | { type: "question"; questionId: number; question: string; options: string[] }
  | { type: "thinking" }
  | { type: "error"; message: string };

export interface OnboardingDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore;
  logger: Logger;
  workflowState?: WorkflowStateManager;
  events?: EventBus;
  userId?: number;
}

export interface RunConversationResult {
  didActivate: boolean;
  pausedToolUse?: AiToolUseBlock;
  text: string;
}

export interface OnboardingModule {
  /** Build the system prompt for the given onboarding mode. */
  getOnboardingPrompt(mode: string): string;
  /** Start a new onboarding conversation. Always redirects to the mission page. */
  start(missionId: number, userMessage: string, mode: "guided" | "chat"): Promise<OnboardingResult>;
  /** Continue a guided onboarding turn (triggered when there's no pending question). */
  continueGuided(missionId: number): Promise<OnboardingResult>;
  /** Submit an answer to a guided question. */
  answerQuestion(missionId: number, questionId: number, answer: string, otherText?: string): Promise<OnboardingResult>;
  /** Skip remaining guided questions and tell the AI to proceed. */
  skipQuestions(missionId: number): Promise<OnboardingResult>;
  /** Switch onboarding mode. */
  switchMode(missionId: number, newMode: "guided" | "chat"): Promise<void>;
  /** Run the conversation loop with custom system prompt and messages. */
  runConversationLoop(missionId: number, systemPrompt: string, messages: AiMessageParam[], tools: AiTool[], opts?: { pauseOnTools?: Set<string>; workflowType?: "chat" | "lesson_generation" | "mission_activation"; workflowLabel?: string; userId?: number }): Promise<RunConversationResult>;
  /** Generate a mission title from conversation messages. */
  generateMissionTitle(missionId: number): Promise<string | null>;
}

// ── Factory ──

export function createOnboarding(deps: OnboardingDeps): OnboardingModule {
  const { ai, toolExecutor, store, logger, workflowState, events, userId } = deps;

  // ── Prompt builder ──

  function getOnboardingPrompt(mode: string): string {
    const modeInstructions = mode === "guided"
      ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active. Do NOT create lessons during onboarding — wait until the mission is active.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
      : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active.`;

    return TEACHER_SYSTEM_PROMPT + modeInstructions;
  }

  // ── Title generation ──

  async function generateMissionTitle(missionId: number): Promise<string | null> {
    const messages = await loadMessages(store, missionId);
    if (messages.length === 0) return null;

    const conversationText = messages.map((m) => {
      const text = typeof m.content === "string" ? contentToText(m.content) : (m.content as any[]).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      return `${m.role}: ${text}`;
    }).join("\n\n");

    try {
      const title = await ai.chat(
        "Generate a short, descriptive title (max 8 words) for a learning mission based on this conversation. Return ONLY the title, no quotes, no punctuation at the end. Make it specific and concrete.",
        [{ role: "user", content: `Here is the conversation:\n\n${conversationText.slice(-3000)}` }],
        { model: "low", maxTokens: 50, disableThinking: true }
      );

      const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 120);
      if (!cleanTitle) return null;

      await store.updateMissionTitle(missionId, cleanTitle);

      return cleanTitle;
    } catch {
      // Title generation is non-critical — silently ignore errors
      return null;
    }
  }

  // ── Conversation loop wrapper ──

  async function runConversationLoop(
    missionId: number,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
    tools: AiTool[],
    opts?: { pauseOnTools?: Set<string>; workflowType?: "chat" | "lesson_generation" | "mission_activation"; workflowLabel?: string; userId?: number },
  ): Promise<RunConversationResult> {
    let didActivate = false;

    // Start workflow tracking if workflowState is available
    let workflowId: string | null = null;
    if (workflowState) {
      const wfType = opts?.workflowType ?? "chat";
      const wfLabel = opts?.workflowLabel ?? "Chat";
      const wfUserId = opts?.userId ?? userId ?? 0;
      workflowId = workflowState.startWorkflow(wfUserId, wfType, wfLabel, missionId, `/missions/${missionId}/chat`);
    }

    const standardHooks = createStandardHooks({ missionId, store, emit: events?.emit.bind(events), logger });

    try {
      const result = await conversationLoop({
        client: ai,
        toolExecutor,
        missionId,
        systemPrompt,
        initialMessages,
        tools,
        logger,
        pauseOnTools: opts?.pauseOnTools,
        hooks: {
          ...standardHooks,
          onBeforeToolExecution: async (toolUseBlocks) => {
            await standardHooks.onBeforeToolExecution!(toolUseBlocks);
            if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
              didActivate = true;
            }
            // Emit workflow steps for site-wide indicator
            if (workflowState && workflowId) {
              for (const block of toolUseBlocks) {
                workflowState.stepUpdate(workflowId, block.name);
              }
            }
          },
        },
      });

      if (workflowState && workflowId) workflowState.completeWorkflow(workflowId);
      return { didActivate, pausedToolUse: result.pausedToolUse, text: result.text };
    } catch (err: unknown) {
      const msg = err instanceof AIError ? err.message : "Something went wrong.";
      if (workflowState && workflowId) workflowState.failWorkflow(workflowId, msg);
      throw err;
    }
  }

  // ── Find the latest pending guided question ──

  async function findPendingQuestion(missionId: number) {
    return store.getPendingQuestion(missionId);
  }

  // ── Public API ──

  return {
    getOnboardingPrompt,
    runConversationLoop,
    generateMissionTitle,
    async start(missionId, userMessage, mode) {
      const systemPrompt = getOnboardingPrompt(mode);

      const initialMessages: AiMessageParam[] = [
        { role: "user", content: userMessage },
      ];

      await saveMessage(store, missionId, "user", userMessage);

      const label = userMessage.length > 40 ? userMessage.slice(0, 40) + "…" : userMessage;
      const opts = mode === "guided"
        ? { pauseOnTools: new Set(["ask_guided_question"]), workflowType: "mission_activation" as const, workflowLabel: `Setting up: ${label}` }
        : { workflowType: "mission_activation" as const, workflowLabel: `Setting up: ${label}` };

      try {
        const result = await runConversationLoop(missionId, systemPrompt, initialMessages, TEACHER_TOOLS, opts);

        if (result.didActivate) {
          await generateMissionTitle(missionId);
        }
      } catch (err) {
        logger.error("onboarding.start failed:", err);
        // Mission and user message are saved; redirect to onboarding page
      }

      return { type: "redirect", url: `/missions/${missionId}` };
    },

    async continueGuided(missionId) {
      const systemPrompt = getOnboardingPrompt("guided");
      const messages = await loadMessages(store, missionId);

      try {
        const result = await runConversationLoop(
          missionId, systemPrompt, messages, TEACHER_TOOLS,
          { pauseOnTools: new Set(["ask_guided_question"]), workflowType: "mission_activation" as const, workflowLabel: "Setting up mission" },
        );

        if (result.didActivate) {
          await generateMissionTitle(missionId);
          return { type: "redirect", url: `/missions/${missionId}` };
        }

        if (result.pausedToolUse) {
          const pq = await findPendingQuestion(missionId);
          if (pq) {
            const options: string[] = JSON.parse(pq.options as string);
            return {
              type: "question",
              questionId: pq.id,
              question: pq.question as string,
              options,
            };
          }
        }

        // No question generated — AI must have sent text. Signal caller to trigger again.
        return { type: "thinking" };
      } catch (err: unknown) {
        const msg = err instanceof AIError
          ? err.message
          : "Something went wrong. Please try again.";
        return { type: "error", message: msg };
      }
    },

    async answerQuestion(missionId, questionId, answer, otherText) {
      // Mark the question as answered
      const finalAnswer = otherText || answer;
      if (questionId && finalAnswer) {
        await store.answerQuestion(questionId, answer, otherText || null);
      }

      const userMessage = `Question: (answered)\nAnswer: ${finalAnswer}`;
      await saveMessage(store, missionId, "user", userMessage);

      const systemPrompt = getOnboardingPrompt("guided");
      const messages = await loadMessages(store, missionId);

      try {
        const result = await runConversationLoop(
          missionId, systemPrompt, messages, TEACHER_TOOLS,
          { pauseOnTools: new Set(["ask_guided_question"]), workflowType: "mission_activation" as const, workflowLabel: "Setting up mission" },
        );

        if (result.didActivate) {
          await generateMissionTitle(missionId);
          return { type: "redirect", url: `/missions/${missionId}` };
        }

        if (result.pausedToolUse) {
          const pq = await findPendingQuestion(missionId);
          if (pq) {
            const options: string[] = JSON.parse(pq.options as string);
            return {
              type: "question",
              questionId: pq.id,
              question: pq.question as string,
              options,
            };
          }
        }

        // Fallback: trigger another turn
        return { type: "thinking" };
      } catch (err: unknown) {
        const msg = err instanceof AIError
          ? err.message
          : "Something went wrong. Please try again.";
        return { type: "error", message: msg };
      }
    },

    async skipQuestions(missionId) {
      // Mark any pending questions as answered
      await store.skipPendingQuestions(missionId);

      const systemPrompt = getOnboardingPrompt("guided") +
        `\n\nThe user has requested that you stop asking questions and proceed immediately. Use your best judgment for all remaining decisions. Write MISSION.md and NOTES.md if you haven't already, call mark_mission_active, and create the first lesson. Do NOT ask any more questions or prompt the user for input.`;

      // Remove ask_guided_question so the AI can't use it
      const skipTools = TEACHER_TOOLS.filter((t) => t.name !== "ask_guided_question");

      const skipMessage = "[I've answered enough questions. Please use your best judgment for the rest and create the mission and first lesson.]";
      await saveMessage(store, missionId, "user", skipMessage);
      const allMessages = await loadMessages(store, missionId);

      try {
        const result = await runConversationLoop(missionId, systemPrompt, allMessages, skipTools, {
          workflowType: "mission_activation" as const,
          workflowLabel: "Setting up mission",
        });

        if (result.didActivate) {
          await generateMissionTitle(missionId);
          return { type: "redirect", url: `/missions/${missionId}` };
        }
      } catch (err) {
        logger.error("onboarding.skipQuestions failed:", err);
        // Continue to redirect even on error — mission exists
      }

      return { type: "redirect", url: `/missions/${missionId}` };
    },

    async switchMode(missionId, newMode) {
      // When switching from guided to chat, convert any pending questions to chat messages
      if (newMode === "chat") {
        let pq = await store.getPendingQuestion(missionId);
        while (pq) {
          const options: string[] = JSON.parse(pq.options as string);
          const optionsText = options.map((o: string) => `- ${o}`).join("\n");
          const questionMsg = `**${pq.question}**\n\n${optionsText}`;
          await saveMessage(store, missionId, "assistant", questionMsg);
          await store.answerQuestion(pq.id, "(switched to chat)");
          pq = await store.getPendingQuestion(missionId);
        }
      }

      await store.updateMissionOnboardingMode(missionId, newMode);
    },
  };
}
