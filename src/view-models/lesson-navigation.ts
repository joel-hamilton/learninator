import type { LessonSummary } from "../db/store.js";

export interface LessonNavResult {
  prevLesson: LessonSummary | undefined;
  nextLesson: LessonSummary | undefined;
}

/**
 * Compute prev/next lesson navigation references from a flat list of all
 * lesson summaries, given the current lesson's number and sub-number.
 *
 * Pure function — no Hono context, no database access.
 */
export function computeLessonNavigation(
  allLessons: LessonSummary[],
  number: number,
  subNumber: number | null,
): LessonNavResult {
  const currentIndex = allLessons.findIndex(
    (l) => l.number === number && l.subNumber === subNumber,
  );

  if (currentIndex === -1) {
    return { prevLesson: undefined, nextLesson: undefined };
  }

  return {
    prevLesson: currentIndex > 0 ? allLessons[currentIndex - 1] : undefined,
    nextLesson: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : undefined,
  };
}
