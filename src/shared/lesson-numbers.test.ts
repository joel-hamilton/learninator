import { describe, it, expect } from "vitest";
import { formatLessonNumber, lessonIdStr } from "./lesson-numbers.js";

describe("formatLessonNumber", () => {
  it("single-digit number, null sub", () => {
    expect(formatLessonNumber(1, null)).toBe("0001");
  });

  it("single-digit number, with sub", () => {
    expect(formatLessonNumber(1, 3)).toBe("0001.3");
  });

  it("double-digit number, null sub", () => {
    expect(formatLessonNumber(12, null)).toBe("0012");
  });

  it("double-digit number, with sub", () => {
    expect(formatLessonNumber(12, 3)).toBe("0012.3");
  });

  it("number with sub-lesson of 0", () => {
    expect(formatLessonNumber(1, 0)).toBe("0001.0");
  });
});

describe("lessonIdStr", () => {
  it("single-digit number, null sub", () => {
    expect(lessonIdStr(1, null)).toBe("1");
  });

  it("single-digit number, with sub", () => {
    expect(lessonIdStr(1, 3)).toBe("1.3");
  });

  it("double-digit number, null sub", () => {
    expect(lessonIdStr(12, null)).toBe("12");
  });

  it("double-digit number, with sub", () => {
    expect(lessonIdStr(12, 3)).toBe("12.3");
  });

  it("number with sub-lesson of 0", () => {
    expect(lessonIdStr(1, 0)).toBe("1.0");
  });
});
