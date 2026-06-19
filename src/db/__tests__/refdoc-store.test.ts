import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleMissionStore, InMemoryRefDocStore } from "../store.js";
import type { RefDocStore } from "../store.js";

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
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'onboarding');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (999, 1, 'Other Mission', 'other-mission', 'onboarding');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => RefDocStore) {
  describe(label, () => {
    let store: RefDocStore;

    beforeEach(() => {
      store = factory();
    });

    it("createReferenceDoc and listReferenceDocs work", async () => {
      await store.createReferenceDoc({ missionId: 1, title: "Ref", slug: "ref", htmlContent: "<p>Ref</p>", docType: "cheatsheet" });
      const docs = await store.listReferenceDocs(1);
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Ref");
      expect(docs[0].slug).toBe("ref");
      expect(docs[0].docType).toBe("cheatsheet");
    });

    it("listReferenceDocs returns only docs for the given mission", async () => {
      await store.createReferenceDoc({ missionId: 1, title: "Ref1", slug: "ref1", htmlContent: "<p>Ref1</p>", docType: "other" });
      await store.createReferenceDoc({ missionId: 999, title: "Ref2", slug: "ref2", htmlContent: "<p>Ref2</p>", docType: "other" });
      const docs = await store.listReferenceDocs(1);
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Ref1");
    });
  });
}

describe("RefDocStore implementations", () => {
  runTests("DrizzleMissionStore (refdoc methods)", () => new DrizzleMissionStore(createTestDb()));
  runTests("InMemoryRefDocStore", () => new InMemoryRefDocStore());
});
