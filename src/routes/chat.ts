import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import {
  AIError,
  conversationLoop,
  createStandardHooks,
  TEACHER_SYSTEM_PROMPT,
  TEACHER_TOOLS,
} from "../ai/index.js";import type { AppVariables } from "../types.js";
import { formatMarkdown } from "../shared/markdown.js";
import { chatMessageBubble } from "../views/fragments.js";
import { userInitial } from "../views/shared.js";
import { validateChatMessage, rateLimitedFragment } from "../security/index.js";
import { formatAIError } from "../shared/errors.js";
import { requireMissionAccess } from "../shared/require-mission-access.js";

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
  const chatErr = validateChatMessage(message);
  if (chatErr) return c.html(chatErr);

  const rateLimiter = c.get("rateLimiter");
  if (rateLimiter && !rateLimiter.check(user.id, "chat", 20, 60_000)) {
    return c.html(rateLimitedFragment());
  }

  const mission = await requireMissionAccess(store, missionId, user.id);
  if (!mission) return c.text("Not found", 404);

  const missionChatService = c.get("missionChatService");

  try {
    const result = await missionChatService.run({
      missionId,
      userId: user.id,
      message,
      context: context || undefined,
      missionTitle: mission.title,
      missionStatus: mission.status,
    });

    const text = result.text || "Done! Anything else you'd like to work on?";
    return c.html(chatMessageBubble("assistant", formatMarkdown(text), userInitial(user)));
  } catch (err: unknown) {
    const msg = formatAIError(err);
    return c.html(`<div class="msg assistant" style="color:var(--danger);"><strong>${msg}</strong></div>`);
  }
});
