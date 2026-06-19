// ── Types ───────────────────────────────────────────────────────────
export type {
  AiClient,
  AiContentBlock,
  AiMessage,
  AiMessageContent,
  AiMessageParam,
  AiTextBlock,
  AiTool,
  AiToolResultBlockParam,
  AiToolUseBlock,
  ChatOptions,
  ModelTier,
  ToolCallOptions,
  ToolExecutor,
  ToolHandler,
  ToolHandlerContext,
} from "./types.js"

// ── Implementations ─────────────────────────────────────────────────
export { AnthropicAiClient } from "./anthropic.js"
export { FakeAiClient } from "./fake.js"
export { AIError } from "./errors.js"

// ── Conversation ────────────────────────────────────────────────────
export {
  conversationLoop,
  createStandardHooks,
} from "./conversation.js"
export type {
  ConversationHooks,
  ConversationLoopParams,
  ConversationLoopResult,
  StandardHooksDeps,
} from "./conversation.js"

// ── Teacher ─────────────────────────────────────────────────────────
export {
  TEACHER_SYSTEM_PROMPT,
  TEACHER_TOOLS,
  getRegenerateSystemPrompt,
  getBridgingSystemPrompt,
} from "./teacher.js"

// ── Tools ───────────────────────────────────────────────────────────
export { TOOL_DISPLAY_NAMES, createToolExecutor } from "./tools.js"

// ── Events ──────────────────────────────────────────────────────────
export { createEventBus } from "./events.js"
export type { ToolEventBus, WorkflowEventBus, ToolEvent, WorkflowEvent } from "./events.js"

// ── Workflow state ──────────────────────────────────────────────────
export { WorkflowStateManager, toolDisplayLabel } from "./workflow-state.js"
export type { WorkflowRun, WorkflowStep } from "./workflow-state.js"
