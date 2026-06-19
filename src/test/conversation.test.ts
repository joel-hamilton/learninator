import { describe, it, expect } from "vitest";
import { conversationLoop, createStandardHooks } from "../ai/conversation.js";
import { FakeAiClient } from "../ai/fake.js";
import { createEventBus } from "../ai/events.js";
import { createToolExecutor } from "../ai/tools.js";
import { InMemoryToolStore } from "../db/store.js";
import type { ToolEvent } from "../ai/events.js";

// ── User Story 1: conversationLoop emits events directly ──

describe("User Story 1 — conversationLoop emits events directly", () => {
  // T007: conversationLoop with EventBus + tool blocks
  it("emits tool_start before execution and tool_end after execution (T007 US1)", async () => {
    const store = new InMemoryToolStore();
    const toolExecutor = createToolExecutor(store);
    const bus = createEventBus();
    const received: ToolEvent[] = [];
    const unsub = bus.subscribe(100, (event) => { received.push(event); });

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
      events: bus,
    });

    unsub();

    expect(received.length).toBe(2);
    expect(received[0].type).toBe("tool_start");
    expect(received[0].names).toContain("Listing lessons");
    expect(received[1].type).toBe("tool_end");
  });

  // T008: conversationLoop without EventBus — no crash
  it("does not crash when events is not provided (T008 US1)", async () => {
    const store = new InMemoryToolStore();
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
    const store = new InMemoryToolStore();
    const toolExecutor = createToolExecutor(store);
    const bus = createEventBus();
    const received: ToolEvent[] = [];
    const unsub = bus.subscribe(100, (event) => { received.push(event); });

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
      events: bus,
    });

    unsub();

    expect(received.length).toBe(0);
  });
});

// ── User Story 2: createStandardHooks only persists to DB ──

describe("User Story 2 — createStandardHooks only persists to DB", () => {
  // T011: createStandardHooks has no event emission side effects
  it("returned hooks have no event emission side effects — only DB saves occur (T011 US2)", async () => {
    const store = new InMemoryToolStore();
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
    const store = new InMemoryToolStore();
    const toolExecutor = createToolExecutor(store);
    const bus = createEventBus();
    const received: ToolEvent[] = [];
    const unsub = bus.subscribe(100, (event) => { received.push(event); });

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
      events: bus,
      hooks: {
        onBeforeToolExecution: async () => {
          // No event emission here
        },
        onAfterToolExecution: async () => {
          // No event emission here
        },
      },
    });

    unsub();

    // Events still fired from conversationLoop
    expect(received.length).toBe(2);
    expect(received[0].type).toBe("tool_start");
    expect(received[1].type).toBe("tool_end");
  });
});
