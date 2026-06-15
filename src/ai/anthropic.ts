import Anthropic from "@anthropic-ai/sdk"
import { createLogger } from "../logger.js"
import { wrapError } from "./errors.js"
import type {
  AiClient,
  AiMessage,
  AiMessageParam,
  AiTool,
  AiToolResultBlockParam,
  ChatOptions,
  ToolCallOptions,
  ModelTier,
} from "./types.js"

const log = createLogger("ai")

const MODEL_HIGH =
  process.env.AI_MODEL_HIGH || "claude-sonnet-4-20250514"
const MODEL_LOW =
  process.env.AI_MODEL_LOW || "claude-haiku-4-5-20251001"

log.debug(
  "AI module loaded — apiKey suffix:",
  (process.env.ANTHROPIC_API_KEY || "").slice(-4)
)

function resolveModel(tier?: ModelTier): string {
  return tier === "low" ? MODEL_LOW : MODEL_HIGH
}

let _client: Anthropic | null = null
let _clientKey = ""
function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY || ""
  const url = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  if (!_client || _clientKey !== key) {
    _client = new Anthropic({ baseURL: url, apiKey: key })
    _clientKey = key
  }
  return _client
}

function buildThinkingParams(options?: ToolCallOptions) {
  const disableThinking = options?.disableThinking ?? true
  const params: Record<string, unknown> = {}
  if (disableThinking) {
    params.thinking = { type: "disabled" }
  } else if (options?.thinkingBudget != null) {
    params.thinking = {
      type: "enabled",
      budget_tokens: options.thinkingBudget,
    }
  }
  return params
}

export class AnthropicAiClient implements AiClient {
  async chat(
    systemPrompt: string,
    messages: AiMessageParam[],
    options?: ChatOptions
  ): Promise<string> {
    try {
      const thinkingParams = buildThinkingParams(options)
      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 4096,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
        ...thinkingParams,
      }

      const response = await getClient().messages.create(params)

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      )
      return textBlocks.map((b) => b.text).join("\n")
    } catch (err) {
      throw wrapError(err)
    }
  }

  async chatWithTools(
    systemPrompt: string,
    messages: AiMessageParam[],
    tools: AiTool[],
    options?: ToolCallOptions
  ): Promise<AiMessage> {
    try {
      const thinkingParams = buildThinkingParams(options)
      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 16000,
        system: systemPrompt,
        messages: messages as Anthropic.MessageParam[],
        tools: tools as Anthropic.Tool[],
        ...thinkingParams,
      }

      const response = await getClient().messages.create(params)

      log.debug("AI tool response stop_reason:", response.stop_reason)
      log.debug(
        "AI tool response blocks:",
        response.content.map((b: { type: string }) => b.type).join(", ")
      )

      return response as unknown as AiMessage
    } catch (err) {
      throw wrapError(err)
    }
  }

  async continueWithToolResults(
    priorMessages: AiMessageParam[],
    assistantMessage: AiMessageParam,
    toolResults: AiToolResultBlockParam[],
    systemPrompt: string,
    tools: AiTool[],
    options?: ToolCallOptions
  ): Promise<AiMessage> {
    try {
      const messages: Anthropic.MessageParam[] = [
        ...(priorMessages as Anthropic.MessageParam[]),
        assistantMessage as Anthropic.MessageParam,
        { role: "user", content: toolResults as any },
      ]

      const thinkingParams = buildThinkingParams(options)
      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 16000,
        system: systemPrompt,
        messages,
        tools: tools as Anthropic.Tool[],
        ...thinkingParams,
      }

      const response = await getClient().messages.create(params)

      log.debug("AI continue stop_reason:", response.stop_reason)
      log.debug(
        "AI continue blocks:",
        response.content.map((b: { type: string }) => b.type).join(", ")
      )

      return response as unknown as AiMessage
    } catch (err) {
      throw wrapError(err)
    }
  }
}
