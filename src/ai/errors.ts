import { createLogger } from "../logger.js"

const log = createLogger("ai")

/** Human-readable error for end users, not raw API errors. */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly recoverable: boolean = false
  ) {
    super(message)
    this.name = "AIError"
  }
}

export function wrapError(err: unknown): never {
  if (err instanceof AIError) throw err

  // Anthropic SDK errors
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: number }).status
    if (status === 401 || status === 403) {
      throw new AIError(
        "The AI service is not configured correctly. Please check the API key and try again.",
        status,
        false
      )
    }
    if (status === 429) {
      throw new AIError(
        "The AI service is busy right now. Please wait a moment and try again.",
        status,
        true
      )
    }
    if (status && status >= 500) {
      throw new AIError(
        "The AI service is experiencing issues. Please try again in a few minutes.",
        status,
        true
      )
    }
  }

  // Network errors
  if (err instanceof Error) {
    if (err.message.includes("ENOTFOUND") || err.message.includes("ECONNREFUSED")) {
      throw new AIError(
        "Cannot reach the AI service. Please check your internet connection.",
        undefined,
        true
      )
    }
    if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
      throw new AIError(
        "The AI service took too long to respond. Please try again.",
        undefined,
        true
      )
    }
  }

  // Fallback — log the real error but don't expose it
  log.error("AI call failed:", err)
  throw new AIError(
    "Something went wrong with the AI service. Please try again.",
    undefined,
    true
  )
}
