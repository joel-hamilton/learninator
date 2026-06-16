import type { AiClient, AiMessageParam, AiTool, AiToolUseBlock } from "../ai/types.js";
import type { ToolExecutor } from "../ai/types.js";
import type { Logger } from "../logger.js";
import { conversationLoop } from "../ai/conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { TOOL_DISPLAY_NAMES } from "../ai/tools.js";
import { emit } from "../ai/events.js";
import { AIError } from "../ai/index.js";
import { eq, and, asc } from "drizzle-orm";
import * as schema from "../db/schema.js";

// ── Public types ──

export type OnboardingResult =
  | { type: "redirect"; url: string }
  | { type: "question"; questionId: number; question: string; options: string[] }
  | { type: "thinking" }
  | { type: "error"; message: string };

export interface OnboardingDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  db: any;
  logger: Logger;
}

export interface OnboardingModule {
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
}

// ── Factory ──

export function createOnboarding(deps: OnboardingDeps): OnboardingModule {
  const { ai, toolExecutor, db, logger } = deps;

  // ── Internal message persistence helpers (use deps.db for testability) ──

  async function saveMsg(missionId: number, role: "user" | "assistant", content: unknown) {
    await db.insert(schema.chatMessages).values({
      missionId,
      role,
      content: JSON.stringify(content),
    });
  }

  async function loadMsgs(missionId: number): Promise<AiMessageParam[]> {
    const rows = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.missionId, missionId))
      .orderBy(asc(schema.chatMessages.createdAt));

    const messages: AiMessageParam[] = [];
    let lastAssistantToolUseIds: Set<string> | null = null;

    for (const row of rows) {
      const parsed = JSON.parse(row.content);

      if (row.role === "assistant") {
        lastAssistantToolUseIds = null;
        if (Array.isArray(parsed)) {
          const ids = new Set<string>();
          for (const block of parsed) {
            if (block.type === "tool_use" && block.id) ids.add(block.id);
          }
          if (ids.size > 0) lastAssistantToolUseIds = ids;
        }
        messages.push({ role: "assistant", content: parsed });
      } else {
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type === "tool_result") {
          if (lastAssistantToolUseIds) {
            const valid = parsed.filter(
              (b: any) => b.type === "tool_result" && lastAssistantToolUseIds!.has(b.tool_use_id)
            );
            if (valid.length > 0) messages.push({ role: "user", content: valid });
          }
        } else {
          messages.push({ role: "user", content: parsed });
        }
      }
    }

    return messages;
  }

  // ── Prompt builder ──

  function getOnboardingPrompt(mode: string): string {
    const modeInstructions = mode === "guided"
      ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active. Do NOT create lessons during onboarding — wait until the mission is active.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
      : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active.`;

    return TEACHER_SYSTEM_PROMPT + modeInstructions;
  }

  // ── Title generation ──

  /** Extract text content from an AiMessageParam's content field (already parsed). */
  function extractText(content: string | any[]): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
    }
    return "";
  }

  async function generateMissionTitle(missionId: number): Promise<string | null> {
    const messages = await loadMsgs(missionId);
    if (messages.length === 0) return null;

    const conversationText = messages.map((m) => {
      const text = extractText(m.content);
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

      await db
        .update(schema.missions)
        .set({ title: cleanTitle, updatedAt: new Date().toISOString() })
        .where(eq(schema.missions.id, missionId));

      return cleanTitle;
    } catch {
      // Title generation is non-critical — silently ignore errors
      return null;
    }
  }

  // ── Conversation loop wrapper ──

  interface RunConversationResult {
    didActivate: boolean;
    pausedToolUse?: AiToolUseBlock;
    text: string;
  }

  async function runConversationLoop(
    missionId: number,
    systemPrompt: string,
    initialMessages: AiMessageParam[],
    tools: AiTool[],
    opts?: { pauseOnTools?: Set<string> },
  ): Promise<RunConversationResult> {
    let didActivate = false;
    let pendingToolNames: string[] = [];

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
        onAssistantMessage: async (content) => {
          await saveMsg(missionId, "assistant", content);
        },
        onBeforeToolExecution: async (toolUseBlocks) => {
          pendingToolNames = toolUseBlocks.map((b) => TOOL_DISPLAY_NAMES[b.name] || b.name);
          emit(missionId, { type: "tool_start", names: pendingToolNames });
          if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
            didActivate = true;
          }
          logger.debug("Tool calls:", toolUseBlocks.map((b) => b.name).join(", "));
        },
        onAfterToolExecution: async (results) => {
          emit(missionId, { type: "tool_end", names: pendingToolNames });
          await saveMsg(missionId, "user", results);
        },
      },
    });

    return { didActivate, pausedToolUse: result.pausedToolUse, text: result.text };
  }

  // ── Find the latest pending guided question ──

  async function findPendingQuestion(missionId: number) {
    const [pq] = await db
      .select()
      .from(schema.guidedQuestions)
      .where(and(eq(schema.guidedQuestions.missionId, missionId), eq(schema.guidedQuestions.status, "pending")))
      .orderBy(asc(schema.guidedQuestions.createdAt))
      .limit(1);
    return pq || null;
  }

  // ── Public API ──

  return {
    async start(missionId, userMessage, mode) {
      const systemPrompt = getOnboardingPrompt(mode);

      const initialMessages: AiMessageParam[] = [
        { role: "user", content: userMessage },
      ];

      await saveMsg(missionId, "user", userMessage);

      const opts = mode === "guided"
        ? { pauseOnTools: new Set(["ask_guided_question"]) }
        : undefined;

      try {
        const result = await runConversationLoop(missionId, systemPrompt, initialMessages, TEACHER_TOOLS, opts);

        if (result.didActivate) {
          await generateMissionTitle(missionId);
        }
      } catch {
        // Mission and user message are saved; redirect to onboarding page
      }

      return { type: "redirect", url: `/missions/${missionId}` };
    },

    async continueGuided(missionId) {
      const systemPrompt = getOnboardingPrompt("guided");
      const messages = await loadMsgs(missionId);

      try {
        const result = await runConversationLoop(
          missionId, systemPrompt, messages, TEACHER_TOOLS,
          { pauseOnTools: new Set(["ask_guided_question"]) },
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
        await db
          .update(schema.guidedQuestions)
          .set({ answer, answerText: otherText || null, status: "answered" })
          .where(eq(schema.guidedQuestions.id, questionId));
      }

      // Fetch the question text for context
      const [questionRow] = await db
        .select()
        .from(schema.guidedQuestions)
        .where(eq(schema.guidedQuestions.id, questionId))
        .limit(1);

      const qText = questionRow?.question || "Previous question";
      const userMessage = `Question: ${qText}\nAnswer: ${finalAnswer}`;
      await saveMsg(missionId, "user", userMessage);

      const systemPrompt = getOnboardingPrompt("guided");
      const messages = await loadMsgs(missionId);

      try {
        const result = await runConversationLoop(
          missionId, systemPrompt, messages, TEACHER_TOOLS,
          { pauseOnTools: new Set(["ask_guided_question"]) },
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
      await db
        .update(schema.guidedQuestions)
        .set({ answer: "(skipped)", status: "answered" })
        .where(and(eq(schema.guidedQuestions.missionId, missionId), eq(schema.guidedQuestions.status, "pending")));

      const systemPrompt = getOnboardingPrompt("guided") +
        `\n\nThe user has requested that you stop asking questions and proceed immediately. Use your best judgment for all remaining decisions. Write MISSION.md and NOTES.md if you haven't already, call mark_mission_active, and create the first lesson. Do NOT ask any more questions or prompt the user for input.`;

      // Remove ask_guided_question so the AI can't use it
      const skipTools = TEACHER_TOOLS.filter((t) => t.name !== "ask_guided_question");

      const skipMessage = "[I've answered enough questions. Please use your best judgment for the rest and create the mission and first lesson.]";
      await saveMsg(missionId, "user", skipMessage);
      const allMessages = await loadMsgs(missionId);

      try {
        const result = await runConversationLoop(missionId, systemPrompt, allMessages, skipTools);

        if (result.didActivate) {
          await generateMissionTitle(missionId);
          return { type: "redirect", url: `/missions/${missionId}` };
        }
      } catch {
        // Continue to redirect even on error — mission exists
      }

      return { type: "redirect", url: `/missions/${missionId}` };
    },

    async switchMode(missionId, newMode) {
      // When switching from guided to chat, inject any pending question as a message
      if (newMode === "chat") {
        const [mission] = await db
          .select()
          .from(schema.missions)
          .where(eq(schema.missions.id, missionId))
          .limit(1);

        if (mission?.onboardingMode === "guided") {
          const pendingQuestions = await db
            .select()
            .from(schema.guidedQuestions)
            .where(and(eq(schema.guidedQuestions.missionId, missionId), eq(schema.guidedQuestions.status, "pending")))
            .orderBy(asc(schema.guidedQuestions.createdAt));

          for (const pq of pendingQuestions) {
            const options: string[] = JSON.parse(pq.options as string);
            const optionsText = options.map((o: string) => `- ${o}`).join("\n");
            const questionMsg = `**${pq.question}**\n\n${optionsText}`;
            await saveMsg(missionId, "assistant", questionMsg);
            await db
              .update(schema.guidedQuestions)
              .set({ answer: "(switched to chat)", status: "answered" })
              .where(eq(schema.guidedQuestions.id, pq.id));
          }
        }
      }

      await db
        .update(schema.missions)
        .set({ onboardingMode: newMode, updatedAt: new Date().toISOString() })
        .where(eq(schema.missions.id, missionId));
    },
  };
}
