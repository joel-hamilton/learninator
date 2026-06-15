// Re-export types
export type {
  AiClient,
  AiMessage,
  AiMessageParam,
  AiToolUseBlock,
  AiTool,
  AiToolResultBlockParam,
  ModelTier,
  ToolCallOptions,
  ChatOptions,
  ToolHandler,
  ToolExecutor,
  ToolHandlerContext,
} from "./types.js"

// Re-export implementations
export { AnthropicAiClient } from "./anthropic.js"
export { FakeAiClient } from "./fake.js"
export { AIError } from "./errors.js"

// Legacy singleton for backward compat (routes still import this)
import { AnthropicAiClient } from "./anthropic.js"
export const ai = new AnthropicAiClient()
