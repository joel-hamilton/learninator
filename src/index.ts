import dotenv from "dotenv";
dotenv.config({ override: true });
// Force env override — .env values take priority over shell env vars

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { AppVariables } from "./types.js";
import { auth } from "./auth/index.js";
import { homeRoutes } from "./routes/home.js";
import { missionRoutes } from "./routes/missions.js";
import { lessonRoutes } from "./routes/lessons.js";
import { chatRoutes } from "./routes/chat.js";

const app = new Hono<{ Variables: AppVariables }>();


// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} — ${c.res.status} (${ms}ms)`);
});

app.use("*", auth.sessionMiddleware);
app.route("/", auth.authApp);
app.route("/", homeRoutes);
app.route("/missions", missionRoutes);
app.route("/missions/:missionId/lessons", lessonRoutes);
app.route("/missions/:missionId/chat", chatRoutes);

const port = parseInt(process.env.PORT || "3000");
console.log(`Learninator running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
