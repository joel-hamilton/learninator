import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import type { AppVariables } from "../types.js";
import { layout } from "../views/home.js";
import { browsePage, browseOptionsFragment, errorState, BROWSE_STYLES } from "../views/browse.js";
import { AIError } from "../ai/index.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const browseRoutes = new Hono<{ Variables: AppVariables }>();

const BROWSE_SYSTEM_PROMPT = `You are a topic exploration assistant for a learning platform. Help users discover what they want to learn by presenting progressively narrower topic options.

Return ONLY valid JSON (no markdown fences, no extra text):
{"options": ["string", ...], "is_specific_enough": false, "suggested_title": ""}

Rules:
- First call (no path): 6-8 broad categories across diverse domains
- Subsequent calls: 4-6 narrower sub-topics within the chosen area
- By iteration 4-5, topics should be quite specific (e.g., "Pentatonic guitar soloing" not "Music")
- Set is_specific_enough: true when the topic is specific enough for a focused learning mission
- suggested_title: compelling mission title (max 10 words) when is_specific_enough, empty string otherwise
- Make options varied and interesting — each should feel like something real to learn
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

// ── GET /browse ──
browseRoutes.get("/browse", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const ai = c.get("ai");
  const log = c.get("logger");

  try {
    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: "Generate the first set of broad learning categories. Return JSON with 6-8 diverse topic areas." },
    ], { model: "low", maxTokens: 1024 });

    const parsed = parseBrowseResponse(response, 8);
    const options = parsed.options.length >= 3 ? parsed.options : FALLBACK_OPTIONS;
    return c.html(layout(user, BROWSE_STYLES + browsePage(options, [])));
  } catch (err) {
    log.error("Browse initial AI error:", err);
    return c.html(layout(user, BROWSE_STYLES + browsePage(FALLBACK_OPTIONS, [])));
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

  if (!selection) return c.text("Missing selection", 400);

  let path: string[];
  try {
    path = JSON.parse(pathRaw);
    if (!Array.isArray(path)) path = [];
  } catch {
    path = [];
  }
  path.push(selection);
  const iteration = parseInt(iterationStr) + 1;

  // Safety valve: force mission creation after 7 iterations
  if (iteration >= 7) {
    const topic = path[path.length - 1];
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "new-mission";
    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: user.id, title: topic, slug, status: "onboarding" })
      .returning();
    c.header("HX-Redirect", `/missions/${mission.id}`);
    return c.body(null);
  }

  const pathDescription = path.map((p, i) => `Level ${i + 1}: ${p}`).join("\n");

  try {
    const userMessage = iteration === 1
      ? `The user chose "${selection}" from the broad categories. Generate 4-6 narrower sub-topics within this area. Return JSON.`
      : `The user's exploration path so far:\n${pathDescription}\n\nIteration ${iteration} of up to 6. Generate the next set of narrower sub-topics within "${selection}". If this is now specific enough for a single focused learning mission, set is_specific_enough to true and provide a good suggested_title. Return JSON.`;

    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: userMessage },
    ], { model: "low", maxTokens: 1024 });

    const parsed = parseBrowseResponse(response, 6);

    if (parsed.is_specific_enough && parsed.options.length === 0) {
      // AI says we're specific enough — create the mission
      const topic = parsed.suggested_title || selection;
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "new-mission";
      const [mission] = await db
        .insert(schema.missions)
        .values({ userId: user.id, title: topic, slug, status: "onboarding" })
        .returning();
      c.header("HX-Redirect", `/missions/${mission.id}`);
      return c.body(null);
    }

    // If AI returned both specific flag AND options, show the options but also consider creating mission
    // if we're deep enough
    if (parsed.is_specific_enough && iteration >= 4) {
      const topic = parsed.suggested_title || selection;
      const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "new-mission";
      const [mission] = await db
        .insert(schema.missions)
        .values({ userId: user.id, title: topic, slug, status: "onboarding" })
        .returning();
      c.header("HX-Redirect", `/missions/${mission.id}`);
      return c.body(null);
    }

    const options = parsed.options.length >= 2 ? parsed.options : FALLBACK_NARROW_OPTIONS.slice(0, 6);
    return c.html(BROWSE_STYLES + browseOptionsFragment(options, path, iteration));
  } catch (err) {
    log.error("Browse select AI error:", err);
    const msg = err instanceof AIError ? err.message : "Something went wrong. Please try again.";
    return c.html(BROWSE_STYLES + errorState(msg));
  }
});
