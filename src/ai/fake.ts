import type {
  AiClient,
  AiMessage,
  AiMessageParam,
  AiTool,
  AiToolResultBlockParam,
  ChatOptions,
  ToolCallOptions,
} from "./types.js"

export class FakeAiClient implements AiClient {
  private responses: AiMessage[]
  private callIndex = 0

  constructor(responses: AiMessage[]) {
    this.responses = responses
  }

  async chat(
    _systemPrompt: string,
    _messages: AiMessageParam[],
    _options?: ChatOptions
  ): Promise<string> {
    const response =
      this.responses[this.callIndex] ??
      (FakeAiClient.textResponse("Fallback") as AiMessage)
    this.callIndex++
    const textBlocks = (response as AiMessage).content.filter(
      (b: any) => b.type === "text"
    ) as any[]
    return textBlocks.map((b: any) => b.text).join("\n")
  }

  async chatWithTools(
    _systemPrompt: string,
    _messages: AiMessageParam[],
    _tools: AiTool[],
    _options?: ToolCallOptions
  ): Promise<AiMessage> {
    const response =
      this.responses[this.callIndex] ??
      FakeAiClient.textResponse("Fallback")
    this.callIndex++
    return response
  }

  async continueWithToolResults(
    priorMessages: AiMessageParam[],
    assistantMessage: AiMessageParam,
    toolResults: AiToolResultBlockParam[],
    systemPrompt: string,
    tools: AiTool[],
    options?: ToolCallOptions
  ): Promise<AiMessage> {
    return this.chatWithTools(
      systemPrompt,
      [
        ...priorMessages,
        assistantMessage,
        { role: "user", content: toolResults },
      ],
      tools,
      options
    )
  }

  static textResponse(text: string): AiMessage {
    return {
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
    }
  }

  static toolUseResponse(
    toolName: string,
    input: Record<string, unknown> = {}
  ): AiMessage {
    return {
      content: [
        {
          type: "tool_use",
          id: `tu_${Date.now()}`,
          name: toolName,
          input,
        },
      ],
      stop_reason: "tool_use",
    }
  }

  static maxTokensResponse(text: string): AiMessage {
    return {
      content: [{ type: "text", text }],
      stop_reason: "max_tokens",
    }
  }
}
