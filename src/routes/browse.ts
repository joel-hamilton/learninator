import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import type { AppVariables } from "../types.js";
import type { MissionStore } from "../db/store.js";
import { layout } from "../views/home.js";
import { browsePage, browseOptionsFragment, refreshOptionsFragment, optionsOnly, errorState, BROWSE_STYLES } from "../views/browse.js";
import { AIError } from "../ai/index.js";
import { saveMessage } from "../shared/messages.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const browseRoutes = new Hono<{ Variables: AppVariables }>();

const BROWSE_SYSTEM_PROMPT = `You are a topic exploration assistant for a learning platform. Help users discover what they want to learn by presenting progressively narrower topic options.

Return ONLY valid JSON (no markdown fences, no extra text):
{"options": ["string", ...], "is_specific_enough": false, "suggested_title": ""}

Rules:
- First call (no path): 6-8 broad categories across diverse domains
- Second call: 4-6 narrower sub-topics within the chosen area
- By the third call (iteration 2+), topics MUST be specific enough for a focused learning mission (e.g., "Yoga for back pain relief" not "Yoga and Flexibility"). Set is_specific_enough: true.
- Do NOT go deeper than 3 iterations total. The user should be creating a mission by then.
- suggested_title: compelling mission title (max 10 words) when is_specific_enough, empty string otherwise
- Make options varied and interesting — each should feel like something concrete to learn
- Do not repeat options the user has already seen or chosen`;

interface BrowseResult {
  options: string[];
  is_specific_enough: boolean;
  suggested_title?: string;
}

const FALLBACK_OPTIONS = [
  "Science & Engineering",
  "Technology & Programming",
  "Art & Design",
  "Music & Performance",
  "Business & Entrepreneurship",
  "Health & Wellness",
  "Languages & Writing",
  "History & Philosophy",
];

const FALLBACK_NARROW_OPTIONS = [
  "Explore this further",
  "Show me related topics",
  "Take a different angle",
  "Go deeper into this area",
  "Try something similar",
];

function parseBrowseResponse(raw: string, maxOptions: number): BrowseResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];

  try {
    const parsed = JSON.parse(cleaned);
    const options = Array.isArray(parsed.options)
      ? parsed.options.filter((o: unknown) => typeof o === "string" && o.trim().length > 0).slice(0, maxOptions)
      : [];

    return {
      options,
      is_specific_enough: parsed.is_specific_enough === true,
      suggested_title: typeof parsed.suggested_title === "string" ? parsed.suggested_title.trim() : undefined,
    };
  } catch {
    return { options: [], is_specific_enough: false };
  }
}

async function createMissionAndRedirect(c: Ctx, topic: string, path: string[]): Promise<Response> {
  const log = c.get("logger");
  const store = c.get("store");
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "new-mission";
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
  const ai = c.get("ai");
  const log = c.get("logger");

  const pathRaw = c.req.query("path") || "[]";
  const iterationStr = c.req.query("iteration") || "0";
  let path: string[];
  try { path = JSON.parse(pathRaw); if (!Array.isArray(path)) path = []; } catch { path = []; }
  const iteration = parseInt(iterationStr) || 0;

  try {
    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: path.length === 0
        ? "Generate the first set of broad learning categories. Return JSON with 6-8 diverse topic areas."
        : `The user's path: ${path.join(" → ")}. Generate sub-topics at this level. Return JSON.`
      },
    ], { model: "low", maxTokens: 1024 });

    const maxOptions = path.length === 0 ? 8 : 6;
    const parsed = parseBrowseResponse(response, maxOptions);
    const fallback = path.length === 0 ? FALLBACK_OPTIONS : FALLBACK_NARROW_OPTIONS.slice(0, 6);
    const options = parsed.options.length >= 2 ? parsed.options : fallback;
    const isLastQuestion = iteration >= 2;
    return c.html(optionsOnly(options, path, iteration, isLastQuestion));
  } catch (err) {
    log.error("Browse options AI error:", err);
    const fallback = path.length === 0 ? FALLBACK_OPTIONS : FALLBACK_NARROW_OPTIONS.slice(0, 6);
    return c.html(optionsOnly(fallback, path, iteration, false));
  }
});

