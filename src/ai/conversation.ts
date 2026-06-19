import type {
  AiClient,
  AiMessage,
  AiMessageParam,
  AiTool,
  AiToolUseBlock,
  AiToolResultBlockParam,
  ToolCallOptions,
  ToolExecutor,
  AiContentBlock,
} from "./types.js";
import type { Logger } from "../logger.js";
import type { EventBus } from "./events.js";
import type { ChatStore } from "../db/store.js";
import { saveMessage } from "../shared/messages.js";
import { TOOL_DISPLAY_NAMES } from "./tools.js";

export interface ConversationHooks {
  /** Called for every assistant message (both text-only and tool_use messages). */
  onAssistantMessage?: (content: AiContentBlock[]) => Promise<void>;
  /** Called before executing a set of tool calls. Receives only the tool_use blocks. */
  onBeforeToolExecution?: (toolUseBlocks: AiToolUseBlock[]) => Promise<void>;
  /** Called after tool results are returned. */
  onAfterToolExecution?: (results: AiToolResultBlockParam[]) => Promise<void>;
  /** Called when the response was truncated by max_tokens. */
  onTruncated?: () => void;
}

export interface ConversationLoopParams {
  client: AiClient;
  toolExecutor: ToolExecutor;
  missionId: number;
  systemPrompt: string;
  initialMessages: AiMessageParam[];
  tools: AiTool[];
  options?: ToolCallOptions;
  hooks?: ConversationHooks;
  logger?: Pick<Logger, "debug">;
  /** Tool names that should pause the loop after execution instead of continuing. */
  pauseOnTools?: Set<string>;
  /** Maximum number of tool-use turns before forcing a stop. Defaults to 20. */
  maxTurns?: number;
  /** Event bus for emitting tool progress events. If omitted, no events are emitted. */
  events?: EventBus;
}

export interface ConversationLoopResult {
  /** Concatenated text from all text blocks in the conversation. */
  text: string;
  /** The final AiMessage returned (either a text-only response or the last tool_use response). */
  finalMessage: AiMessage;
  /** Total number of tool calls executed across all rounds. */
  toolCallsExecuted: number;
  /** If the loop paused because of a pauseOnTools match, the tool_use block that triggered it. */
  pausedToolUse?: AiToolUseBlock;
}

/** Dependencies for the standard conversation hooks factory. */
export interface StandardHooksDeps {
  missionId: number;
  store: ChatStore;
  logger?: Pick<Logger, "debug">;
}

/**
 * Creates the standard set of conversation hooks used by chat and onboarding callers.
 * Callers can spread and override individual hooks for non-standard behavior.
 */
export function createStandardHooks(deps: StandardHooksDeps): ConversationHooks {
  const { missionId, store, logger } = deps;

  return {
    onAssistantMessage: async (content) => {
      await saveMessage(store, missionId, "assistant", content);
    },
    onBeforeToolExecution: async (toolUseBlocks) => {
      logger?.debug("Tool calls:", toolUseBlocks.map((b) => b.name).join(", "));
    },
    onAfterToolExecution: async (results) => {
      await saveMessage(store, missionId, "user", results);
    },
  };
}

/**
 * Runs a while-true tool-use conversation loop.
 *
 * 1. Calls `chatWithTools` with the initial messages.
 * 2. Parses the response into text blocks and tool_use blocks.
 * 3. If there are tool_use blocks, executes them, calls `continueWithToolResults`,
 *    and loops back to step 2.
 * 4. If there are no tool_use blocks, breaks and returns the accumulated text.
 *
 * Hooks allow route handlers to inject side-effects (DB saves, logging, etc.)
 * at each stage without duplicating the loop logic.
 */
export async function conversationLoop(
  params: ConversationLoopParams
): Promise<ConversationLoopResult> {
  const {
    client,
    toolExecutor,
    missionId,
    systemPrompt,
    initialMessages,
    tools,
    options,
    hooks,
    logger,
    events,
  } = params;

  let currentResponse = await client.chatWithTools(
    systemPrompt,
    initialMessages,
    tools,
    options
  );
  const textParts: string[] = [];
  let priorMessages = initialMessages;
  let toolCallsExecuted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const assistantContent = currentResponse.content;
    const toolUseBlocks: AiToolUseBlock[] = [];

    for (const block of assistantContent) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // Notify hook with the full assistant content (text + tool_use blocks)
    await hooks?.onAssistantMessage?.(assistantContent);

    if (toolUseBlocks.length === 0) {
      if (currentResponse.stop_reason === "max_tokens") {
        const truncated =
          "\n\n[My response was cut short. Could you ask again?]";
        textParts.push(truncated);
        await hooks?.onTruncated?.();
      }
      break;
    }

    const names = toolUseBlocks.map((b) => TOOL_DISPLAY_NAMES[b.name] || b.name);
    events?.emit(missionId, { type: "tool_start", names });

    await hooks?.onBeforeToolExecution?.(toolUseBlocks);

    const results = await toolExecutor.executeToolCalls(
      missionId,
      toolUseBlocks
    );
    toolCallsExecuted += toolUseBlocks.length;

    await hooks?.onAfterToolExecution?.(results);

    events?.emit(missionId, { type: "tool_end", names });

    // Check if any executed tool matches pauseOnTools
    if (params.pauseOnTools) {
      for (const block of toolUseBlocks) {
        if (params.pauseOnTools.has(block.name)) {
          return {
            text: textParts.join("\n"),
            finalMessage: currentResponse,
            toolCallsExecuted,
            pausedToolUse: block,
          };
        }
      }
    }

    const maxTurns = params.maxTurns ?? 20;
    if (toolCallsExecuted >= maxTurns) {
      textParts.push("\n\n[Reached maximum number of tool calls. Please try again with a more specific request.]");
      break;
    }

    currentResponse = await client.continueWithToolResults(
      priorMessages,
      { role: "assistant", content: assistantContent },
      results,
      systemPrompt,
      tools,
      options
    );

    priorMessages = [
      ...priorMessages,
      { role: "assistant" as const, content: assistantContent },
      { role: "user" as const, content: results },
    ];

    logger?.debug(
      "Tool round complete, stop_reason:",
      currentResponse.stop_reason
    );
  }

  return {
    text: textParts.join("\n"),
    finalMessage: currentResponse,
    toolCallsExecuted,
  };
}
