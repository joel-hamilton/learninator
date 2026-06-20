import { describe, it, expect } from "vitest";
import { FakeAiClient } from "../ai/index.js";
import { InMemoryChatStore, InMemoryMissionStore } from "../db/store.js";
import { handlePostChat } from "../services/mission-chat.service.js";

// ── US3: handlePostChat ────────────────────────────────────────────────

describe("handlePostChat", () => {
  it("triggers title generation and saves the title when didActivate is true", async () => {
    const chatStore = new InMemoryChatStore();
    // Seed messages so generateTitle has content to work with
    await chatStore.saveChatMessage({
      missionId: 1,
      role: "user",
      content: JSON.stringify("I want to learn guitar"),
    });
    await chatStore.saveChatMessage({
      missionId: 1,
      role: "assistant",
      content: JSON.stringify("Great choice! Let's get started."),
    });

    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Test",
      slug: "test",
    });

    // Queue a title response for the ai.chat() call inside generateTitle
    const ai = new FakeAiClient([FakeAiClient.textResponse("Learning Guitar")]);

    const result = await handlePostChat(
      { text: "Mission activated!", didActivate: true },
      mission.id,
      ai,
      chatStore,
      missionStore,
    );

    expect(result.didActivate).toBe(true);
    expect(result.text).toBe("Mission activated!");

    // Title should have been generated and saved to the store
    const updated = await missionStore.getMission(mission.id, 1);
    expect(updated!.title).toBe("Learning Guitar");
  });

  it("does not trigger title generation when didActivate is false", async () => {
    const chatStore = new InMemoryChatStore();
    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Original Title",
      slug: "test",
    });

    // No responses queued — if generateTitle is incorrectly called,
    // the FakeAiClient fallback would fire and potentially change the title
    const ai = new FakeAiClient([]);

    const result = await handlePostChat(
      { text: "Sure, let me explain that.", didActivate: false },
      mission.id,
      ai,
      chatStore,
      missionStore,
    );

    expect(result.didActivate).toBe(false);
    expect(result.text).toBe("Sure, let me explain that.");

    // Title must not have changed
    const updated = await missionStore.getMission(mission.id, 1);
    expect(updated!.title).toBe("Original Title");
  });

  it("defaults empty text to 'Let us continue.'", async () => {
    const chatStore = new InMemoryChatStore();
    const missionStore = new InMemoryMissionStore();
    const mission = await missionStore.createMission({
      userId: 1,
      title: "Test",
      slug: "test",
    });
    const ai = new FakeAiClient([]);

    const result = await handlePostChat(
      { text: "", didActivate: false },
      mission.id,
      ai,
      chatStore,
      missionStore,
    );

    expect(result.text).toBe("Let us continue.");
    expect(result.didActivate).toBe(false);
  });
});
