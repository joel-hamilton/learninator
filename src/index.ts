import "./env.js";
// ↑ must be first — walks up the directory tree to find .env before
// other imports read process.env at module load time

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { AppVariables } from "./types.js";
import { createLogger } from "./logger.js";
import { AnthropicAiClient } from "./ai/anthropic.js";
import { createToolExecutor } from "./ai/tools.js";
import { createEventBus } from "./ai/events.js";
import { WorkflowStateManager } from "./ai/workflow-state.js";
import { createObservability } from "./observability/index.js";
import { SlidingWindowRateLimiter } from "./security/rate-limiter.js";
import type { RateLimiter } from "./security/rate-limiter.js";
import { db } from "./db/index.js";
import { DrizzleMissionStore } from "./db/store.js";
import { auth } from "./auth/index.js";
import { createLessonGenerator } from "./lessons/generator.js";
import { createMissionChatService } from "./services/mission-chat.service.js";
import { homeRoutes } from "./routes/home.js";
import { missionRoutes } from "./routes/missions.js";
import { lessonRoutes } from "./routes/lessons.js";

import { settingsApp } from "./routes/settings.js";
import { browseRoutes } from "./routes/browse.js";
import { profileReport } from "./views/profile.js";
import type { AiClient } from "./ai/types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "./db/schema.js";

export function createApp(opts?: {
  db?: BetterSQLite3Database<typeof schema>;
  ai?: AiClient;
  rateLimiter?: RateLimiter | null;
}) {
  const resolvedDb = opts?.db ?? db;
  const resolvedAi = opts?.ai ?? new AnthropicAiClient();
  const resolvedRateLimiter = opts?.rateLimiter !== undefined ? opts.rateLimiter : new SlidingWindowRateLimiter();

  const app = new Hono<{ Variables: AppVariables }>();

  const store = new DrizzleMissionStore(resolvedDb);
  const eventBus = createEventBus();
  const workflowState = new WorkflowStateManager(eventBus);
  const observability = createObservability();

  // Store + logger + events + rate limiter + profile injection
  app.use("*", async (c, next) => {
    c.set("store", store);
    c.set("logger", createLogger("http"));
    c.set("events", eventBus);
    c.set("workflowState", workflowState);
    c.set("profileStore", observability.profileStore);
    c.set("rateLimiter", resolvedRateLimiter);
    await next();
  });

  // AI client + tool executor + lesson generator + service injection
  const toolExecutor = createToolExecutor(store);
  const lessonGenerator = createLessonGenerator({
    ai: resolvedAi,
    toolExecutor,
    db: resolvedDb,
    logger: createLogger("generator"),
  });
  const missionChatService = createMissionChatService({
    ai: resolvedAi,
    toolExecutor,
    store,
    logger: createLogger("chat"),
    events: eventBus,
    workflowState,
  });
  app.use("*", async (c, next) => {
    c.set("ai", resolvedAi);
    c.set("toolExecutor", toolExecutor);
    c.set("lessonGenerator", lessonGenerator);
    c.set("missionChatService", missionChatService);
    await next();
  });

  // Observability middleware (request ID + debug timing when DEBUG=1)
  observability.middleware.forEach((m) => app.use("*", m));

  app.get("/favicon.ico", (c) => {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=86400");
    return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2d2d2d"/><text x="16" y="22" text-anchor="middle" font-size="18" font-family="system-ui" fill="#fff">L</text></svg>`);
  });

  app.use("*", auth.sessionMiddleware);

  // Profile report (authenticated; only active when PROFILE is enabled)
  app.get("/debug/profile", auth.requireAuth, async (c) => {
    const ps = c.get("profileStore");
    if (!ps || !ps.isEnabled()) {
      return c.html(
        "<p>Profiling disabled. Set <code>PROFILE=1</code> to enable.</p>",
        404,
      );
    }
    return c.html(profileReport(ps.generateReport()));
  });

  app.route("/", auth.authApp);
  app.route("/", homeRoutes);
  app.route("/", browseRoutes);
  app.route("/missions", missionRoutes);
  app.route("/missions/:missionId/lessons", lessonRoutes);
  
  app.use("/settings", auth.requireAuth);
  app.use("/settings/*", auth.requireAuth);
  app.route("/settings", settingsApp);

  return app;
}

// Production server startup (skipped during tests)
if (!process.env.VITEST) {
  const app = createApp();
  const port = parseInt(process.env.PORT || "3000");
  console.log(`Learninator running on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
