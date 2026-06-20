import type { LessonFeedbackSummary } from "../db/store.js";
import { formatLessonNumber } from "./lesson-numbers.js";

export interface FeedbackStore {
  listLessonFeedback(missionId: number): Promise<LessonFeedbackSummary[]>;
}

/**
 * Build a structured feedback summary string for injection into AI generation prompts.
 * Returns a markdown table of recent feedback + trend analysis.
 * Returns a default-difficulty note when no feedback exists yet.
 */
export async function buildFeedbackSummary(
  store: FeedbackStore,
  missionId: number,
): Promise<string> {
  const feedback = await store.listLessonFeedback(missionId);
  const rated = feedback.filter((f) => f.feedbackRating);

  if (rated.length === 0) {
    return "\n## Student Feedback History\n\nNo feedback yet. Use default difficulty — clear explanations, moderate pacing.\n";
  }

  const recent = rated.slice(-5);
  const rows = recent.map((f) => {
    const num = formatLessonNumber(f.number, f.subNumber);
    const title = f.title || "(untitled)";
    const label =
      f.feedbackRating === "too_easy"
        ? "too easy"
        : f.feedbackRating === "too_hard"
          ? "too hard"
          : "just right";
    const notes = f.feedbackText ? `"${f.feedbackText}"` : "—";
    return `| ${num}: "${title}" | ${label} | ${notes} |`;
  });

  const table = [
    "| Lesson | Rating | Notes |",
    "|--------|--------|-------|",
    ...rows,
  ].join("\n");

  const trend = buildTrend(rated);

  return `\n## Student Feedback History\n\n${table}\n\n${trend}\n`;
}

function buildTrend(feedback: LessonFeedbackSummary[]): string {
  const recent = feedback.slice(-5);
  const tooHard = recent.filter((f) => f.feedbackRating === "too_hard").length;
  const tooEasy = recent.filter((f) => f.feedbackRating === "too_easy").length;
  const total = recent.length;

  if (tooHard >= total * 0.6) {
    return "**Trend**: Most recent lessons rated too hard. Use simpler language, more concrete examples, smaller conceptual steps, and more scaffolding. Start each lesson with a quick recap of prerequisites.";
  }
  if (tooEasy >= total * 0.6) {
    return "**Trend**: Most recent lessons rated too easy. Increase depth, add advanced material, move faster through fundamentals, and introduce nuance and edge cases.";
  }
  if (tooHard > tooEasy) {
    return `**Trend**: ${tooHard} of ${total} recent lessons rated too hard. Favor simpler explanations and more scaffolding.`;
  }
  if (tooEasy > tooHard) {
    return `**Trend**: ${tooEasy} of ${total} recent lessons rated too easy. Lean toward more challenging material.`;
  }
  return "**Trend**: Mixed ratings. Maintain current difficulty level and adjust based on per-lesson feedback above.";
}
