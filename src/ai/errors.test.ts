import { describe, it, expect } from "vitest";
import { AIError } from "./errors.js";

describe("AIError.prototype.toUserMessage", () => {
  it("returns the message for non-recoverable AIError (recoverable=false)", () => {
    const err = new AIError("Service unavailable", 500, false);
    expect(err.toUserMessage()).toBe("Service unavailable");
  });

  it("returns the message for non-recoverable AIError (recoverable=undefined)", () => {
    const err = new AIError("Service unavailable");
    expect(err.toUserMessage()).toBe("Service unavailable");
  });

  it("appends a recoverable hint when AIError is recoverable", () => {
    const err = new AIError("Rate limited", 429, true);
    expect(err.toUserMessage()).toBe(
      "Rate limited It may help to wait a moment and retry."
    );
  });

  it("does not append hint when recoverable is false", () => {
    const err = new AIError("Auth failed", 401, false);
    expect(err.toUserMessage()).toBe("Auth failed");
  });

  it("accepts fallback parameter but does not use it (caller handles fallback)", () => {
    const err = new AIError("Service unavailable");
    expect(err.toUserMessage("Custom fallback")).toBe("Service unavailable");
  });

  it("never throws on any AIError instance state", () => {
    // These should not throw
    expect(() => new AIError("msg").toUserMessage()).not.toThrow();
    expect(() => new AIError("msg", undefined).toUserMessage()).not.toThrow();
    expect(() => new AIError("msg", 500).toUserMessage()).not.toThrow();
    expect(() => new AIError("msg", 500, true).toUserMessage()).not.toThrow();
    expect(() => new AIError("msg", 500, false).toUserMessage()).not.toThrow();
    expect(() => new AIError("").toUserMessage()).not.toThrow();
  });
});
