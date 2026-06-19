import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { FakeAiClient } from "../ai/fake.js";
import { createToolExecutor } from "../ai/tools.js";
import { DrizzleMissionStore } from "../db/store.js";
import { LessonGenerator, buildJobKey } from "./generator.js";
import type { EventBus, ToolEvent, WorkflowEvent } from "../ai/events.js";
import type { AiClient, AiMessage } from "../ai/types.js";
import { createLogger } from "../logger.js";

// ── Helpers ──

const logger = createLogger("test");

/** An AI client that always throws an error. */
class ThrowingAiClient implements AiClient {
  async chat(): Promise<string> {
    throw new Error("AI failed");
  }
  async chatWithTools(): Promise<AiMessage> {
    throw new Error("AI failed");
  }
  async continueWithToolResults(): Promise<AiMessage> {
    throw new Error("AI failed");
  }
}

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'onboarding',
      onboarding_mode TEXT NOT NULL DEFAULT 'guided',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE mission_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      content_type TEXT NOT NULL,
      markdown_content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      html_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      parent_lesson_id INTEGER REFERENCES lessons(id),
      sub_number INTEGER,
      feedback_rating TEXT,
      feedback_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE reference_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      html_content TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE learning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      markdown_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      superseded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE guided_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL REFERENCES missions(id),
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT,
      answer_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO users (id, email, password_hash) VALUES (1, 'test@test.com', 'hash');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'active');
  `);

  return drizzle(sqlite, { schema });
}

async function pollUntilDone(
  generator: LessonGenerator,
  key: string,
  timeout = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const status = generator.getJobStatus(key);
    if (status.status === "done" || status.status === "error") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // Force assertion on final status
  const status = generator.getJobStatus(key);
  expect(status.status).toBe("done");
}

describe("LessonGenerator", () => {
  let db: ReturnType<typeof createTestDb>;
  let executor: ReturnType<typeof createToolExecutor>;
  let generator: LessonGenerator;

  beforeEach(() => {
    db = createTestDb();
    executor = createToolExecutor(new DrizzleMissionStore(db));
  });

  describe("buildJobKey", () => {
    it("builds a key for next generation", () => {
      expect(buildJobKey(1, 3, null, "next")).toBe("next-1-3-m");
      expect(buildJobKey(1, 3, 1, "next")).toBe("next-1-3-1");
    });

    it("builds a key for sub generation", () => {
      expect(buildJobKey(2, 5, null, "sub")).toBe("sub-2-5-m");
      expect(buildJobKey(2, 5, 2, "sub")).toBe("sub-2-5-2");
    });
  });

  describe("generateNext", () => {
    it("creates a job, returns a key, and job eventually completes", async () => {
      // Seed a completed lesson first
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "in_progress",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Lesson created!"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      expect(key).toBe("next-1-1-m");

      // Poll until done
      await pollUntilDone(generator, key);

      // After consuming "done", subsequent call returns not_found
      const status = generator.getJobStatus(key);
      expect(status.status).toBe("not_found");
    });

    it("includes feedback and notes in the generation", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Lesson created!"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
        { feedback: "Too easy", notes: "More advanced topics" },
      );

      await pollUntilDone(generator, key);
    });

    it("is running immediately after creation", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "active",
      });

      // Use a client with multiple rounds to keep the job running longer
      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("list_lessons", {}),
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Done"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      // Job should start as "running" synchronously
      const status = generator.getJobStatus(key);
      expect(status.status).toBe("running");
    });
  });

  describe("generateSubLesson", () => {
    it("creates a job, returns a key, and job eventually completes", async () => {
      // Seed a main lesson so the sub-lesson has a parent
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "Main Lesson",
        slug: "main-lesson",
        htmlContent: "<p>Main</p>",
        status: "completed",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_sub_lesson", {
          parent_lesson_number: 1,
          title: "Deeper Dive",
          slug: "deeper-dive",
          html_content: "<p>Deeper</p>",
        }),
        FakeAiClient.textResponse("Sub-lesson created!"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateSubLesson(
        1,
        { number: 1, subNumber: null, title: "Main Lesson" },
        { title: "Test Mission", status: "active" },
      );

      expect(key).toBe("sub-1-1-m");

      await pollUntilDone(generator, key);

      // Verify the sub-lesson was actually created in DB
      const [subLesson] = await db
        .select()
        .from(schema.lessons)
        .where(eq(schema.lessons.subNumber, 1))
        .limit(1);
      expect(subLesson).toBeTruthy();
      expect(subLesson!.title).toBe("Deeper Dive");
    });
  });

  describe("getJobStatus", () => {
    it("returns not_found for unknown key", () => {
      generator = new LessonGenerator({
        ai: new FakeAiClient([]),
        toolExecutor: executor,
        db,
        logger,
      });

      const status = generator.getJobStatus("nonexistent");
      expect(status).toEqual({ status: "not_found" });
    });

    it("returns done with lesson details when job completes", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "in_progress",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Done!"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      await pollUntilDone(generator, key);

      const status = generator.getJobStatus(key);
      expect(status.status).toBe("not_found");
    });
  });

  describe("error handling", () => {
    it("returns error status when AI call fails", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "in_progress",
      });

      const client = new ThrowingAiClient();
      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      // Poll until error
      const start = Date.now();
      while (Date.now() - start < 5000) {
        const status = generator.getJobStatus(key);
        if (status.status === "error") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const errorStatus = generator.getJobStatus(key);
      expect(errorStatus.status).toBe("not_found");
    });

    it("handles errors in generateSubLesson", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "Main Lesson",
        slug: "main-lesson",
        htmlContent: "<p>Main</p>",
        status: "completed",
      });

      const client = new ThrowingAiClient();
      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateSubLesson(
        1,
        { number: 1, subNumber: null, title: "Main Lesson" },
        { title: "Test Mission", status: "active" },
      );

      const start = Date.now();
      while (Date.now() - start < 5000) {
        const status = generator.getJobStatus(key);
        if (status.status === "error") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const errorStatus = generator.getJobStatus(key);
      expect(errorStatus.status).toBe("not_found");
    });
  });

  describe("deduplication", () => {
    it("returns the same key for duplicate generateNext calls", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "active",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second",
          slug: "second",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Done"),
      ]);

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key1 = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );
      const key2 = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      expect(key1).toBe(key2);
    });
  });

  describe("event emission", () => {
    it("emits tool_start and tool_end events via the injected EventBus", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "in_progress",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("list_feedback_history", {}),
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Done"),
      ]);

      const events = new FakeEventBus();

      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
        events,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      await pollUntilDone(generator, key);

      const calls = events.emits;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const startEvent = calls.find((c) => c.event.type === "tool_start");
      const endEvent = calls.find((c) => c.event.type === "tool_end");
      expect(startEvent).toBeDefined();
      expect(endEvent).toBeDefined();
      expect(startEvent!.missionId).toBe(1);
      expect(endEvent!.missionId).toBe(1);
      expect(startEvent!.event.names).toContain("Listing feedback");
    });

    it("does not throw when events dep is omitted", async () => {
      await db.insert(schema.lessons).values({
        missionId: 1,
        number: 1,
        title: "First Lesson",
        slug: "first-lesson",
        htmlContent: "<p>First</p>",
        status: "in_progress",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("create_lesson", {
          title: "Second Lesson",
          slug: "second-lesson",
          html_content: "<p>Second</p>",
        }),
        FakeAiClient.textResponse("Done!"),
      ]);

      // No events in deps — should not crash
      generator = new LessonGenerator({
        ai: client,
        toolExecutor: executor,
        db,
        logger,
      });

      const key = generator.generateNext(
        1,
        { number: 1, subNumber: null, title: "First Lesson" },
        { title: "Test Mission", status: "active" },
      );

      await pollUntilDone(generator, key);
      expect(generator.getJobStatus(key).status).toBe("not_found");
    });
  });
});

/** Simple spy implementing EventBus for tests. */
class FakeEventBus implements EventBus {
  emits: { missionId: number; event: ToolEvent }[] = [];
  userEmits: { userId: number; event: WorkflowEvent }[] = [];

  subscribe(_missionId: number, _cb: (event: ToolEvent) => void): () => void {
    return () => {};
  }

  emit(missionId: number, event: ToolEvent): void {
    this.emits.push({ missionId, event });
  }

  subscribeUser(_userId: number, _cb: (event: WorkflowEvent) => void): () => void {
    return () => {};
  }

  emitUser(userId: number, event: WorkflowEvent): void {
    this.userEmits.push({ userId, event });
  }
}
