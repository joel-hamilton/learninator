import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleMissionStore, InMemoryUserStore } from "../store.js";
import type { UserStore } from "../store.js";

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
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => UserStore) {
  describe(label, () => {
    let store: UserStore;

    beforeEach(() => {
      store = factory();
    });

    it("getUser returns undefined for non-existent", async () => {
      expect(await store.getUser(999)).toBeUndefined();
    });

    it("getUserByEmail returns undefined for unknown email", async () => {
      expect(await store.getUserByEmail("nope@test.com")).toBeUndefined();
    });

    it("createUser and getUser work together", async () => {
      const created = await store.createUser({ email: "new@test.com", passwordHash: "hash2", name: "New" });
      expect(created.id).toBeGreaterThan(0);
      expect(created.email).toBe("new@test.com");
      const found = await store.getUser(created.id);
      expect(found).not.toBeUndefined();
      expect(found!.name).toBe("New");
    });

    it("getUserByEmail finds by email", async () => {
      const created = await store.createUser({ email: "findme@test.com", passwordHash: "hash", name: "FindMe" });
      const found = await store.getUserByEmail("findme@test.com");
      expect(found).not.toBeUndefined();
      expect(found!.id).toBe(created.id);
    });

    it("updateUser updates fields", async () => {
      const created = await store.createUser({ email: "update@test.com", passwordHash: "hash", name: "Original" });
      await store.updateUser(created.id, { name: "Updated Name" });
      const user = await store.getUser(created.id);
      expect(user!.name).toBe("Updated Name");
    });
  });
}

describe("UserStore implementations", () => {
  runTests("DrizzleMissionStore (user methods)", () => new DrizzleMissionStore(createTestDb()));
  runTests("InMemoryUserStore", () => new InMemoryUserStore());
});
