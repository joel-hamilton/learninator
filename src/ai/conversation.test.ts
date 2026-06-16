import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { FakeAiClient } from "./fake.js";
import { conversationLoop } from "./conversation.js";
import { createToolExecutor } from "./tools.js";
import { DrizzleMissionStore } from "../db/store.js";

describe("conversationLoop", () => {
  let executor: ReturnType<typeof createToolExecutor>;

  beforeAll(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    // Create tables matching the Drizzle schema
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS missions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'onboarding',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS mission_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES missions(id),
        content_type TEXT NOT NULL,
        markdown_content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES missions(id),
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        html_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        feedback_rating TEXT,
        feedback_text TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS reference_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES missions(id),
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        html_content TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES missions(id),
        number INTEGER NOT NULL,
        title TEXT NOT NULL,
        markdown_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        superseded_by INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_id INTEGER NOT NULL REFERENCES missions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Seed a user and mission for FK constraints
    sqlite.exec(
      "INSERT INTO users (id, email, password_hash) VALUES (1, 'test@test.com', 'hash');"
    );
    sqlite.exec(
      "INSERT INTO missions (id, user_id, title, slug) VALUES (1, 1, 'Test', 'test');"
    );

    const testDb = drizzle(sqlite, { schema });
    executor = createToolExecutor(new DrizzleMissionStore(testDb));
  });

  it("returns text when AI gives text-only response", async () => {
    const client = new FakeAiClient([FakeAiClient.textResponse("Hello!")]);
    const result = await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "hi" }],
      tools: [],
    });
    expect(result.text).toBe("Hello!");
    expect(result.toolCallsExecuted).toBe(0);
  });

  it("executes tool calls and continues until text response", async () => {
    const client = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.textResponse("You have 3 lessons."),
    ]);
    const result = await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "what lessons?" }],
      tools: [],
    });
    expect(result.text).toBe("You have 3 lessons.");
    expect(result.toolCallsExecuted).toBe(1);
  });

  it("calls hooks in correct order", async () => {
    const calls: string[] = [];
    const client = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.textResponse("Done."),
    ]);
    await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "hi" }],
      tools: [],
      hooks: {
        onAssistantMessage: async () => {
          calls.push("assistant");
        },
        onBeforeToolExecution: async () => {
          calls.push("before");
        },
        onAfterToolExecution: async () => {
          calls.push("after");
        },
      },
    });
    // Round 1: tool_use message -> onAssistantMessage, onBeforeToolExecution, onAfterToolExecution
    // Round 2: text-only message -> onAssistantMessage
    expect(calls).toEqual([
      "assistant",
      "before",
      "after",
      "assistant",
    ]);
  });

  it("handles max_tokens truncation", async () => {
    const client = new FakeAiClient([FakeAiClient.maxTokensResponse("Partial")]);
    const result = await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "hi" }],
      tools: [],
    });
    expect(result.text).toContain("[My response was cut short");
    expect(result.text).toContain("Partial");
  });

  it("handles multiple tool rounds", async () => {
    const client = new FakeAiClient([
      FakeAiClient.toolUseResponse("list_lessons"),
      FakeAiClient.toolUseResponse("read_mission_content", {
        content_type: "mission",
      }),
      FakeAiClient.textResponse("All done."),
    ]);
    const result = await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "hi" }],
      tools: [],
    });
    expect(result.toolCallsExecuted).toBe(2);
    expect(result.text).toBe("All done.");
  });

  it("calls onTruncated hook", async () => {
    let truncatedCalled = false;
    const client = new FakeAiClient([FakeAiClient.maxTokensResponse("Partial")]);
    await conversationLoop({
      client,
      toolExecutor: executor,
      missionId: 1,
      systemPrompt: "test",
      initialMessages: [{ role: "user", content: "hi" }],
      tools: [],
      hooks: {
        onTruncated: async () => {
          truncatedCalled = true;
        },
      },
    });
    expect(truncatedCalled).toBe(true);
  });
});
