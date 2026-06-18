// Character limits for user-submitted inputs
export const MAX_CHAT_MESSAGE = 10_000;
export const MAX_MISSION_TITLE = 200;
export const MAX_FEEDBACK_TEXT = 2_000;
export const MAX_NOTES_TEXT = 1_000;
export const MAX_GUIDED_ANSWER = 5_000;

// ── Error fragment helpers ────────────────────────────────────────────

export function inputTooLongFragment(message: string): string {
  return `<div class="msg assistant" style="color:var(--danger);">${message}</div>`;
}

export function rateLimitedFragment(): string {
  return `<div class="msg assistant" style="color:var(--danger);">You're sending messages too quickly. Please wait a moment before sending another.</div>`;
}

// ── Specific validators ────────────────────────────────────────────────

/** Returns error HTML fragment if too long, null if valid. */
export function validateChatMessage(text: string): string | null {
  if (text.length > MAX_CHAT_MESSAGE) {
    return inputTooLongFragment(
      `Your message is too long (${text.length.toLocaleString()} characters). Please shorten it to under ${MAX_CHAT_MESSAGE.toLocaleString()} characters.`,
    );
  }
  return null;
}

/** Returns error HTML fragment if too long, null if valid. */
export function validateTitle(text: string): string | null {
  if (text.length > MAX_MISSION_TITLE) {
    return `<span style="color:var(--danger);">Title must be ${MAX_MISSION_TITLE} characters or fewer.</span>`;
  }
  return null;
}

/** Returns error HTML fragment if too long, null if valid. */
export function validateTopic(text: string): string | null {
  if (text.length > MAX_MISSION_TITLE) {
    return inputTooLongFragment(
      `That topic is a bit long — please keep it under ${MAX_MISSION_TITLE} characters.`,
    );
  }
  return null;
}

/** Returns error HTML fragment if too long, null if valid. */
export function validateFeedback(text: string): string | null {
  if (text.length > MAX_FEEDBACK_TEXT) {
    return inputTooLongFragment(
      `Feedback text must be under ${MAX_FEEDBACK_TEXT.toLocaleString()} characters.`,
    );
  }
  return null;
}

/** Returns error HTML fragment if too long, null if valid. */
export function validateNotes(text: string): string | null {
  if (text.length > MAX_NOTES_TEXT) {
    return inputTooLongFragment(
      `Notes must be under ${MAX_NOTES_TEXT.toLocaleString()} characters.`,
    );
  }
  return null;
}

/** Returns error HTML fragment if combined answer+other_text is too long, null if valid. */
export function validateGuidedAnswer(answer: string, otherText: string): string | null {
  const combined = answer + otherText;
  if (combined.length > MAX_GUIDED_ANSWER) {
    return inputTooLongFragment(
      `Your answer is too long (${combined.length.toLocaleString()} characters). Please shorten it to under ${MAX_GUIDED_ANSWER.toLocaleString()} characters.`,
    );
  }
  return null;
}
