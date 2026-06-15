import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { ai } from "../ai/index.js";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { executeToolCalls } from "../ai/tools.js";
import { marked } from "marked";
import type Anthropic from "@anthropic-ai/sdk";
import type { AppVariables } from "../types.js";

// re-eval marker

type Ctx = Context<{ Variables: AppVariables }>;
export const chatRoutes = new Hono<{ Variables: AppVariables }>();

/** Extract display text from stored message content (JSON). */
function contentToText(content: string): string {
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

/** Escape HTML entities in user-provided text. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convert markdown to HTML for display. */
function formatMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

/** Save a single message to the chat history. */
async function saveMessage(missionId: number, role: "user" | "assistant", content: unknown) {
  await db.insert(schema.chatMessages).values({
    missionId,
    role,
    content: JSON.stringify(content),
  });
}

/** Load chat messages from DB and convert to Anthropic format. */
async function loadMessages(missionId: number): Promise<Anthropic.MessageParam[]> {
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

chatRoutes.post("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const context = String(body.context || "");

  if (!message) {
    return c.html(`<div class="msg assistant" style="background:#fff;border:1px solid #e8e4dc;padding:0.75rem 1rem;border-radius:8px;">I didn't catch that — what would you like to work on?</div>`);
  }

  const [mission] = await db
    .select()
    .from(schema.missions)
    .where(and(eq(schema.missions.id, missionId), eq(schema.missions.userId, user.id)))
    .limit(1);
  if (!mission) return c.text("Not found", 404);

  const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}
Mission status: ${mission.status}

Remember: read existing content before creating new material. Use list_lessons and list_learning_records to understand what the user has already learned.`;

  const messages = await loadMessages(missionId);

  let userContent = message;
  if (context) {
    userContent = `[Context: ${context}]\n\n${message}`;
  }
  messages.push({ role: "user", content: userContent });

  const log = c.get("logger");

  try {
    await saveMessage(missionId, "user", userContent);

    let currentResponse = await ai.chatWithTools(systemPrompt, messages, TEACHER_TOOLS);
    const textParts: string[] = [];
    let priorMessages = messages; // grows as we accumulate tool rounds

    // Loop until the AI stops asking for tools
    while (true) {
      const assistantContent = currentResponse.content;
      const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
      for (const block of assistantContent) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolUseBlocks.push(block);
        }
      }

      if (toolUseBlocks.length === 0) {
        // Final response — save it and stop
        if (currentResponse.stop_reason === "max_tokens") {
          textParts.push("\n\n[My response was cut short. Could you ask again?]");
        }
        await saveMessage(missionId, "assistant", assistantContent);
        break;
      }

      log.debug("Executing tool calls:", toolUseBlocks.map((b) => b.name).join(", "));

      // Save assistant message with tool calls
      await saveMessage(missionId, "assistant", assistantContent);

      // Execute tools and save results
      const results = await executeToolCalls(missionId, toolUseBlocks);
      await saveMessage(missionId, "user", results);

      // Continue with tool results
      currentResponse = await ai.continueWithToolResults(
        priorMessages,
        { role: "assistant", content: assistantContent },
        results,
        systemPrompt,
        TEACHER_TOOLS
      );

      // Extend conversation for any subsequent tool rounds
      priorMessages = [
        ...priorMessages,
        { role: "assistant" as const, content: assistantContent },
        { role: "user" as const, content: results },
      ];

      log.debug("Tool round complete, stop_reason:", currentResponse.stop_reason);
    }

    const text = textParts.join("\n") || "Done! Anything else you'd like to work on?";

    return c.html(`
      <div class="msg assistant markdown-body" style="background:#fff;border:1px solid #e8e4dc;padding:0.75rem 1rem;border-radius:8px;line-height:1.5;max-width:85%;">${formatMarkdown(text)}</div>
    `);
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>${err.recoverable ? " It may help to wait a moment and retry." : ""}`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="background:#fff;border:1px solid #e8e4dc;padding:0.75rem 1rem;border-radius:8px;color:#8b2e2e;">${msg}</div>`);
  }
});