// ── POST /browse/select ──
browseRoutes.post("/browse/select", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const ai = c.get("ai");
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
  path.push(selection);
  const iteration = parseInt(iterationStr) + 1;

  // Safety valve: force mission creation after 3 iterations — skip for custom inputs
  if (!isCustom && iteration >= 3) {
    return createMissionAndRedirect(c, selection, path);
  }

  const pathDescription = path.map((p, i) => `Level ${i + 1}: ${p}`).join("\n");

  try {
    const userMessage = isCustom
      ? `The user typed their own topic: "${selection}". Browse path so far:\n${pathDescription}\n\nGenerate 4-6 relevant sub-topics or alternative angles to explore within this topic. Always return options — do NOT set is_specific_enough for custom inputs, the user wants to keep browsing. Return JSON.`
      : iteration === 1
        ? `The user chose "${selection}" from the broad categories. Generate 4-6 narrower sub-topics within this area. Return JSON.`
        : `The user's exploration path so far:\n${pathDescription}\n\nThis is iteration ${iteration} (the user has clicked ${iteration} times). You SHOULD return is_specific_enough: true now with a good suggested_title. If you return options, they should be very specific learning missions (not broad categories). Return JSON.`;

    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: userMessage },
    ], { model: "low", maxTokens: 1024 });

    const parsed = parseBrowseResponse(response, 6);

    // For custom inputs, always show browse options — never create mission immediately
    if (!isCustom) {
      // If AI says we're specific enough with no options, create mission immediately
      if (parsed.is_specific_enough && parsed.options.length === 0) {
        const topic = parsed.suggested_title || selection;
        return createMissionAndRedirect(c, topic, path);
      }

      // If AI returns both specific flag AND options at iteration 2+, create mission
      if (parsed.is_specific_enough && iteration >= 2) {
        const topic = parsed.suggested_title || selection;
        return createMissionAndRedirect(c, topic, path);
      }
    }

    const isLastQuestion = iteration >= 2;
    const options = parsed.options.length >= 2 ? parsed.options : FALLBACK_NARROW_OPTIONS.slice(0, 6);
    return c.html(BROWSE_STYLES + browseOptionsFragment(options, path, iteration, isLastQuestion));
  } catch (err) {
    log.error("Browse select AI error:", err);
    const msg = err instanceof AIError ? err.message : "Something went wrong. Please try again.";
    return c.html(BROWSE_STYLES + errorState(msg));
  }
});

// ── POST /browse/refresh ──
browseRoutes.post("/browse/refresh", auth.requireAuth, async (c: Ctx) => {
  const ai = c.get("ai");
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
  const isLastQuestion = iteration >= 2;

  try {
    if (path.length === 0) {
      // Root level: re-generate broad categories
      const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
        { role: "user", content: "Generate a fresh set of broad learning categories (different from before). Return JSON with 6-8 diverse topic areas." },
      ], { model: "low", maxTokens: 1024 });

      const parsed = parseBrowseResponse(response, 8);
      const options = parsed.options.length >= 3 ? parsed.options : FALLBACK_OPTIONS;
      return c.html(refreshOptionsFragment(options, path, iteration, isLastQuestion));
    }

    // Nested: re-generate at the same level
    const parentPath = path.slice(0, -1);
    const currentTopic = path[path.length - 1];
    const pathDescription = path.map((p, i) => `Level ${i + 1}: ${p}`).join("\n");

    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: `The user is exploring "${currentTopic}" (path: ${pathDescription}). Generate DIFFERENT alternative sub-topics at the same level. Do NOT go deeper. Return JSON with ${iteration === 0 ? "6-8 broad categories" : "4-6 options"}.` },
    ], { model: "low", maxTokens: 1024 });

    const parsed = parseBrowseResponse(response, iteration === 0 ? 8 : 6);
    const options = parsed.options.length >= 2 ? parsed.options : FALLBACK_NARROW_OPTIONS.slice(0, 6);
    return c.html(refreshOptionsFragment(options, path, iteration, isLastQuestion));
  } catch (err) {
    log.error("Browse refresh AI error:", err);
    return c.html(`<div id="browse-options" class="browse-error"><p>Couldn't refresh options. Please try again.</p></div>`);
  }
});
