import type { AiClient, AiContentBlock, ToolExecutor } from "./types.js";
import type { Logger } from "../logger.js";
import { conversationLoop } from "./conversation.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "./teacher.js";
import { saveMessage, loadMessages } from "../shared/messages.js";
import { emit } from "./events.js";
import { TOOL_DISPLAY_NAMES } from "./tools.js";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";

// ── Public types ──

export interface MissionConversationDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  db: any;
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
  const { ai, toolExecutor, db, logger } = deps;

  return {
    async run(
      input: MissionConversationInput
    ): Promise<MissionConversationResult> {
      const { missionId, missionStatus, onboardingMode, userMessage } = input;

      // 1. Save the user message
      await saveMessage(missionId, "user", userMessage, db);

      // 2. Load all existing messages
      const messages = await loadMessages(missionId, db);

      // 3. Build the system prompt based on mission status
      const systemPrompt = buildSystemPrompt(missionStatus, onboardingMode);

      // 4. Run the conversation loop
      let didActivate = false;
      let pendingToolNames: string[] = [];

      const result = await conversationLoop({
        client: ai,
        toolExecutor,
        missionId,
        systemPrompt,
        initialMessages: messages,
        tools: TEACHER_TOOLS,
        logger,
        hooks: {
          onAssistantMessage: async (content: AiContentBlock[]) => {
            await saveMessage(missionId, "assistant", content, db);
          },
          onBeforeToolExecution: async (toolUseBlocks) => {
            pendingToolNames = toolUseBlocks.map(
              (b) => TOOL_DISPLAY_NAMES[b.name] || b.name
            );
            emit(missionId, { type: "tool_start", names: pendingToolNames });
            if (
              toolUseBlocks.some((b) => b.name === "mark_mission_active")
            ) {
              didActivate = true;
            }
            logger.debug(
              "Tool calls:",
              toolUseBlocks.map((b) => b.name).join(", ")
            );
          },
          onAfterToolExecution: async (results) => {
            emit(missionId, { type: "tool_end", names: pendingToolNames });
            await saveMessage(missionId, "user", results, db);
          },
        },
      });

      // 5. Handle activation
      if (didActivate) {
        await generateMissionTitle(missionId, db, ai);
        return { type: "activated", redirectUrl: `/missions/${missionId}` };
      }

      return { type: "reply", text: result.text || "Let us continue." };
    },
  };
}

// ── Internal helpers ──

function buildSystemPrompt(
  missionStatus: string,
  onboardingMode?: string
): string {
  if (missionStatus === "onboarding") {
    const mode = onboardingMode || "guided";
    const modeInstructions =
      mode === "guided"
        ? `\n\n## Guided Onboarding Mode\n\nThe user has chosen guided onboarding. You will interview them one question at a time. Use the ask_guided_question tool to ask a SINGLE multiple-choice question. After the user answers, you'll receive their answer and can ask the next question.\n\nAsk 3-5 questions to understand:\n- What they want to learn (be specific)\n- Why they want to learn it (concrete outcomes)\n- Their current experience level\n- Constraints (time, budget, etc.)\n- What success looks like\n\nAfter you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active. Do NOT create lessons during onboarding — wait until the mission is active.\n\nKeep questions concise. Make each option distinct and concrete. Always include "Other (please specify)" as the last option.`
        : `\n\n## Chat Onboarding Mode\n\nThe user has chosen free-form chat onboarding. Have a natural conversation to understand their learning goals. When you have enough information, write MISSION.md and NOTES.md, then call mark_mission_active.`;
    return TEACHER_SYSTEM_PROMPT + modeInstructions;
  }
  return TEACHER_SYSTEM_PROMPT;
}

async function generateMissionTitle(
  missionId: number,
  db: any,
  ai: AiClient
): Promise<void> {
  try {
    const titleMessages = await loadMessages(missionId, db);
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
      await db
        .update(schema.missions)
        .set({ title: cleanTitle, updatedAt: new Date().toISOString() })
        .where(eq(schema.missions.id, missionId));
    }
  } catch {
    // Title generation is non-critical — silently ignore errors
  }
}
