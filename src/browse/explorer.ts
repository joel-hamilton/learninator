import type { AiClient } from "../ai/index.js";
import type { Logger } from "../logger.js";

// ── Public types ──

export interface TopicExplorerDeps {
  ai: AiClient;
  logger: Logger;
}

export interface TopicOptions {
  options: string[];
  isLastQuestion: boolean; // iteration >= 2
}

export type TopicResult =
  | { type: "options"; options: string[]; path: string[]; iteration: number; isLastQuestion: boolean }
  | { type: "create_mission"; topic: string; path: string[] };

// ── Internal types & constants ──

interface BrowseResult {
  options: string[];
  is_specific_enough: boolean;
  suggested_title?: string;
}

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

// ── JSON parsing ──

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

// ── TopicExplorer ──

export class TopicExplorer {
  constructor(private deps: TopicExplorerDeps) {}

  /**
   * Get topic options at the current level.
   * - path.length === 0: returns broad categories (8 max)
   * - path.length > 0: returns sub-topics within the chosen path (6 max)
   * Error recovery: returns fallback options if the AI call fails.
   */
  async explore(path: string[], iteration: number): Promise<TopicOptions> {
    const { ai, logger } = this.deps;

    try {
      const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
        {
          role: "user",
          content:
            path.length === 0
              ? "Generate the first set of broad learning categories. Return JSON with 6-8 diverse topic areas."
              : `The user's path: ${path.join(" → ")}. Generate sub-topics at this level. Return JSON.`,
        },
      ], { model: "low", maxTokens: 1024 });

      const maxOptions = path.length === 0 ? 8 : 6;
      const parsed = parseBrowseResponse(response, maxOptions);
      const fallback = path.length === 0 ? FALLBACK_OPTIONS : FALLBACK_NARROW_OPTIONS.slice(0, 6);
      const options = parsed.options.length >= 2 ? parsed.options : fallback;
      return { options, isLastQuestion: iteration >= 2 };
    } catch (err) {
      logger.error("Browse options AI error:", err);
      const fallback = path.length === 0 ? FALLBACK_OPTIONS : FALLBACK_NARROW_OPTIONS.slice(0, 6);
      return { options: fallback, isLastQuestion: false };
    }
  }

  /**
   * User selected a topic — advance the path, increment iteration, and decide next step.
   *
   * Returns `{ type: "options" }` with sub-topics OR
   * returns `{ type: "create_mission" }` when the topic is specific enough
   * or the iteration cap (3 clicks) is hit.
   *
   * Custom inputs (isCustom=true) always return options and never force mission creation.
   * Errors propagate to the caller.
   */
  async select(
    path: string[],
    selection: string,
    iteration: number,
    isCustom?: boolean,
  ): Promise<TopicResult> {
    const { ai, logger } = this.deps;
    const newPath = [...path, selection];
    const newIteration = iteration + 1;
    const isCustomBool = isCustom === true;

    // Safety valve: force mission creation after 3 clicks — skip for custom inputs
    if (!isCustomBool && newIteration >= 3) {
      return { type: "create_mission", topic: selection, path: newPath };
    }

    const pathDescription = newPath.map((p, i) => `Level ${i + 1}: ${p}`).join("\n");

    try {
      const userMessage = isCustomBool
        ? `The user typed their own topic: "${selection}". Browse path so far:\n${pathDescription}\n\nGenerate 4-6 relevant sub-topics or alternative angles to explore within this topic. Always return options — do NOT set is_specific_enough for custom inputs, the user wants to keep browsing. Return JSON.`
        : newIteration === 1
          ? `The user chose "${selection}" from the broad categories. Generate 4-6 narrower sub-topics within this area. Return JSON.`
          : `The user's exploration path so far:\n${pathDescription}\n\nThis is iteration ${newIteration} (the user has clicked ${newIteration} times). You SHOULD return is_specific_enough: true now with a good suggested_title. If you return options, they should be very specific learning missions (not broad categories). Return JSON.`;

      const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
        { role: "user", content: userMessage },
      ], { model: "low", maxTokens: 1024 });

      const parsed = parseBrowseResponse(response, 6);

      // For custom inputs, always show browse options — never create mission immediately
      if (!isCustomBool) {
        // If AI says we're specific enough with no options, create mission immediately
        if (parsed.is_specific_enough && parsed.options.length === 0) {
          const topic = parsed.suggested_title || selection;
          return { type: "create_mission", topic, path: newPath };
        }

        // If AI returns both specific flag AND options at iteration 2+, create mission
        if (parsed.is_specific_enough && newIteration >= 2) {
          const topic = parsed.suggested_title || selection;
          return { type: "create_mission", topic, path: newPath };
        }
      }

      const isLastQuestion = newIteration >= 2;
      const options = parsed.options.length >= 2 ? parsed.options : FALLBACK_NARROW_OPTIONS.slice(0, 6);
      return { type: "options", options, path: newPath, iteration: newIteration, isLastQuestion };
    } catch (err) {
      logger.error("Browse select AI error:", err);
      throw err;
    }
  }

  /**
   * Refresh options at the current level — asks the AI for different options
   * without changing the path or iteration.
   */
  async refresh(path: string[], iteration: number): Promise<TopicOptions> {
    const { ai, logger } = this.deps;
    const isLastQuestion = iteration >= 2;

    try {
      if (path.length === 0) {
        // Root level: re-generate broad categories
        const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
          {
            role: "user",
            content:
              "Generate a fresh set of broad learning categories (different from before). Return JSON with 6-8 diverse topic areas.",
          },
        ], { model: "low", maxTokens: 1024 });

        const parsed = parseBrowseResponse(response, 8);
        const options = parsed.options.length >= 3 ? parsed.options : FALLBACK_OPTIONS;
        return { options, isLastQuestion };
      }

      // Nested: re-generate at the same level
      const currentTopic = path[path.length - 1];
      const pathDescription = path.map((p, i) => `Level ${i + 1}: ${p}`).join("\n");

      const response = await ai.chat(BROWSE_SYSTEM_PROMPT, [
        {
          role: "user",
          content: `The user is exploring "${currentTopic}" (path: ${pathDescription}). Generate DIFFERENT alternative sub-topics at the same level. Do NOT go deeper. Return JSON with ${iteration === 0 ? "6-8 broad categories" : "4-6 options"}.`,
        },
      ], { model: "low", maxTokens: 1024 });

      const parsed = parseBrowseResponse(response, iteration === 0 ? 8 : 6);
      const options = parsed.options.length >= 2 ? parsed.options : FALLBACK_NARROW_OPTIONS.slice(0, 6);
      return { options, isLastQuestion };
    } catch (err) {
      logger.error("Browse refresh AI error:", err);
      throw err;
    }
  }
}

export function createTopicExplorer(deps: TopicExplorerDeps): TopicExplorer {
  return new TopicExplorer(deps);
}
