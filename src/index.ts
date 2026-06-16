import "./env.js";
// ↑ must be first — walks up the directory tree to find .env before
// other imports read process.env at module load time

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { AppVariables } from "./types.js";
import { createLogger } from "./logger.js";
import { AnthropicAiClient } from "./ai/anthropic.js";
import { createToolExecutor } from "./ai/tools.js";
import { db } from "./db/index.js";
import { DrizzleMissionStore } from "./db/store.js";
import { auth } from "./auth/index.js";
import { homeRoutes } from "./routes/home.js";
import { missionRoutes } from "./routes/missions.js";
import { lessonRoutes } from "./routes/lessons.js";
import { chatRoutes } from "./routes/chat.js";
import { settingsApp } from "./routes/settings.js";
import { browseRoutes } from "./routes/browse.js";

const app = new Hono<{ Variables: AppVariables }>();

// Logger injection
app.use("*", async (c, next) => {
  c.set("logger", createLogger("http"));
  await next();
});

// AI client + tool executor injection
app.use("*", async (c, next) => {
  c.set("ai", new AnthropicAiClient());
  c.set("toolExecutor", createToolExecutor(new DrizzleMissionStore(db)));
  await next();
});

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.get("logger").info(`${c.req.method} ${c.req.path} — ${c.res.status} (${ms}ms)`);
});

app.get("/favicon.ico", (c) => {
  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2d2d2d"/><text x="16" y="22" text-anchor="middle" font-size="18" font-family="system-ui" fill="#fff">L</text></svg>`);
});

app.use("*", auth.sessionMiddleware);
app.route("/", auth.authApp);
app.route("/", homeRoutes);
app.route("/", browseRoutes);
app.route("/missions", missionRoutes);
app.route("/missions/:missionId/lessons", lessonRoutes);
app.route("/missions/:missionId/chat", chatRoutes);
app.use("/settings", auth.requireAuth);
app.use("/settings/*", auth.requireAuth);
app.route("/settings", settingsApp);

const port = parseInt(process.env.PORT || "3000");
console.log(`Learninator running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
