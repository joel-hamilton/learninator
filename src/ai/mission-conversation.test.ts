import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { FakeAiClient } from "./fake.js";
import { createToolExecutor } from "./tools.js";
import { DrizzleMissionStore } from "../db/store.js";
import { createMissionConversation } from "./mission-conversation.js";
import type { MissionConversationModule } from "./mission-conversation.js";
import type { AiClient, AiMessage } from "./types.js";
import { createLogger } from "../logger.js";

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
  `);

  return drizzle(sqlite, { schema });
}

async function seedMission(db: any, overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    id: 1,
    userId: 1,
    title: "Test Mission",
    slug: "test-mission",
    status: "onboarding",
    onboardingMode: "guided",
  };
  const vals = { ...defaults, ...overrides };
  await db.insert(schema.missions).values(vals);
}

async function getChatMessages(db: any, missionId: number) {
  return await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.missionId, missionId));
}

async function getMission(db: any, id: number) {
  const [row] = await db
    .select()
    .from(schema.missions)
    .where(eq(schema.missions.id, id))
    .limit(1);
  return row || null;
}

describe("MissionConversation", () => {
  let db: any;
  let executor: ReturnType<typeof createToolExecutor>;
  let mc: MissionConversationModule;

  beforeEach(() => {
    db = createTestDb();
    executor = createToolExecutor(new DrizzleMissionStore(db));
  });

  describe("active mission chat", () => {
    it("AI replies with text for an active mission", async () => {
      await seedMission(db, { status: "active" });

      const client = new FakeAiClient([
        FakeAiClient.textResponse("I can help you learn Rust."),
      ]);
      mc = createMissionConversation({ store: new DrizzleMissionStore(db),
        ai: client,
        toolExecutor: executor,
        logger,
      });

      const result = await mc.run({
        missionId: 1,
        missionStatus: "active",
        userMessage: "Help me learn Rust",
      });

      expect(result.type).toBe("reply");
      if (result.type === "reply") {
        expect(result.text).toBe("I can help you learn Rust.");
      }
    });
  });

  describe("onboarding mission chat", () => {
    it("AI replies with text for an onboarding mission in chat mode", async () => {
      await seedMission(db, {
        status: "onboarding",
        onboardingMode: "chat",
      });

      const client = new FakeAiClient([
        FakeAiClient.textResponse(
          "Tell me more about what you'd like to learn."
        ),
      ]);
      mc = createMissionConversation({ store: new DrizzleMissionStore(db),
        ai: client,
        toolExecutor: executor,
        logger,
      });

      const result = await mc.run({
        missionId: 1,
        missionStatus: "onboarding",
        onboardingMode: "chat",
        userMessage: "I want to learn guitar",
      });

      expect(result.type).toBe("reply");
      if (result.type === "reply") {
        expect(result.text).toBe(
          "Tell me more about what you'd like to learn."
        );
      }
    });
  });

  describe("activation", () => {
    it("mark_mission_active triggers activation + title generation", async () => {
      await seedMission(db, {
        status: "onboarding",
        onboardingMode: "chat",
      });

      const client = new FakeAiClient([
        FakeAiClient.toolUseResponse("mark_mission_active"),
        FakeAiClient.textResponse("Mission is now active!"),
        FakeAiClient.textResponse("Learning Guitar"),
      ]);
      mc = createMissionConversation({ store: new DrizzleMissionStore(db),
        ai: client,
        toolExecutor: executor,
        logger,
      });

      const result = await mc.run({
        missionId: 1,
        missionStatus: "onboarding",
        onboardingMode: "chat",
        userMessage: "I want to learn guitar",
      });

      expect(result.type).toBe("activated");
      if (result.type === "activated") {
        expect(result.redirectUrl).toBe("/missions/1");
      }

      // Verify mission was activated in the database
      const mission = await getMission(db, 1);
      expect(mission.status).toBe("active");

      // Title should have been generated (was "Test Mission", now different)
      expect(mission.title).not.toBe("Test Mission");
    });
  });

  describe("messages persistence", () => {
    it("messages are persisted to DB", async () => {
      await seedMission(db, { status: "active" });

      const client = new FakeAiClient([
        FakeAiClient.textResponse("Sure, let's start learning!"),
      ]);
      mc = createMissionConversation({ store: new DrizzleMissionStore(db),
        ai: client,
        toolExecutor: executor,
        logger,
      });

      await mc.run({
        missionId: 1,
        missionStatus: "active",
        userMessage: "Teach me something",
      });

      const msgs = await getChatMessages(db, 1);
      expect(msgs.length).toBe(2);
      expect(msgs[0].role).toBe("user");
      expect(msgs[1].role).toBe("assistant");
    });
  });

  describe("error handling", () => {
    it("throws when AI call fails", async () => {
      await seedMission(db, { status: "active" });

      const client = new ThrowingAiClient();
      mc = createMissionConversation({ store: new DrizzleMissionStore(db),
        ai: client,
        toolExecutor: executor,
        logger,
      });

      await expect(
        mc.run({
          missionId: 1,
          missionStatus: "active",
          userMessage: "Hello",
        })
      ).rejects.toThrow();
    });
  });
});
