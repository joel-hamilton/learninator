/**
 * Shared lesson number formatting utilities.
 *
 * Hoisted from src/views/lesson.ts, src/views/fragments.ts, and
 * src/lessons/generator.ts to eliminate three identical implementations.
 */

export function formatLessonNumber(num: number, sub: number | null): string {
  const base = String(num).padStart(4, "0");
  return sub !== null ? `${base}.${sub}` : base;
}

export function lessonIdStr(number: number, subNumber: number | null): string {
  return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
}
