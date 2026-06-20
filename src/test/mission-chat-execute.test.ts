import { describe, it, expect } from "vitest";
import type { AiClient, AiMessageParam, AiToolUseBlock, ToolExecutor } from "../ai/types.js";
import { FakeAiClient, AIError, createEventBus, TEACHER_TOOLS } from "../ai/index.js";
import { WorkflowStateManager } from "../ai/workflow-state.js";
import { InMemoryChatStore } from "../db/store.js";
import { executeConversation } from "../services/mission-chat.service.js";
import type { ExecuteDeps } from "../services/mission-chat.service.js";

// ── Helpers ────────────────────────────────────────────────────────────

const noopLogger = { debug: () => {}, info: () => {}, error: () => {} };

const stubToolExecutor: ToolExecutor = {
  async executeTool() {
    return "ok";
  },
  async executeToolCalls(_missionId, blocks) {
    return blocks.map((b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      content: "ok",
    }));
  },
};

function makeDeps(ai: AiClient, overrides: Partial<ExecuteDeps> = {}): ExecuteDeps {
  const chatStore = new InMemoryChatStore();
  const events = createEventBus();
  return {
    ai,
    toolExecutor: stubToolExecutor,
    workflowState: new WorkflowStateManager(events),
    chatStore,
    logger: noopLogger,
    events,
    ...overrides,
  };
}

const testMessages: AiMessageParam[] = [{ role: "user", content: "hello" }];

// ── US2: executeConversation ───────────────────────────────────────────

describe("executeConversation", () => {
  it("returns text and didActivate=false when AI does not use tools", async () => {
    const ai = new FakeAiClient([FakeAiClient.textResponse("Here is the answer.")]);
    const deps = makeDeps(ai);

    const result = await executeConversation(
      "You are a teacher.",
      testMessages,
      [],
      undefined,
      1,
      1,
      "chat",
      "Test chat",
      deps,
    );

    expect(result.didActivate).toBe(false);
    expect(result.text).toContain("Here is the answer.");
  });

  it("sets didActivate=true and completes workflow when mark_mission_active is called", async () => {
    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("mark_mission_active"),
      FakeAiClient.textResponse("Mission activated!"),
    ]);
    const deps = makeDeps(ai);

    const result = await executeConversation(
      "You are a teacher.",
      testMessages,
      TEACHER_TOOLS,
      undefined,
      1,
      1,
      "chat",
      "Test chat",
      deps,
    );

    expect(result.didActivate).toBe(true);
    expect(result.text).toContain("Mission activated!");

    const workflows = deps.workflowState.getActiveWorkflows(1);
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows[0].status).toBe("completed");
  });

  it("marks workflow as failed when AIError is thrown", async () => {
    const failingAi: AiClient = {
      chat: async () => "",
      chatWithTools: async () => {
        throw new AIError("AI failed");
      },
      continueWithToolResults: async () => {
        throw new AIError("AI failed");
      },
    };
    const deps = makeDeps(failingAi);

    await expect(
      executeConversation(
        "You are a teacher.",
        testMessages,
        [],
        undefined,
        1,
        1,
        "chat",
        "Test chat",
        deps,
      ),
    ).rejects.toThrow(AIError);

    const workflows = deps.workflowState.getActiveWorkflows(1);
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows[0].status).toBe("failed");
    expect(workflows[0].error).toContain("AI failed");
  });

  it("returns pausedToolUse when tool is in pauseOnTools set", async () => {
    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("ask_guided_question", {
        question: "What do you want to learn?",
        options: ["Guitar", "Piano"],
      }),
    ]);
    const deps = makeDeps(ai);

    const result = await executeConversation(
      "You are a teacher.",
      testMessages,
      TEACHER_TOOLS,
      new Set(["ask_guided_question"]),
      1,
      1,
      "chat",
      "Test chat",
      deps,
    );

    expect(result.pausedToolUse).toBeDefined();
    expect(result.pausedToolUse!.name).toBe("ask_guided_question");
    expect(result.didActivate).toBe(false);
  });
});
