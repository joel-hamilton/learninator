import { describe, it, expect } from "vitest";
import { lessonGrouping } from "../../view-models/lesson-grouping.js";
import type { LessonSummary } from "../../db/store.js";

function summary(
  number: number,
  subNumber: number | null,
  title: string,
  status: string = "active",
): LessonSummary {
  return { number, subNumber, title, status };
}

describe("lessonGrouping", () => {
  it("returns empty array for empty input", () => {
    expect(lessonGrouping([])).toEqual([]);
  });

  it("single lesson without sub-lessons is not a parent", () => {
    const rows = [summary(1, null, "Lesson 1")];
    const result = lessonGrouping(rows);
    expect(result).toHaveLength(1);
    expect(result[0].hasSubLessons).toBe(false);
    expect(result[0].isLastSub).toBe(false);
  });

  it("parent with one sub-lesson", () => {
    const rows: LessonSummary[] = [
      summary(1, null, "Main Lesson"),
      summary(1, 1, "Sub 1"),
    ];
    const result = lessonGrouping(rows);
    expect(result).toHaveLength(2);
    // Main lesson has sub-lessons
    expect(result[0].hasSubLessons).toBe(true);
    expect(result[0].isLastSub).toBe(false);
    // Sub 1 is the last (and only) sub
    expect(result[1].hasSubLessons).toBe(false);
    expect(result[1].isLastSub).toBe(true);
  });

  it("parent with multiple sub-lessons — isLastSub on the last one only", () => {
    const rows: LessonSummary[] = [
      summary(1, null, "Main Lesson"),
      summary(1, 1, "Sub 1"),
      summary(1, 2, "Sub 2"),
    ];
    const result = lessonGrouping(rows);
    expect(result).toHaveLength(3);
    expect(result[0].hasSubLessons).toBe(true);
    expect(result[0].isLastSub).toBe(false);
    expect(result[1].hasSubLessons).toBe(false);
    expect(result[1].isLastSub).toBe(false);
    expect(result[2].hasSubLessons).toBe(false);
    expect(result[2].isLastSub).toBe(true);
  });

  it("lesson without sub-lessons that is not a parent", () => {
    const rows: LessonSummary[] = [
      summary(1, null, "Alone"),
    ];
    const result = lessonGrouping(rows);
    expect(result[0].hasSubLessons).toBe(false);
    expect(result[0].isLastSub).toBe(false);
  });

  it("mixed data with multiple parents and various sub-lessons", () => {
    const rows: LessonSummary[] = [
      summary(1, null, "Lesson 1"),
      summary(1, 1, "Lesson 1.1"),
      summary(1, 2, "Lesson 1.2"),
      summary(2, null, "Lesson 2"),
      summary(3, null, "Lesson 3"),
      summary(3, 1, "Lesson 3.1"),
    ];
    const result = lessonGrouping(rows);
    expect(result).toHaveLength(6);

    // Lesson 1 — parent with 2 subs, hasSubLessons=true
    expect(result[0].number).toBe(1);
    expect(result[0].subNumber).toBeNull();
    expect(result[0].hasSubLessons).toBe(true);
    expect(result[0].isLastSub).toBe(false);

    // Lesson 1.1 — sub, not last
    expect(result[1].number).toBe(1);
    expect(result[1].subNumber).toBe(1);
    expect(result[1].hasSubLessons).toBe(false);
    expect(result[1].isLastSub).toBe(false);

    // Lesson 1.2 — sub, is last
    expect(result[2].number).toBe(1);
    expect(result[2].subNumber).toBe(2);
    expect(result[2].hasSubLessons).toBe(false);
    expect(result[2].isLastSub).toBe(true);

    // Lesson 2 — standalone, not a parent
    expect(result[3].number).toBe(2);
    expect(result[3].subNumber).toBeNull();
    expect(result[3].hasSubLessons).toBe(false);
    expect(result[3].isLastSub).toBe(false);

    // Lesson 3 — parent with 1 sub
    expect(result[4].number).toBe(3);
    expect(result[4].subNumber).toBeNull();
    expect(result[4].hasSubLessons).toBe(true);
    expect(result[4].isLastSub).toBe(false);

    // Lesson 3.1 — sub, last
    expect(result[5].number).toBe(3);
    expect(result[5].subNumber).toBe(1);
    expect(result[5].hasSubLessons).toBe(false);
    expect(result[5].isLastSub).toBe(true);
  });
});
