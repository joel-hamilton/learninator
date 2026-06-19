import type { AiClient, AiContentBlock, ToolExecutor } from "./types.js";
import type { Logger } from "../logger.js";
import { conversationLoop, createStandardHooks } from "./conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "./teacher.js";
import { loadMessages } from "../shared/messages.js";
import type { MissionStore, ChatStore, ContentStore } from "../db/store.js";

// ── Public types ──

export interface MissionConversationDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & ChatStore & ContentStore;
  logger: Pick<Logger, "debug" | "info" | "error">;
}

export interface MissionConversationInput {
  missionId: number;
  missionStatus: "onboarding" | "active" | "archived";
  onboardingMode?: "guided" | "chat";
  userMessage: string;
}

export type MissionConversationResult =
  | { type: "reply"; text: string }
  | { type: "activated"; redirectUrl: string };

export interface MissionConversationModule {
  run(input: MissionConversationInput): Promise<MissionConversationResult>;
}

// ── Factory ──

export function createMissionConversation(
  deps: MissionConversationDeps
): MissionConversationModule {
  const { ai, toolExecutor, store, logger } = deps;

  return {
    async run(
      input: MissionConversationInput
    ): Promise<MissionConversationResult> {
      const { missionId, missionStatus, onboardingMode, userMessage } = input;

      // 1. Save the user message
      await store.saveChatMessage({ missionId, role: "user", content: JSON.stringify(userMessage) });

      // 2. Load all existing messages
      const messages = await loadMessages(store, missionId);

      // 3. Build the system prompt based on mission status
      const systemPrompt = await buildSystemPrompt(missionStatus, onboardingMode, store, missionId);

      // 4. Run the conversation loop
      let didActivate = false;

      const standardHooks = createStandardHooks({ missionId, store, logger });

      const result = await conversationLoop({
        client: ai,
        toolExecutor,
        missionId,
        systemPrompt,
        initialMessages: messages,
        tools: TEACHER_TOOLS,
        logger,
        hooks: {
          ...standardHooks,
          onBeforeToolExecution: async (toolUseBlocks) => {
            await standardHooks.onBeforeToolExecution!(toolUseBlocks);
            if (toolUseBlocks.some((b) => b.name === "mark_mission_active")) {
              didActivate = true;
            }
          },
        },
      });

      // 5. Handle activation
      if (didActivate) {
        await generateMissionTitle(missionId, store, ai);
        return { type: "activated", redirectUrl: `/missions/${missionId}` };
      }

      return { type: "reply", text: result.text || "Let us continue." };
    },
  };
}

// ── Internal helpers ──

async function buildSystemPrompt(
  missionStatus: string,
  onboardingMode?: string,
  store?: MissionStore & ContentStore,
  missionId?: number
): Promise<string> {
  if (missionStatus === "onboarding") {
    const mode = onboardingMode || "guided";
    const modeInstructions =
      mode === "guided"
        ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, call mark_mission_active, AND create the first lesson — all in the same response. Do NOT create lessons during onboarding — wait until you're ready to activate.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
        : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, call mark_mission_active, AND create the first lesson — all in the same response.`;
    return TEACHER_SYSTEM_PROMPT + modeInstructions;
  }

  let prompt = TEACHER_SYSTEM_PROMPT;

  // Inject mission content so the AI always sees current goals without an extra tool-call round-trip
  if (store && missionId) {
    const content = await store.getMissionContent(missionId, "mission");
    if (content?.markdownContent) {
      prompt += `\n\nCurrent mission goals:\n${content.markdownContent}`;
    }
  }

  return prompt;
}

async function generateMissionTitle(
  missionId: number,
  store: MissionStore & ChatStore,
  ai: AiClient
): Promise<void> {
  try {
    const titleMessages = await loadMessages(store, missionId);
    const conversationText = titleMessages
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
  } catch {
    // Title generation is non-critical — silently ignore errors
  }
}
