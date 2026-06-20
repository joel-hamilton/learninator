import { describe, it, expect } from "vitest";
import type { AiClient } from "../ai/types.js";
import { InMemoryChatStore, InMemoryMissionStore } from "../db/store.js";
import { generateTitle } from "../services/mission-chat.service.js";

// ── US5: generateTitle ─────────────────────────────────────────────────

describe("generateTitle", () => {
  it("calls AI with model 'low' and saves the returned title to the mission store", async () => {
    const chatStore = new InMemoryChatStore();
    await chatStore.saveChatMessage({
      missionId: 1,
      role: "user",
      content: JSON.stringify("I want to learn piano"),
    });
    await chatStore.saveChatMessage({
      missionId: 1,
      role: "assistant",
      content: JSON.stringify("Great! Let me help you."),
    });

    let capturedModel: string | undefined;
    const ai: AiClient = {
      async chat(_systemPrompt, _messages, options) {
        capturedModel = options?.model;
        return "My Piano Mission";
      },
      chatWithTools: async () => ({ content: [], stop_reason: "end_turn" }),
      continueWithToolResults: async () => ({ content: [], stop_reason: "end_turn" }),
    };

    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Original",
      slug: "test",
    });

    const result = await generateTitle(mission.id, ai, chatStore, missionStore);

    expect(capturedModel).toBe("low");
    expect(result).toBe("My Piano Mission");

    // Title should be saved to the store
    const updated = await missionStore.getMission(mission.id, 1);
    expect(updated!.title).toBe("My Piano Mission");
  });

  it("returns null without calling AI when chat store has no messages", async () => {
    const chatStore = new InMemoryChatStore(); // empty
    let aiCalled = false;
    const ai: AiClient = {
      async chat() {
        aiCalled = true;
        return "";
      },
      chatWithTools: async () => ({ content: [], stop_reason: "end_turn" }),
      continueWithToolResults: async () => ({ content: [], stop_reason: "end_turn" }),
    };

    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Original Title",
      slug: "test",
    });

    const result = await generateTitle(mission.id, ai, chatStore, missionStore);

    expect(result).toBeNull();
    expect(aiCalled).toBe(false);
  });

  it("returns null when AI client throws an error, without propagating", async () => {
    const chatStore = new InMemoryChatStore();
    await chatStore.saveChatMessage({
      missionId: 1,
      role: "user",
      content: JSON.stringify("Hello"),
    });

    const ai: AiClient = {
      async chat() {
        throw new Error("Network error");
      },
      chatWithTools: async () => {
        throw new Error("Network error");
      },
      continueWithToolResults: async () => {
        throw new Error("Network error");
      },
    };

    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Original Title",
      slug: "test",
    });

    // Should not throw — error is caught internally
    const result = await generateTitle(mission.id, ai, chatStore, missionStore);

    expect(result).toBeNull();

    // Title should NOT have changed
    const updated = await missionStore.getMission(mission.id, 1);
    expect(updated!.title).toBe("Original Title");
  });
});
