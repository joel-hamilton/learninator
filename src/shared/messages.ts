import { eq, asc } from "drizzle-orm";
import type { AiMessageParam } from "../ai/types.js";
import type { MissionStore } from "../db/store.js";

export async function saveMessage(store: MissionStore, missionId: number, role: "user" | "assistant", content: unknown) {
  await store.saveChatMessage({
    missionId,
    role,
    content: JSON.stringify(content),
  });
}

export async function loadMessages(store: MissionStore, missionId: number): Promise<AiMessageParam[]> {
  const rows = await store.getChatMessages(missionId);

  const messages: AiMessageParam[] = [];
  let lastAssistantToolUseIds: Set<string> | null = null;

  for (const row of rows) {
    const parsed = JSON.parse(row.content);

    if (row.role === "assistant") {
      // Collect tool_use IDs from this assistant message
      lastAssistantToolUseIds = null;
      if (Array.isArray(parsed)) {
        const ids = new Set<string>();
        for (const block of parsed) {
          if (block.type === "tool_use" && block.id) {
            ids.add(block.id);
          }
        }
        if (ids.size > 0) lastAssistantToolUseIds = ids;
      }
      messages.push({ role: "assistant", content: parsed });
    } else {
      // For user messages, check if it's a tool_result that references orphaned tool_use IDs
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type === "tool_result") {
        if (lastAssistantToolUseIds) {
          // Keep only results whose tool_use_id appeared in the preceding assistant message
          const valid = parsed.filter(
            (b: any) => b.type === "tool_result" && lastAssistantToolUseIds!.has(b.tool_use_id)
          );
          if (valid.length > 0) {
            messages.push({ role: "user", content: valid });
          }
          // If none are valid, skip this message entirely
        }
        // If no preceding assistant with tool_use IDs, skip orphaned tool_results
      } else {
        messages.push({ role: "user", content: parsed });
      }
    }
  }

  return messages;
}

export function contentToText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n");
    }
    return String(parsed);
  } catch {
    return content;
  }
}
