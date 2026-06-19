import type { ChatMessageRow } from "../db/store.js";
import { contentToText } from "../views/shared.js";
import { formatMarkdown } from "../shared/markdown.js";
import { chatMessageBubble } from "../views/fragments.js";

/**
 * Render chat message rows into HTML bubbles with role-based CSS classes.
 * Returns a default assistant greeting bubble when the list is empty.
 * Skips messages with empty or whitespace-only content.
 *
 * Pure function — no Hono context, no database access.
 */
export function renderChatMessages(rows: ChatMessageRow[], defaultGreeting: string): string {
  if (rows.length === 0) {
    return chatMessageBubble("assistant", defaultGreeting);
  }

  let html = "";
  for (const row of rows) {
    const text = contentToText(row.content);
    if (!text.trim()) continue;
    if (row.role === "user") {
      html += chatMessageBubble("user", formatMarkdown(text));
    } else {
      html += chatMessageBubble("assistant", formatMarkdown(text));
    }
  }
  return html;
}
