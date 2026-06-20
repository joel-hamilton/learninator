import { describe, it, expect } from "vitest";
import type { AiMessageParam } from "../ai/types.js";
import { buildSystemPrompt, prepareMessages } from "../services/mission-chat.service.js";
import type { MissionChatInput } from "../services/mission-chat.service.js";
import { InMemoryChatStore, InMemoryContentStore } from "../db/store.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<MissionChatInput> = {}): MissionChatInput {
  return {
    missionId: 1,
    userId: 1,
    message: "",
    missionTitle: "Test Mission",
    missionStatus: "active",
    ...overrides,
  };
}

// ── US4: buildSystemPrompt branches ────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("includes Guided Onboarding Mode instructions when onboarding with guided mode", async () => {
    const prompt = await buildSystemPrompt(1, "onboarding", "guided");
    expect(prompt).toContain("Guided Onboarding Mode");
    expect(prompt).toContain("ask_guided_question");
  });

  it("includes Chat Onboarding Mode when onboarding with chat mode", async () => {
    const prompt = await buildSystemPrompt(1, "onboarding", "chat");
    expect(prompt).toContain("Chat Onboarding Mode");
    expect(prompt).not.toContain("ask_guided_question");
  });

  it("includes lesson-specific instructions when lesson object is provided", async () => {
    const prompt = await buildSystemPrompt(1, "active", undefined, {
      number: "3",
      title: "Advanced Topics",
    });
    expect(prompt).toContain("Lesson 3");
    expect(prompt).toContain("Advanced Topics");
    expect(prompt).toContain("create_lesson");
    expect(prompt).toContain("create_sub_lesson");
  });

  it("includes Current mission goals when content store has mission content", async () => {
    const contentStore = new InMemoryContentStore();
    await contentStore.upsertMissionContent({
      missionId: 1,
      contentType: "mission",
      markdownContent: "Learn Rust by building a CLI tool",
    });

    const prompt = await buildSystemPrompt(1, "active", undefined, undefined, contentStore);
    expect(prompt).toContain("Current mission goals:");
    expect(prompt).toContain("Learn Rust by building a CLI tool");
  });

  it("omits Current mission goals when content store returns no content", async () => {
    const contentStore = new InMemoryContentStore();
    const prompt = await buildSystemPrompt(1, "active", undefined, undefined, contentStore);
    expect(prompt).not.toContain("Current mission goals:");
  });
});

// ── US1: prepareMessages integration ────────────────────────────────────

describe("prepareMessages", () => {
  it("includes Guided Onboarding Mode in system prompt for guided onboarding mission", async () => {
    const chatStore = new InMemoryChatStore();
    const contentStore = new InMemoryContentStore();

    const { systemPrompt } = await prepareMessages(
      makeInput({
        missionStatus: "onboarding",
        onboardingMode: "guided",
        message: "I want to learn guitar",
      }),
      chatStore,
      contentStore,
    );

    expect(systemPrompt).toContain("Guided Onboarding Mode");
    expect(systemPrompt).toContain("ask_guided_question");
  });

  it("prefixes saved message with [Re: Lesson] when lesson context is provided", async () => {
    const chatStore = new InMemoryChatStore();
    const contentStore = new InMemoryContentStore();

    await prepareMessages(
      makeInput({
        message: "explain this concept",
        lesson: { number: "2", title: "Core Concepts" },
      }),
      chatStore,
      contentStore,
    );

    const messages = await chatStore.getChatMessages(1);
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    const content = JSON.parse(userMsg!.content);
    expect(content).toContain("[Re: Lesson 2: Core Concepts]");
  });

  it("includes Current mission goals in system prompt when mission content exists", async () => {
    const chatStore = new InMemoryChatStore();
    const contentStore = new InMemoryContentStore();
    await contentStore.upsertMissionContent({
      missionId: 1,
      contentType: "mission",
      markdownContent: "Learn TypeScript design patterns",
    });

    const { systemPrompt } = await prepareMessages(
      makeInput({ message: "let's start" }),
      chatStore,
      contentStore,
    );

    expect(systemPrompt).toContain("Current mission goals:");
    expect(systemPrompt).toContain("Learn TypeScript design patterns");
  });

  it("omits Current mission goals in system prompt when no mission content exists", async () => {
    const chatStore = new InMemoryChatStore();
    const contentStore = new InMemoryContentStore();

    const { systemPrompt } = await prepareMessages(
      makeInput({ message: "hello" }),
      chatStore,
      contentStore,
    );

    expect(systemPrompt).not.toContain("Current mission goals:");
  });

  it("includes context prefix in saved message when context is provided (no lesson)", async () => {
    const chatStore = new InMemoryChatStore();
    const contentStore = new InMemoryContentStore();

    await prepareMessages(
      makeInput({
        message: "tell me more",
        context: "The user just completed lesson 1",
      }),
      chatStore,
      contentStore,
    );

    const messages = await chatStore.getChatMessages(1);
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    const content = JSON.parse(userMsg!.content);
    expect(content).toContain("[Context: The user just completed lesson 1]");
    expect(content).toContain("tell me more");
  });
});
