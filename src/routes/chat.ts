import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { AIError } from "../ai/index.js";
import { TEACHER_SYSTEM_PROMPT, TEACHER_TOOLS } from "../ai/teacher.js";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import type { AppVariables } from "../types.js";
import { saveMessage, loadMessages } from "../shared/messages.js";
import { formatMarkdown } from "../shared/markdown.js";
import { chatMessageBubble } from "../views/fragments.js";
import { userInitial } from "../views/shared.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const chatRoutes = new Hono<{ Variables: AppVariables }>();

chatRoutes.post("/", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const store = c.get("store");
  const missionId = parseInt(c.req.param("missionId")!);
  const body = await c.req.parseBody();
  const message = String(body.message || "").trim();
  const context = String(body.context || "");

  if (!message) {
    return c.html(`<div class="msg assistant">I didn't catch that — what would you like to work on?</div>`);
  }

  const mission = await store.getMission(missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const systemPrompt = TEACHER_SYSTEM_PROMPT + `
The current mission ID is ${missionId}.
Mission title: ${mission.title}
Mission status: ${mission.status}

Remember: read existing content before creating new material. Use list_lessons and list_learning_records to understand what the user has already learned.`;

  const messages = await loadMessages(store, missionId);

  let userContent = message;
  if (context) {
    userContent = `[Context: ${context}]\n\n${message}`;
  }
  messages.push({ role: "user", content: userContent });

  const log = c.get("logger");

  try {
    await saveMessage(store, missionId, "user", userContent);

    const result = await conversationLoop({
      client: c.get("ai"),
      toolExecutor: c.get("toolExecutor"),
      missionId,
      systemPrompt,
      initialMessages: messages,
      tools: TEACHER_TOOLS,
      logger: log,
      hooks: createStandardHooks({ missionId, store, logger: log }),
    });

    const text = result.text || "Done! Anything else you'd like to work on?";

    return c.html(chatMessageBubble("assistant", formatMarkdown(text), userInitial(user)));
  } catch (err: unknown) {
    const msg = err instanceof AIError
      ? `<strong>${err.message}</strong>${err.recoverable ? " It may help to wait a moment and retry." : ""}`
      : "Something went wrong. Please try again.";
    return c.html(`<div class="msg assistant" style="color:var(--danger);">${msg}</div>`);
  }
});
