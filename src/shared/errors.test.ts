import { describe, it, expect } from "vitest";
import { formatAIError } from "./errors.js";
import { AIError } from "../ai/errors.js";

describe("formatAIError", () => {
  it("returns the AIError message for AIError instances", () => {
    const err = new AIError("Service unavailable");
    expect(formatAIError(err)).toBe("Service unavailable");
  });

  it("appends a recoverable hint when AIError is recoverable", () => {
    const err = new AIError("Rate limited", 429, true);
    expect(formatAIError(err)).toBe(
      "Rate limited It may help to wait a moment and retry."
    );
  });

  it("does not append hint when AIError is not recoverable", () => {
    const err = new AIError("Auth failed", 401, false);
    expect(formatAIError(err)).toBe("Auth failed");
  });

  it("returns fallback for non-AIError errors", () => {
    expect(formatAIError(new Error("boom"))).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("uses custom fallback when provided", () => {
    expect(formatAIError(new Error("boom"), "Custom fallback")).toBe(
      "Custom fallback"
    );
  });

  it("handles null input", () => {
    expect(formatAIError(null)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("handles string input", () => {
    expect(formatAIError("some string error")).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("handles undefined input", () => {
    expect(formatAIError(undefined)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("never throws", () => {
    // These should not throw
    formatAIError(null);
    formatAIError(undefined);
    formatAIError(42);
    formatAIError(true);
    formatAIError({});
    formatAIError(Symbol());
  });
});
