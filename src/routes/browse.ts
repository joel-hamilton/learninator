import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import type { MissionStore } from "../db/store.js";
import { layout } from "../views/home.js";
import { browsePage, browseOptionsFragment, refreshOptionsFragment, optionsOnly, errorState, BROWSE_STYLES } from "../views/browse.js";
import { createTopicExplorer, type TopicExplorer } from "../browse/explorer.js";
import { generateSlug } from "../shared/slug.js";
import { AIError } from "../ai/errors.js";
import { saveMessage } from "../ai/persistence.js";

type Ctx = Context<{ Variables: AppVariables }>;

function getExplorer(c: Ctx): TopicExplorer {
  return createTopicExplorer({ ai: c.get("ai"), logger: c.get("logger") });
}

export const browseRoutes = new Hono<{ Variables: AppVariables }>();

async function createMissionAndRedirect(c: Ctx, topic: string, path: string[]): Promise<Response> {
  const log = c.get("logger");
  const store = c.get("store");
  const slug = generateSlug(topic);
  const mission = await store.createMission({ userId: c.get("user")!.id, title: topic, slug, onboardingMode: "guided" });

  // Save a seed message so the guided onboarding has context
  const pathStr = path.length > 0 ? `\n\nBrowse path: ${path.join(" → ")}` : "";
  await saveMessage(store, mission.id, "user", `I want to learn about: ${topic}${pathStr}`);

  log.debug("Created mission %d from browse: %s", mission.id, topic);
  c.header("HX-Redirect", `/missions/${mission.id}`);
  return c.body(null);
}

// ── GET /browse ──
// Returns instantly with skeleton placeholders. The real options load via htmx GET /browse/options.
browseRoutes.get("/browse", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  return c.html(layout(user, BROWSE_STYLES + browsePage()));
});

// ── GET /browse/options ──
// Triggers on page load (hx-trigger="load") to fetch real topic options.
browseRoutes.get("/browse/options", auth.requireAuth, async (c: Ctx) => {
  const pathRaw = c.req.query("path") || "[]";
  const iterationStr = c.req.query("iteration") || "0";
  let path: string[];
  try { path = JSON.parse(pathRaw); if (!Array.isArray(path)) path = []; } catch { path = []; }
  const iteration = parseInt(iterationStr) || 0;

  const explorer = getExplorer(c);
  const result = await explorer.explore(path, iteration);
  return c.html(optionsOnly(result.options, path, iteration, result.isLastQuestion));
});

// ── POST /browse/select ──
browseRoutes.post("/browse/select", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const log = c.get("logger");

  const body = await c.req.parseBody();
  const selection = String(body.selection || "").trim();
  const pathRaw = String(body.path || "[]");
  const iterationStr = String(body.iteration || "0");
  const isCustom = String(body.is_custom || "") === "true";

  if (!selection) return c.text("Missing selection", 400);
  if (selection.length > 500) return c.text("Selection too long", 400);

  let path: string[];
  try {
    path = JSON.parse(pathRaw);
    if (!Array.isArray(path)) path = [];
  } catch {
    path = [];
  }
  const iteration = parseInt(iterationStr);

  const explorer = getExplorer(c);
  try {
    const result = await explorer.select(path, selection, iteration, isCustom);

    if (result.type === "create_mission") {
      return createMissionAndRedirect(c, result.topic, result.path);
    }

    return c.html(BROWSE_STYLES + browseOptionsFragment(result.options, result.path, result.iteration, result.isLastQuestion));
  } catch (err) {
    log.error("Browse select AI error:", err);
    const msg = err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again.";
    return c.html(BROWSE_STYLES + errorState(msg));
  }
});

// ── POST /browse/refresh ──
browseRoutes.post("/browse/refresh", auth.requireAuth, async (c: Ctx) => {
  const log = c.get("logger");

  const body = await c.req.parseBody();
  const pathRaw = String(body.path || "[]");
  const iterationStr = String(body.iteration || "0");

  let path: string[];
  try {
    path = JSON.parse(pathRaw);
    if (!Array.isArray(path)) path = [];
  } catch {
    path = [];
  }
  const iteration = parseInt(iterationStr);

  const explorer = getExplorer(c);
  try {
    const result = await explorer.refresh(path, iteration);
    return c.html(refreshOptionsFragment(result.options, path, iteration, result.isLastQuestion));
  } catch (err) {
    log.error("Browse refresh AI error:", err);
    return c.html(`<div id="browse-options" class="browse-error"><p>Couldn't refresh options. Please try again.</p></div>`);
  }
});
