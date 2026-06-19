import { describe, it, expect } from "vitest";
import { computeLessonNavigation } from "../../view-models/lesson-navigation.js";
import type { LessonSummary } from "../../db/store.js";

function s(
  number: number,
  subNumber: number | null,
  title?: string,
): LessonSummary {
  return { number, subNumber, title: title ?? `L${number}`, status: "active" };
}

describe("computeLessonNavigation", () => {
  it("single lesson list — no prev, no next", () => {
    const lessons = [s(1, null)];
    const result = computeLessonNavigation(lessons, 1, null);
    expect(result.prevLesson).toBeUndefined();
    expect(result.nextLesson).toBeUndefined();
  });

  it("first lesson in multi-item list — no prev, has next", () => {
    const lessons = [s(1, null), s(2, null), s(3, null)];
    const result = computeLessonNavigation(lessons, 1, null);
    expect(result.prevLesson).toBeUndefined();
    expect(result.nextLesson).toEqual(s(2, null));
  });

  it("last lesson in multi-item list — has prev, no next", () => {
    const lessons = [s(1, null), s(2, null), s(3, null)];
    const result = computeLessonNavigation(lessons, 3, null);
    expect(result.prevLesson).toEqual(s(2, null));
    expect(result.nextLesson).toBeUndefined();
  });

  it("middle lesson — both prev and next", () => {
    const lessons = [s(1, null), s(2, null), s(3, null)];
    const result = computeLessonNavigation(lessons, 2, null);
    expect(result.prevLesson).toEqual(s(1, null));
    expect(result.nextLesson).toEqual(s(3, null));
  });

  it("two lessons — first has next only, second has prev only", () => {
    const lessons = [s(1, null), s(2, null)];

    const first = computeLessonNavigation(lessons, 1, null);
    expect(first.prevLesson).toBeUndefined();
    expect(first.nextLesson).toEqual(s(2, null));

    const second = computeLessonNavigation(lessons, 2, null);
    expect(second.prevLesson).toEqual(s(1, null));
    expect(second.nextLesson).toBeUndefined();
  });

  it("handles sub-lessons correctly", () => {
    const lessons = [
      s(1, null, "Main"),
      s(1, 1, "Sub A"),
      s(1, 2, "Sub B"),
      s(2, null, "Lesson 2"),
    ];

    const subA = computeLessonNavigation(lessons, 1, 1);
    expect(subA.prevLesson).toEqual(s(1, null, "Main"));
    expect(subA.nextLesson).toEqual(s(1, 2, "Sub B"));

    const subB = computeLessonNavigation(lessons, 1, 2);
    expect(subB.prevLesson).toEqual(s(1, 1, "Sub A"));
    expect(subB.nextLesson).toEqual(s(2, null, "Lesson 2"));
  });

  it("returns undefined for both when current lesson is not in the list", () => {
    const lessons = [s(1, null), s(2, null)];
    const result = computeLessonNavigation(lessons, 99, null);
    expect(result.prevLesson).toBeUndefined();
    expect(result.nextLesson).toBeUndefined();
  });
});
