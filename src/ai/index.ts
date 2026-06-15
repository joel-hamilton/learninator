import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createLogger } from "../logger.js";

const log = createLogger("ai");

export interface ToolCallOptions {
  model?: ModelTier;
  maxTokens?: number;
  /** Disable extended thinking for reasoning models (saves output tokens for tool calls). Default true for chatWithTools. */
  disableThinking?: boolean;
  /** Budget tokens for thinking when enabled. Default 2048. */
  thinkingBudget?: number;
}

// Read .env directly to bypass shell env vars (dotenv doesn't override by default)
function loadEnvOverride(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

const envOverrides = loadEnvOverride();

// Force .env values into process.env so all code paths use correct values
for (const [key, value] of Object.entries(envOverrides)) {
  process.env[key] = value;
}

// Use globalThis so even cached old module code gets the correct key
const g = globalThis as Record<string, unknown>;
g.__LEARNINATOR_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
g.__LEARNINATOR_ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const MODEL_HIGH = process.env.AI_MODEL_HIGH || "claude-sonnet-4-20250514";
const MODEL_LOW = process.env.AI_MODEL_LOW || "claude-haiku-4-5-20251001";

log.debug("AI module loaded — apiKey suffix:", (g.__LEARNINATOR_ANTHROPIC_API_KEY as string).slice(-4));

export type ModelTier = "high" | "low";

function resolveModel(tier?: ModelTier): string {
  return tier === "low" ? MODEL_LOW : MODEL_HIGH;
}

let _client: Anthropic | null = null;
let _clientKey = "";
function getClient(): Anthropic {
  const g = globalThis as Record<string, unknown>;
  const key = (g.__LEARNINATOR_ANTHROPIC_API_KEY as string) || "";
  const url = (g.__LEARNINATOR_ANTHROPIC_BASE_URL as string) || "https://api.anthropic.com";
  // Recreate client if API key changed (handles tsx watch stale module references)
  if (!_client || _clientKey !== key) {
    _client = new Anthropic({ baseURL: url, apiKey: key });
    _clientKey = key;
  }
  return _client;
}

/** Human-readable error for end users, not raw API errors. */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = "AIError";
  }
}

function wrapError(err: unknown): never {
  if (err instanceof AIError) throw err;

  // Anthropic SDK errors
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: number }).status;
    if (status === 401 || status === 403) {
      throw new AIError(
        "The AI service is not configured correctly. Please check the API key and try again.",
        status,
        false
      );
    }
    if (status === 429) {
      throw new AIError(
        "The AI service is busy right now. Please wait a moment and try again.",
        status,
        true
      );
    }
    if (status && status >= 500) {
      throw new AIError(
        "The AI service is experiencing issues. Please try again in a few minutes.",
        status,
        true
      );
    }
  }

  // Network errors
  if (err instanceof Error) {
    if (err.message.includes("ENOTFOUND") || err.message.includes("ECONNREFUSED")) {
      throw new AIError(
        "Cannot reach the AI service. Please check your internet connection.",
        undefined,
        true
      );
    }
    if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
      throw new AIError(
        "The AI service took too long to respond. Please try again.",
        undefined,
        true
      );
    }
  }

  // Fallback — log the real error but don't expose it
  log.error("AI call failed:", err);
  throw new AIError(
    "Something went wrong with the AI service. Please try again.",
    undefined,
    true
  );
}

export const ai = {
  async chat(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    options?: { model?: ModelTier; maxTokens?: number; disableThinking?: boolean }
  ): Promise<string> {
    try {
      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 4096,
        system: systemPrompt,
        messages,
      };
      if (options?.disableThinking) {
        (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
      }

      const response = await getClient().messages.create(params);

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      return textBlocks.map((b) => b.text).join("\n");
    } catch (err) {
      throw wrapError(err);
    }
  },

  async chatWithTools(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    tools: Anthropic.Tool[],
    options?: ToolCallOptions
  ): Promise<Anthropic.Message> {
    try {
      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 16000,
        system: systemPrompt,
        messages,
        tools,
      };
      // Disable thinking by default for tool calls — reasoning models
      // burn output tokens on thinking blocks, starving tool_use blocks.
      const disableThinking = options?.disableThinking ?? true;
      if (disableThinking) {
        (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
      } else if (options?.thinkingBudget != null) {
        (params as unknown as Record<string, unknown>).thinking = {
          type: "enabled",
          budget_tokens: options.thinkingBudget,
        };
      }

      const response = await getClient().messages.create(params);

      log.debug("AI tool response stop_reason:", response.stop_reason);
      log.debug("AI tool response blocks:", response.content.map((b: { type: string }) => b.type).join(", "));

      return response;
    } catch (err) {
      throw wrapError(err);
    }
  },

  async continueWithToolResults(
    priorMessages: Anthropic.MessageParam[],
    assistantMessage: Anthropic.MessageParam,
    toolResults: Anthropic.ToolResultBlockParam[],
    systemPrompt: string,
    tools: Anthropic.Tool[],
    options?: ToolCallOptions
  ): Promise<Anthropic.Message> {
    try {
      const messages: Anthropic.MessageParam[] = [
        ...priorMessages,
        assistantMessage,
        { role: "user", content: toolResults },
      ];

      const params: Anthropic.MessageCreateParams = {
        model: resolveModel(options?.model),
        max_tokens: options?.maxTokens || 16000,
        system: systemPrompt,
        messages,
        tools,
      };
      const disableThinking = options?.disableThinking ?? true;
      if (disableThinking) {
        (params as unknown as Record<string, unknown>).thinking = { type: "disabled" };
      } else if (options?.thinkingBudget != null) {
        (params as unknown as Record<string, unknown>).thinking = {
          type: "enabled",
          budget_tokens: options.thinkingBudget,
        };
      }

      const response = await getClient().messages.create(params);

      log.debug("AI continue stop_reason:", response.stop_reason);
      log.debug("AI continue blocks:", response.content.map((b: { type: string }) => b.type).join(", "));

      return response;
    } catch (err) {
      throw wrapError(err);
    }
  },
};
