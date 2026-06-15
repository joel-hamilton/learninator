import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import { eq, and, asc } from "drizzle-orm";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop } from "../ai/conversation.js";
import type { AppVariables } from "../types.js";
import { saveMessage, loadMessages } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const chatRoutes = new Hono<{ Variables: AppVariables }>();

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

    const result = await conversationLoop({
      client: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      missionId,
      systemPrompt,
      initialMessages: messages,
      tools: TEACHER_TOOLS,
      logger: log,
      hooks: {
        onAssistantMessage: async (content) => {
          await saveMessage(missionId, "assistant", content);
        },
        onBeforeToolExecution: async (toolUseBlocks) => {
          log.debug("Executing tool calls:", toolUseBlocks.map((b) => b.name).join(", "));
        },
        onAfterToolExecution: async (results) => {
          await saveMessage(missionId, "user", results);
        },
      },
    });

    const text = result.text || "Done! Anything else you'd like to work on?";

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
