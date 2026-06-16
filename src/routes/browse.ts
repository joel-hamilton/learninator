import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "../auth/index.js";
import { db, schema } from "../db/index.js";
import type { AppVariables } from "../types.js";
import { browseOptionsHtml, browseCustomInputHtml } from "../views/browse.js";

type Ctx = Context<{ Variables: AppVariables }>;
export const browseRoutes = new Hono<{ Variables: AppVariables }>();

const BROWSE_SYSTEM_PROMPT = `You are a topic exploration assistant for a learning platform. Help users discover what they want to learn by presenting progressively narrower topic options.

Return ONLY valid JSON (no markdown fences, no extra text):
{"options": ["string", ...], "is_specific_enough": false, "suggested_title": ""}

Rules:
- First call (no path): 6-8 broad, diverse categories (e.g., "Music & Performance", "Technology & Programming", "Art & Design")
- Second call: 4-6 narrower sub-topics within the chosen area
- By the third call (iteration 2+), topics MUST be specific enough for a focused learning mission (e.g., "Fretboard mastery for blues guitar" not just "Guitar")
- Max 3 iterations total. On iteration 2, always set is_specific_enough to true.
- suggested_title: compelling mission title (max 10 words). Required when is_specific_enough is true.
- Make options varied, interesting, and specific. Avoid generic options like "Other" or "Miscellaneous".
- Do not repeat options the user has already chosen or seen.`;

const FALLBACK_OPTIONS: Record<string, string[]> = {
  root: [
    "Music & Performance",
    "Technology & Programming",
    "Art & Design",
    "Science & Engineering",
    "Business & Entrepreneurship",
    "Health & Wellness",
    "Languages & Writing",
    "History & Philosophy",
  ],
  narrow: [
    "Dive deeper into this",
    "Explore fundamentals",
    "Advanced techniques",
    "Practical applications",
    "Creative approaches",
    "Historical context",
  ],
};

function parseBrowseResponse(text: string): {
  options: string[];
  is_specific_enough: boolean;
  suggested_title: string;
} {
  try {
    // Strip any markdown fences
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      options: Array.isArray(parsed.options) ? parsed.options : [],
      is_specific_enough: Boolean(parsed.is_specific_enough),
      suggested_title: String(parsed.suggested_title || ""),
    };
  } catch {
    return { options: [], is_specific_enough: false, suggested_title: "" };
  }
}

// GET /browse/options — return topic cards as HTML fragment
browseRoutes.get("/options", auth.requireAuth, async (c: Ctx) => {
  const ai = c.get("ai");
  const pathRaw = c.req.query("path") || "";
  const iterationRaw = c.req.query("iteration") || "0";
  const path = pathRaw ? pathRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const iteration = Math.min(parseInt(iterationRaw) || 0, 2);

  const userPrompt = path.length === 0
    ? "Generate broad topic categories for someone exploring what to learn."
    : `The user is exploring: ${path.join(" > ")}. Generate narrower, more specific sub-topics within "${path[path.length - 1]}".`;

  try {
    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: userPrompt },
    ], { model: "low", maxTokens: 512 });

    const parsed = parseBrowseResponse(response);
    if (parsed.options.length > 0) {
      return c.html(browseOptionsHtml(parsed.options, path, iteration));
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback
  const fallbackOpts = path.length === 0 ? FALLBACK_OPTIONS.root : FALLBACK_OPTIONS.narrow;
  return c.html(browseOptionsHtml(fallbackOpts, path, iteration));
});

// GET /browse/select — handle card click
browseRoutes.get("/select", auth.requireAuth, async (c: Ctx) => {
  const user = c.get("user")!;
  const ai = c.get("ai");
  const selection = c.req.query("selection") || "";
  const pathRaw = c.req.query("path") || "";
  const iterationRaw = c.req.query("iteration") || "0";
  const path = pathRaw ? pathRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const iteration = Math.min(parseInt(iterationRaw) || 0, 2);

  const customTopic = c.req.query("custom-topic") || "";
  const effectiveSelection = customTopic.trim() || selection.trim();

  if (!effectiveSelection) return c.html(browseOptionsHtml(FALLBACK_OPTIONS.root, [], 0));

  // Custom input — show text area
  if (effectiveSelection === "__custom__") {
    return c.html(browseCustomInputHtml(path, iteration));
  }

  const newPath = [...path, effectiveSelection];
  const newIteration = iteration + 1;

  // If we're at iteration 2+, auto-create the mission
  if (iteration >= 2) {
    const slug = effectiveSelection.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const title = effectiveSelection.length > 80 ? effectiveSelection.slice(0, 80) + "…" : effectiveSelection;
    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: user.id, title, slug, status: "onboarding" })
      .returning();

    c.header("HX-Redirect", `/missions/${mission.id}`);
    return c.body(null);
  }

  // Otherwise, check with AI if this is specific enough to create a mission
  if (newIteration >= 2) {
    // At iteration 2, force creation (safety valve)
    const slug = effectiveSelection.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const title = effectiveSelection.length > 80 ? effectiveSelection.slice(0, 80) + "…" : effectiveSelection;
    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: user.id, title, slug, status: "onboarding" })
      .returning();

    c.header("HX-Redirect", `/missions/${mission.id}`);
    return c.body(null);
  }

  // Ask AI to narrow down further (iteration 1)
  const userPrompt = `The user chose "${effectiveSelection}" from the options within "${path.join(" > ")}". Generate narrower, more specific sub-topics. The user has ${2 - newIteration} more refinement step(s) left.`;

  try {
    const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
      { role: "user", content: userPrompt },
    ], { model: "low", maxTokens: 512 });

    const parsed = parseBrowseResponse(response);
    if (parsed.is_specific_enough && parsed.suggested_title) {
      const slug = parsed.suggested_title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const [mission] = await db
        .insert(schema.missions)
        .values({ userId: user.id, title: parsed.suggested_title, slug, status: "onboarding" })
        .returning();

      c.header("HX-Redirect", `/missions/${mission.id}`);
      return c.body(null);
    }

    if (parsed.options.length > 0) {
      return c.html(browseOptionsHtml(parsed.options, newPath, newIteration));
    }
  } catch {
    // Fall through to fallback
  }

  return c.html(browseOptionsHtml(FALLBACK_OPTIONS.narrow, newPath, newIteration));
});
