export interface AiTextBlock {
  type: "text"
  text: string
}

export interface AiToolUseBlock {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

export type AiContentBlock = AiTextBlock | AiToolUseBlock

/** Union of all content block types that can appear in a message param sent to the API (includes tool result). */
export type AiMessageContent = AiContentBlock | AiToolResultBlockParam

export interface AiMessageParam {
  role: "user" | "assistant"
  content: string | AiMessageContent[]
}

export interface AiMessage {
  content: AiContentBlock[]
  stop_reason: "end_turn" | "max_tokens" | "tool_use" | null
}

export interface AiToolResultBlockParam {
  type: "tool_result"
  tool_use_id: string
  content: string
}

export interface AiTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type ModelTier = "high" | "low"

export interface ChatOptions {
  model?: ModelTier
  maxTokens?: number
  disableThinking?: boolean
}

export interface ToolCallOptions extends ChatOptions {
  thinkingBudget?: number
}

export interface AiClient {
  chat(
    systemPrompt: string,
    messages: AiMessageParam[],
    options?: ChatOptions
  ): Promise<string>

  chatWithTools(
    systemPrompt: string,
    messages: AiMessageParam[],
    tools: AiTool[],
    options?: ToolCallOptions
  ): Promise<AiMessage>

  continueWithToolResults(
    priorMessages: AiMessageParam[],
    assistantMessage: AiMessageParam,
    toolResults: AiToolResultBlockParam[],
    systemPrompt: string,
    tools: AiTool[],
    options?: ToolCallOptions
  ): Promise<AiMessage>
}

import type { DrizzleMissionStore } from "../db/store.js";

export interface ToolHandlerContext {
  store: DrizzleMissionStore
  missionId: number
  input: Record<string, unknown>
}

export type ToolHandler = (ctx: ToolHandlerContext) => Promise<string>

export interface ToolExecutor {
  executeTool(
    missionId: number,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<string>

  executeToolCalls(
    missionId: number,
    toolUseBlocks: AiToolUseBlock[]
  ): Promise<AiToolResultBlockParam[]>
}
