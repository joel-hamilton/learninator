import { describe, it, expect } from "vitest";
import { renderChatMessages } from "../../view-models/chat-messages.js";
import type { ChatMessageRow } from "../../db/store.js";

const DEFAULT_GREETING = "Hello! How can I help you?";

function msg(
  role: "user" | "assistant",
  content: string,
): ChatMessageRow {
  return {
    id: 0,
    missionId: 1,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

describe("renderChatMessages", () => {
  it("returns default greeting bubble for empty array", () => {
    const html = renderChatMessages([], DEFAULT_GREETING);
    expect(html).toContain("msg-row assistant");
    expect(html).toContain(DEFAULT_GREETING);
  });

  it("renders a single user message", () => {
    const rows = [msg("user", JSON.stringify([{ type: "text", text: "Hello" }]))];
    const html = renderChatMessages(rows, DEFAULT_GREETING);
    expect(html).toContain("msg-row user");
    expect(html).toContain("Hello");
  });

  it("renders a single assistant message", () => {
    const rows = [msg("assistant", JSON.stringify([{ type: "text", text: "Hi there!" }]))];
    const html = renderChatMessages(rows, DEFAULT_GREETING);
    expect(html).toContain("msg-row assistant");
    expect(html).toContain("Hi there!");
  });

  it("renders multiple alternating messages", () => {
    const rows = [
      msg("user", JSON.stringify([{ type: "text", text: "Q1" }])),
      msg("assistant", JSON.stringify([{ type: "text", text: "A1" }])),
      msg("user", JSON.stringify([{ type: "text", text: "Q2" }])),
      msg("assistant", JSON.stringify([{ type: "text", text: "A2" }])),
    ];
    const html = renderChatMessages(rows, DEFAULT_GREETING);
    expect(html).toContain("msg-row user");
    expect(html).toContain("msg-row assistant");
    expect(html).toContain("Q1");
    expect(html).toContain("A1");
    expect(html).toContain("Q2");
    expect(html).toContain("A2");
  });

  it("skips messages with empty content", () => {
    const rows = [
      msg("user", JSON.stringify([{ type: "text", text: "" }])),
      msg("assistant", JSON.stringify([{ type: "text", text: "Only me" }])),
    ];
    const html = renderChatMessages(rows, DEFAULT_GREETING);
    expect(html).not.toContain("msg-row user");
    expect(html).toContain("msg-row assistant");
    expect(html).toContain("Only me");
  });

  it("skips messages with whitespace-only content", () => {
    const rows = [
      msg("user", JSON.stringify([{ type: "text", text: "   " }])),
      msg("assistant", JSON.stringify([{ type: "text", text: "Real content" }])),
    ];
    const html = renderChatMessages(rows, DEFAULT_GREETING);
    expect(html).not.toContain("msg-row user");
    expect(html).toContain("msg-row assistant");
    expect(html).toContain("Real content");
  });
});
