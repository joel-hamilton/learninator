import type { LessonSummary } from "../db/store.js";

export interface EnrichedLessonSummary extends LessonSummary {
  hasSubLessons: boolean;
  isLastSub: boolean;
}

/**
 * Enrich a list of lesson summaries with computed flags used for rendering
 * lesson cards with sub-lesson grouping indicators.
 *
 * Pure function — no Hono context, no database access.
 */
export function lessonGrouping(rows: LessonSummary[]): EnrichedLessonSummary[] {
  const parentNums = new Set<number>();
  const lastSubs = new Set<string>();
  const maxSubByNum = new Map<number, number>();

  for (const l of rows) {
    if (l.subNumber !== null) {
      parentNums.add(l.number);
      const curr = maxSubByNum.get(l.number) ?? 0;
      if (l.subNumber > curr) maxSubByNum.set(l.number, l.subNumber);
    }
  }

  for (const l of rows) {
    if (l.subNumber !== null && l.subNumber === maxSubByNum.get(l.number)) {
      lastSubs.add(`${l.number}:${l.subNumber}`);
    }
  }

  return rows.map((l) => ({
    ...l,
    hasSubLessons: l.subNumber === null && parentNums.has(l.number),
    isLastSub: l.subNumber !== null && lastSubs.has(`${l.number}:${l.subNumber}`),
  }));
}
