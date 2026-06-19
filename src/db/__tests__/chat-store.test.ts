import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleMissionStore, InMemoryChatStore } from "../store.js";
import type { ChatStore } from "../store.js";

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
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'onboarding');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => ChatStore) {
  describe(label, () => {
    let store: ChatStore;

    beforeEach(() => {
      store = factory();
    });

    it("createGuidedQuestion stores question", async () => {
      await store.createGuidedQuestion({ missionId: 1, question: "What?", options: JSON.stringify(["A", "B"]) });
      // Method should not throw
    });

    it("saveChatMessage and getChatMessages work", async () => {
      await store.saveChatMessage({ missionId: 1, role: "user", content: "Hello" });
      await store.saveChatMessage({ missionId: 1, role: "assistant", content: "Hi there" });
      const messages = await store.getChatMessages(1);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });

    it("getPendingQuestion returns undefined when no questions", async () => {
      expect(await store.getPendingQuestion(1)).toBeUndefined();
    });

    it("createGuidedQuestion and getPendingQuestion work", async () => {
      await store.createGuidedQuestion({ missionId: 1, question: "What?", options: JSON.stringify(["A", "B"]) });
      const q = await store.getPendingQuestion(1);
      expect(q).not.toBeNull();
      expect(q!.question).toBe("What?");
    });

    it("answerQuestion updates status", async () => {
      const q = await store.createGuidedQuestion({ missionId: 1, question: "What?", options: JSON.stringify(["A", "B"]) });
      await store.answerQuestion(q.id, "A", "Option A");
      const pending = await store.getPendingQuestion(1);
      expect(pending).toBeUndefined();
    });

    it("skipPendingQuestions skips all pending", async () => {
      await store.createGuidedQuestion({ missionId: 1, question: "Q1", options: JSON.stringify(["A", "B"]) });
      await store.createGuidedQuestion({ missionId: 1, question: "Q2", options: JSON.stringify(["C", "D"]) });
      await store.skipPendingQuestions(1);
      const pending = await store.getPendingQuestion(1);
      expect(pending).toBeUndefined();
    });
  });
}

describe("ChatStore implementations", () => {
  runTests("DrizzleMissionStore (chat methods)", () => new DrizzleMissionStore(createTestDb()));
  runTests("InMemoryChatStore", () => new InMemoryChatStore());
});
