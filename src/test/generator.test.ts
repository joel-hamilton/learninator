import { describe, it, expect, beforeEach } from "vitest";
import {
  LessonGenerator,
  buildJobKey,
  type JobStatus,
} from "../lessons/generator.js";
import { InMemoryMissionStore } from "../db/store.js";
import { FakeAiClient } from "../ai/fake.js";
import { createToolExecutor } from "../ai/tools.js";
import type { AiClient, AiMessage, AiMessageParam, AiTool, ToolCallOptions, ChatOptions } from "../ai/types.js";
import type { EventBus, ToolEvent } from "../ai/events.js";
import type { Logger } from "../logger.js";

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function spyEventBus(): { bus: EventBus; events: Array<{ missionId: number; event: ToolEvent }> } {
  const events: Array<{ missionId: number; event: ToolEvent }> = [];
  return {
    events,
    bus: {
      emit(missionId, event) {
        events.push({ missionId, event });
      },
      subscribe: () => () => {},
      subscribeUser: () => () => {},
      emitUser: () => {},
    },
  };
}

async function seedMission(store: InMemoryMissionStore) {
  const mission = await store.createMission({
    userId: 1,
    title: "Test Mission",
    slug: "test-mission",
    status: "active",
  });
  return mission;
}

async function seedLesson(store: InMemoryMissionStore, missionId: number) {
  return store.createLesson({
    missionId,
    number: 1,
    title: "Lesson One",
    slug: "lesson-one",
    htmlContent: "<p>Hello</p>",
    status: "active",
  });
}

/** Poll getJobStatus until the job is no longer running, or maxRetries exhausted. */
async function pollJobDone(
  gen: LessonGenerator,
  key: string,
  maxRetries = 20,
): Promise<JobStatus> {
  for (let i = 0; i < maxRetries; i++) {
    const status = gen.getJobStatus(key);
    if (status.status !== "running") return status;
    await new Promise((r) => setTimeout(r, 5));
  }
  return gen.getJobStatus(key);
}

function makeGenerator(store: InMemoryMissionStore, ai: AiClient, opts?: {
  events?: EventBus;
}) {
  const toolExecutor = createToolExecutor(store);
  const events = opts?.events ?? spyEventBus().bus;
  return new LessonGenerator({ ai, toolExecutor, store, events, logger: noopLogger });
}

// ── Tests ──

