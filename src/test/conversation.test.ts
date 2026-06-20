import { describe, it, expect } from "vitest";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { FakeAiClient } from "../ai/fake.js";
import { createToolExecutor } from "../ai/tools.js";
import {
  InMemoryMissionStore,
  InMemoryLessonStore,
  InMemoryChatStore,
  InMemoryContentStore,
  InMemoryRefDocStore,
  InMemoryLearningRecordStore,
} from "../db/store.js";
import type { ToolEvent, ToolEventBus } from "../ai/events.js";
import type { ToolStore } from "../ai/types.js";

/**
 * Creates a spy event bus that captures emitted events for assertions.
 */
function spyEventBus(): { bus: ToolEventBus; received: ToolEvent[] } {
  const received: ToolEvent[] = [];
  return {
    received,
    bus: {
      emit(_missionId: number, event: ToolEvent): void {
        received.push(event);
      },
    },
  };
}

/**
 * Creates a combined store that satisfies the ToolStore intersection
 * by delegating to individual InMemory store instances.
 */
function createCombinedStore(): ToolStore {
  const mission = new InMemoryMissionStore();
  const lesson = new InMemoryLessonStore();
  const chat = new InMemoryChatStore();
  const content = new InMemoryContentStore();
  const refdoc = new InMemoryRefDocStore();
  const learningRecord = new InMemoryLearningRecordStore();
  const stores = { mission, lesson, chat, content, refdoc, learningRecord };
  return new Proxy({} as ToolStore, {
    get(_target, prop: string | symbol) {
      for (const store of Object.values(stores)) {
        const val = (store as any)[prop];
        if (typeof val === "function") {
          return val.bind(store);
        }
      }
    },
  });
}

// ── User Story 1: conversationLoop emits events directly ──

describe("User Story 1 — conversationLoop emits events directly", () => {
  // T007: conversationLoop with EventBus + tool blocks
  it("emits tool_start before execution and tool_end after execution (T007 US1)", async () => {
    const store = createCombinedStore();
    const toolExecutor = createToolExecutor(store);
    const spy = spyEventBus();

    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.textResponse("Done."),
    ]);

    await conversationLoop({
      client: ai,
      toolExecutor,
      missionId: 100,
      systemPrompt: "You are a helpful assistant.",
      initialMessages: [],
      tools: [],
      events: spy.bus,
    });

    expect(spy.received.length).toBe(2);
    expect(spy.received[0].type).toBe("tool_start");
    expect(spy.received[0].names).toContain("Listing lessons");
    expect(spy.received[1].type).toBe("tool_end");
  });

  // T008: conversationLoop without EventBus — no crash
  it("does not crash when events is not provided (T008 US1)", async () => {
    const store = createCombinedStore();
    const toolExecutor = createToolExecutor(store);

    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.textResponse("Done."),
    ]);

    const result = await conversationLoop({
      client: ai,
      toolExecutor,
      missionId: 100,
      systemPrompt: "You are a helpful assistant.",
      initialMessages: [],
      tools: [],
    });

    expect(result.toolCallsExecuted).toBe(1);
    expect(result.text).toBe("Done.");
  });

  // T009: conversationLoop with no tool blocks — no events
  it("does not emit events when AI returns no tool blocks (T009 US1)", async () => {
    const store = createCombinedStore();
    const toolExecutor = createToolExecutor(store);
    const spy = spyEventBus();

    const ai = new FakeAiClient([
      FakeAiClient.textResponse("Hello, how can I help?"),
    ]);

    await conversationLoop({
      client: ai,
      toolExecutor,
      missionId: 100,
      systemPrompt: "You are a helpful assistant.",
      initialMessages: [],
      tools: [],
      events: spy.bus,
    });

    expect(spy.received.length).toBe(0);
  });
});

// ── User Story 2: createStandardHooks only persists to DB ──

describe("User Story 2 — createStandardHooks only persists to DB", () => {
  // T011: createStandardHooks has no event emission side effects
  it("returned hooks have no event emission side effects — only DB saves occur (T011 US2)", async () => {
    const store = new InMemoryChatStore();
    const hooks = createStandardHooks({ missionId: 1, store });

    // The hooks object shape: no event-related methods
    expect(Object.keys(hooks)).toEqual([
      "onAssistantMessage",
      "onBeforeToolExecution",
      "onAfterToolExecution",
    ]);

    // Call hooks — should not crash, should persist to store
    await hooks.onAssistantMessage?.([{ type: "text", text: "Hello" }]);
    await hooks.onBeforeToolExecution?.([{ type: "tool_use", id: "tu_1", name: "list_lessons", input: {} }]);
    await hooks.onAfterToolExecution?.([{ type: "tool_result", tool_use_id: "tu_1", content: "[]" }]);

    // DB saves occurred (assistant message + tool result)
    const msgs = await store.getChatMessages(1);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[1].role).toBe("user");
  });
});

// ── User Story 4: new callers get event emission for free ──

describe("User Story 4 — new callers get event emission for free", () => {
  // T020: new caller with minimal hooks + EventBus
  it("fires events without any event wiring in hooks (T020 US4)", async () => {
    const store = createCombinedStore();
    const toolExecutor = createToolExecutor(store);
    const spy = spyEventBus();

    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.textResponse("Done."),
    ]);

    // Minimal hooks — no event wiring at all
    await conversationLoop({
      client: ai,
      toolExecutor,
      missionId: 100,
      systemPrompt: "You are a helpful assistant.",
      initialMessages: [],
      tools: [],
      events: spy.bus,
      hooks: {
        onBeforeToolExecution: async () => {
          // No event emission here
        },
        onAfterToolExecution: async () => {
          // No event emission here
        },
      },
    });

    // Events still fired from conversationLoop
    expect(spy.received.length).toBe(2);
    expect(spy.received[0].type).toBe("tool_start");
    expect(spy.received[1].type).toBe("tool_end");
  });
});
