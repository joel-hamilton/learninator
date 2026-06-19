import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleMissionStore, InMemoryContentStore } from "../store.js";
import type { ContentStore } from "../store.js";

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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (mission_id, content_type)
    );
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'onboarding');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => ContentStore) {
  describe(label, () => {
    let store: ContentStore;

    beforeEach(() => {
      store = factory();
    });

    it("getMissionContent returns undefined for missing content", async () => {
      expect(await store.getMissionContent(1, "mission")).toBeUndefined();
    });

    it("upsertMissionContent creates and reads back", async () => {
      await store.upsertMissionContent({ missionId: 1, contentType: "notes", markdownContent: "# Notes" });
      const row = await store.getMissionContent(1, "notes");
      expect(row!.markdownContent).toBe("# Notes");
    });

    it("upsertMissionContent overwrites existing", async () => {
      await store.upsertMissionContent({ missionId: 1, contentType: "notes", markdownContent: "# First" });
      await store.upsertMissionContent({ missionId: 1, contentType: "notes", markdownContent: "# Updated" });
      const row = await store.getMissionContent(1, "notes");
      expect(row!.markdownContent).toBe("# Updated");
    });

    it("getMissionContent returns content for different content types", async () => {
      await store.upsertMissionContent({ missionId: 1, contentType: "mission", markdownContent: "# Mission" });
      await store.upsertMissionContent({ missionId: 1, contentType: "resources", markdownContent: "# Resources" });
      await store.upsertMissionContent({ missionId: 1, contentType: "glossary", markdownContent: "# Glossary" });
      expect((await store.getMissionContent(1, "mission"))!.markdownContent).toBe("# Mission");
      expect((await store.getMissionContent(1, "resources"))!.markdownContent).toBe("# Resources");
      expect((await store.getMissionContent(1, "glossary"))!.markdownContent).toBe("# Glossary");
    });
  });
}

describe("ContentStore implementations", () => {
  runTests("DrizzleMissionStore (content methods)", () => new DrizzleMissionStore(createTestDb()));
  runTests("InMemoryContentStore", () => new InMemoryContentStore());
});
