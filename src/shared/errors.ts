import { AIError } from "../ai/errors.js";

/**
 * Format an error into a user-facing message string.
 * Handles AIError with recoverable hints. Never throws.
 */
export function formatAIError(err: unknown, fallback?: string): string {
  if (err instanceof AIError) {
    const hint = err.recoverable
      ? " It may help to wait a moment and retry."
      : "";
    return err.message + hint;
  }
  return fallback ?? "Something went wrong. Please try again.";
}
