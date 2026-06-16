import { db, schema } from "../db/index.js";
import { eq, asc } from "drizzle-orm";
import type { AiMessageParam } from "../ai/types.js";

export async function saveMessage(missionId: number, role: "user" | "assistant", content: unknown) {
  await db.insert(schema.chatMessages).values({
    missionId,
    role,
    content: JSON.stringify(content),
  });
}

export async function loadMessages(missionId: number): Promise<AiMessageParam[]> {
  const rows = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, missionId))
    .orderBy(asc(schema.chatMessages.createdAt));

  return rows.map((row) => ({
    role: row.role as "user" | "assistant",
    content: JSON.parse(row.content),
  }));
}

export function contentToText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((b: { type: string; text?: string; content?: string }) => {
          if (b.type === "text" && b.text) return b.text;
          if (b.type === "tool_result" && b.content) return b.content;
          return "";
        })
        .filter((s) => s.length > 0)
        .join("\n");
    }
    return String(parsed);
  } catch {
    return content;
  }
}