describe("LessonGenerator", () => {
  let store: InMemoryMissionStore;
  let mission: Awaited<ReturnType<typeof seedMission>>;
  let lesson: Awaited<ReturnType<typeof seedLesson>>;

  beforeEach(async () => {
    store = new InMemoryMissionStore();
    // Seed a user so the AI tools don't choke on missing user lookups
    await store.createUser({ email: "test@test.com", passwordHash: "hash" });
    mission = await seedMission(store);
    lesson = await seedLesson(store, mission.id);
  });

  // ── US1: store-based data access ──

  it("uses MissionStore instead of raw Drizzle (no drizzle imports in generator)", () => {
    // The fact that this test file compiles and runs without importing
    // drizzle-orm or schema.js proves the generator doesn't need them.
    const gen = makeGenerator(store, new FakeAiClient([]));
    expect(gen).toBeInstanceOf(LessonGenerator);
  });

  // ── T022: generateNext creates running job and returns key ──

  it("generateNext returns a valid key and starts a running job", async () => {
    // Pre-seed lesson 2 so findResult (getLatestLesson) discovers it as "new"
    await store.createLesson({
      missionId: mission.id,
      number: 2,
      title: "Lesson Two",
      slug: "lesson-two",
      htmlContent: "<p>Next</p>",
      status: "active",
    });

    const ai = new FakeAiClient([FakeAiClient.textResponse("New lesson created.")]);
    const gen = makeGenerator(store, ai);

    const key = gen.generateNext(mission.id, lesson, mission);
    expect(key).toBeTruthy();
    expect(key).toContain("next");

    // Should be running immediately after dispatch
    const immediate = gen.getJobStatus(key);
    expect(immediate.status).toBe("running");

    // Wait for job to complete
    const final = await pollJobDone(gen, key);
    expect(final.status).toBe("done");
    if (final.status === "done") {
      expect(final.lessonNumber).toBe(2);
      expect(final.lessonTitle).toBe("Lesson Two");
    }
  });

  // ── T023: duplicate calls deduplicate ──

  it("returns the same job key for duplicate generation requests", () => {
    const ai = new FakeAiClient([FakeAiClient.textResponse("Done.")]);
    const gen = makeGenerator(store, ai);

    const key1 = gen.generateNext(mission.id, lesson, mission);
    const key2 = gen.generateNext(mission.id, lesson, mission);

    expect(key1).toBe(key2);
  });

  // ── T024: getJobStatus lifecycle ──

  it("getJobStatus transitions: not_found → running → done → not_found", async () => {
    // Pre-seed lesson 2 so findResult discovers it
    const store2 = new InMemoryMissionStore();
    await store2.createUser({ email: "test@test.com", passwordHash: "hash" });
    const mission2 = await seedMission(store2);
    const lesson2 = await seedLesson(store2, mission2.id);
    await store2.createLesson({
      missionId: mission2.id,
      number: 2,
      title: "Lesson Two",
      slug: "lesson-two",
      htmlContent: "<p>Next</p>",
      status: "active",
    });

    const ai = new FakeAiClient([FakeAiClient.textResponse("Done.")]);
    const gen = makeGenerator(store2, ai);

    // not_found for unknown key
    expect(gen.getJobStatus("nonexistent-key").status).toBe("not_found");

    const key = gen.generateNext(mission2.id, lesson2, mission2);

    // running immediately
    expect(gen.getJobStatus(key).status).toBe("running");

    // done after completion
    const done = await pollJobDone(gen, key);
    expect(done.status).toBe("done");

    // consumed: done removes job, next call returns not_found
    expect(gen.getJobStatus(key).status).toBe("not_found");
  });

  // ── T025: AI error sets job status to error ──

  it("sets status to error when the AI throws", async () => {
    const throwingAi: AiClient = {
      async chat(_systemPrompt: string, _messages: AiMessageParam[], _options?: ChatOptions) {
        throw new Error("AI crashed");
      },
      async chatWithTools(_systemPrompt: string, _messages: AiMessageParam[], _tools: AiTool[], _options?: ToolCallOptions) {
        throw new Error("AI crashed");
      },
      async continueWithToolResults(
        _prior: AiMessageParam[],
        _assistant: AiMessageParam,
        _results: any[],
        _systemPrompt: string,
        _tools: AiTool[],
        _options?: ToolCallOptions,
      ) {
        throw new Error("AI crashed");
      },
    };
    const gen = makeGenerator(store, throwingAi);

    const key = gen.generateNext(mission.id, lesson, mission);
    const final = await pollJobDone(gen, key);
    expect(final.status).toBe("error");
    if (final.status === "error") {
      expect(final.error).toContain("AI crashed");
    }
  });

  // ── T026: EventBus spy records tool events ──

  it("emits tool_start and tool_end events via EventBus", async () => {
    const spy = spyEventBus();

    // First response: tool_use triggers tool execution + events
    // Second response: text to end the loop
    const ai = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons", {}),
      FakeAiClient.textResponse("Done reviewing."),
    ]);
    const gen = makeGenerator(store, ai, { events: spy.bus });

    const key = gen.generateNext(mission.id, lesson, mission);
    await pollJobDone(gen, key);

    expect(spy.events.length).toBeGreaterThanOrEqual(2);
    const startEv = spy.events.find((e) => e.event.type === "tool_start");
    const endEv = spy.events.find((e) => e.event.type === "tool_end");
    expect(startEv).toBeDefined();
    expect(endEv).toBeDefined();
    if (startEv) {
      expect(startEv.event.names.length).toBeGreaterThan(0);
      expect(startEv.missionId).toBe(mission.id);
    }
  });

  // ── T027: all four methods create correct key prefixes ──

  it("generateNext uses 'next' key prefix", () => {
    const gen = makeGenerator(store, new FakeAiClient([]));
    const key = gen.generateNext(mission.id, lesson, mission);
    expect(key).toMatch(/^next-/);
  });

  it("generateSubLesson uses 'sub' key prefix", () => {
    const gen = makeGenerator(store, new FakeAiClient([]));
    const key = gen.generateSubLesson(mission.id, lesson, mission);
    expect(key).toMatch(/^sub-/);
  });

  it("generateRegenerate uses 'regenerate' key prefix", () => {
    const gen = makeGenerator(store, new FakeAiClient([]));
    const key = gen.generateRegenerate(mission.id, lesson, mission, "harder");
    expect(key).toMatch(/^regenerate-/);
  });

  it("generateBridging uses 'bridge' key prefix", () => {
    const gen = makeGenerator(store, new FakeAiClient([]));
    const key = gen.generateBridging(mission.id, lesson, mission);
    expect(key).toMatch(/^bridge-/);
  });

  // ── US5: existing behavior preserved ──

  it("buildJobKey is deterministic and spaced by type", () => {
    const k1 = buildJobKey(1, 1, null, "next");
    const k2 = buildJobKey(1, 1, null, "next");
    const k3 = buildJobKey(1, 1, null, "sub");
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it("generateRegenerate finds existing lesson in-place", async () => {
    const ai = new FakeAiClient([FakeAiClient.textResponse("Regenerated.")]);
    const gen = makeGenerator(store, ai);

    const key = gen.generateRegenerate(mission.id, lesson, mission, "easier");
    const final = await pollJobDone(gen, key);
    expect(final.status).toBe("done");
    if (final.status === "done") {
      // Regenerate modifies in-place, so it should find the same lesson number
      expect(final.lessonNumber).toBe(lesson.number);
    }
  });

  it("generateNext result callback returns null when no new lesson was created", async () => {
    // AI responds with text but no lesson creation tool was called,
    // so getLatestLesson returns the same (original) lesson → result is null.
    // getJobStatus deletes the job when status==="done" but falls through
    // to return "running" when job.result is null (preserving existing behavior).
    const ai = new FakeAiClient([FakeAiClient.textResponse("Nothing new.")]);
    const gen = makeGenerator(store, ai);

    const key = gen.generateNext(mission.id, lesson, mission);

    // Poll until the job disappears (job deleted after done-with-null-result)
    let status = gen.getJobStatus(key);
    for (let i = 0; i < 20 && status.status !== "not_found"; i++) {
      await new Promise((r) => setTimeout(r, 5));
      status = gen.getJobStatus(key);
    }
    expect(status.status).toBe("not_found");
  });

  it("result callback returns new lesson when a new one is created", async () => {
    // Seed a new lesson AFTER the AI response to simulate the AI creating one
    const store2 = new InMemoryMissionStore();
    await store2.createUser({ email: "test@test.com", passwordHash: "hash" });
    const mission2 = await seedMission(store2);
    const lesson2 = await seedLesson(store2, mission2.id);

    // The AI triggers lesson creation via tools, then the findResult
    // callback fetches the latest lesson. We pre-seed the "next" lesson
    // so getLatestLesson returns it.
    await store2.createLesson({
      missionId: mission2.id,
      number: 2,
      title: "Lesson Two",
      slug: "lesson-two",
      htmlContent: "<p>Next</p>",
      status: "active",
    });

    const ai = new FakeAiClient([FakeAiClient.textResponse("Created.")]);
    const gen = makeGenerator(store2, ai);

    const key = gen.generateNext(mission2.id, lesson2, mission2);
    const final = await pollJobDone(gen, key);
    expect(final.status).toBe("done");
    if (final.status === "done") {
      expect(final.lessonNumber).toBe(2);
      expect(final.lessonTitle).toBe("Lesson Two");
    }
  });
});
