import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleMissionStore, InMemoryLearningRecordStore } from "../store.js";
import type { LearningRecordStore } from "../store.js";

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
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'onboarding');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => LearningRecordStore) {
  describe(label, () => {
    let store: LearningRecordStore;

    beforeEach(() => {
      store = factory();
    });

    it("getLearningRecordCount returns 0 initially", async () => {
      expect(await store.getLearningRecordCount(1)).toBe(0);
    });

    it("getLearningRecordCount returns correct count", async () => {
      await store.createLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" });
      await store.createLearningRecord({ missionId: 1, number: 2, title: "LR2", markdownContent: "Content" });
      expect(await store.getLearningRecordCount(1)).toBe(2);
    });

    it("create and list learning records", async () => {
      await store.createLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content 1" });
      await store.createLearningRecord({ missionId: 1, number: 2, title: "LR2", markdownContent: "Content 2" });
      const records = await store.listLearningRecords(1);
      expect(records).toHaveLength(2);
      expect(records[0].number).toBe(1);
      expect(records[0].title).toBe("LR1");
      expect(records[1].number).toBe(2);
    });

    it("updateLearningRecord updates status and supersededBy", async () => {
      const created = await store.createLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" });
      await store.updateLearningRecord(created.id, { status: "superseded", supersededBy: 2 });
      const records = await store.listLearningRecords(1);
      expect(records[0].status).toBe("superseded");
      expect(records[0].supersededBy).toBe(2);
    });

    it("updateLearningRecord updates status only (no supersededBy)", async () => {
      const created = await store.createLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" });
      await store.updateLearningRecord(created.id, { status: "superseded" });
      const records = await store.listLearningRecords(1);
      expect(records[0].status).toBe("superseded");
    });

    it("listLearningRecords returns correct keys", async () => {
      await store.createLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" });
      const record = (await store.listLearningRecords(1))[0];
      expect(record).toHaveProperty("number");
      expect(record).toHaveProperty("title");
      expect(record).toHaveProperty("status");
      expect(record).toHaveProperty("supersededBy");
      expect(record).toHaveProperty("createdAt");
    });
  });
}

describe("LearningRecordStore implementations", () => {
  runTests("DrizzleMissionStore (learning record methods)", () => new DrizzleMissionStore(createTestDb()));
  runTests("InMemoryLearningRecordStore", () => new InMemoryLearningRecordStore());
});
