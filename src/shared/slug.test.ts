import { describe, it, expect } from "vitest";
import { generateSlug } from "./slug.js";

describe("generateSlug", () => {
  it("lowercases and replaces non-alphanumeric characters with dashes", () => {
    expect(generateSlug("Learn TypeScript Basics")).toBe(
      "learn-typescript-basics"
    );
  });

  it("strips leading and trailing dashes", () => {
    expect(generateSlug("---hello---")).toBe("hello");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(100) + " b".repeat(100);
    expect(generateSlug(long).length).toBeLessThanOrEqual(60);
    expect(generateSlug(long)).not.toMatch(/-$/);
  });

  it("returns 'new-mission' for empty string", () => {
    expect(generateSlug("")).toBe("new-mission");
  });

  it("returns 'new-mission' for whitespace-only string", () => {
    expect(generateSlug("   ")).toBe("new-mission");
  });

  it("returns 'new-mission' for string with only special characters", () => {
    expect(generateSlug("!@#$%^&*()")).toBe("new-mission");
  });

  it("handles mixed case and numbers", () => {
    expect(generateSlug("Node.js 2024 Edition")).toBe(
      "node-js-2024-edition"
    );
  });

  it("preserves numbers in the slug", () => {
    expect(generateSlug("Learn Python 3.12")).toBe("learn-python-3-12");
  });
});
