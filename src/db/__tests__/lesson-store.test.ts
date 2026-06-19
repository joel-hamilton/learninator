import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import { DrizzleLessonAdapter } from "../adapters/index.js";
import { InMemoryLessonStore } from "../store.js";
import type { LessonStore } from "../store.js";

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
    INSERT INTO users (id, email, password_hash, name) VALUES (1, 'test@test.com', 'hash', 'Test User');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (1, 1, 'Test Mission', 'test-mission', 'onboarding');
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (999, 1, 'Other Mission', 'other-mission', 'onboarding');
  `);
  return drizzle(sqlite, { schema });
}

function runTests(label: string, factory: () => LessonStore) {
  describe(label, () => {
    let store: LessonStore;

    beforeEach(() => {
      store = factory();
    });

    // Main Lessons
    it("getMainLessonCount returns 0 initially", async () => {
      expect(await store.getMainLessonCount(1)).toBe(0);
    });

    it("getMainLessonCount returns correct count after inserts", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" });
      await store.createLesson({ missionId: 1, number: 2, title: "L2", slug: "l2", htmlContent: "<p>L2</p>" });
      expect(await store.getMainLessonCount(1)).toBe(2);
    });

    it("getMainLessonCount excludes sub-lessons", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 });
      expect(await store.getMainLessonCount(1)).toBe(1);
    });

    it("getLesson returns null for non-existent lesson", async () => {
      const result = await store.getLesson(1, 999);
      expect(result).toBeUndefined();
    });

    it("getLesson returns null for non-existent main lesson by number", async () => {
      expect(await store.getLesson(1, 999, null)).toBeUndefined();
    });

    it("getLesson returns main lesson by number", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" });
      const result = await store.getLesson(1, 1, null);
      expect(result).not.toBeNull();
      expect(result!.id).toBeGreaterThan(0);
    });

    it("getLesson returns main lesson", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" });
      const lesson = await store.getLesson(1, 1);
      expect(lesson).not.toBeNull();
      expect(lesson!.number).toBe(1);
      expect(lesson!.subNumber).toBeNull();
      expect(lesson!.title).toBe("L1");
      expect(lesson!.htmlContent).toBe("<p>L1</p>");
    });

    it("getLesson does not return sub-lesson when requesting main", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 });
      const result = await store.getLesson(1, 1, null);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(main!.id);
    });

    it("getLesson with subNumber returns sub-lesson", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 });
      const lesson = await store.getLesson(1, 1, 1);
      expect(lesson).not.toBeNull();
      expect(lesson!.title).toBe("Sub1");
      expect(lesson!.subNumber).toBe(1);
    });

    it("getLesson without subNumber does not return sub-lesson", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 });
      const lesson = await store.getLesson(1, 1);
      expect(lesson).not.toBeNull();
      expect(lesson!.title).toBe("Main");
      expect(lesson!.subNumber).toBeNull();
    });

    // Sub-lessons
    it("getMaxSubNumber returns null when no sub-lessons", async () => {
      expect(await store.getMaxSubNumber(999)).toBeNull();
    });

    it("getMaxSubNumber returns correct max", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 });
      await store.createLesson({ missionId: 1, number: 1, title: "Sub2", slug: "sub2", htmlContent: "<p>Sub2</p>", parentLessonId: main!.id, subNumber: 2 });
      expect(await store.getMaxSubNumber(main!.id)).toBe(2);
    });

    // listLessons
    it("listLessons returns empty array initially", async () => {
      expect(await store.listLessons(1)).toEqual([]);
    });

    it("listLessons returns lessons in correct order", async () => {
      await store.createLesson({ missionId: 1, number: 2, title: "L2", slug: "l2", htmlContent: "<p>L2</p>" });
      await store.createLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" });
      const lessons = await store.listLessons(1);
      expect(lessons).toHaveLength(2);
      expect(lessons[0].number).toBe(1);
      expect(lessons[0].title).toBe("L1");
      expect(lessons[1].number).toBe(2);
      expect(lessons[1].title).toBe("L2");
    });

    it("listLessons includes sub-lessons interleaved", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 });
      const lessons = await store.listLessons(1);
      expect(lessons).toHaveLength(2);
      expect(lessons[0].subNumber).toBeNull();
      expect(lessons[1].subNumber).toBe(1);
    });

    it("listLessons returns correct keys", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" });
      const lesson = (await store.listLessons(1))[0];
      expect(lesson).toHaveProperty("number");
      expect(lesson).toHaveProperty("subNumber");
      expect(lesson).toHaveProperty("title");
      expect(lesson).toHaveProperty("slug");
      expect(lesson).toHaveProperty("status");
      expect(lesson).toHaveProperty("createdAt");
      expect(lesson).toHaveProperty("htmlContent");
    });

    it("getMainLessonCount excludes sub-lessons", async () => {
      await store.createLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" });
      const main = await store.getLesson(1, 1, null);
      await store.createLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 });
      expect(await store.getMainLessonCount(1)).toBe(1);
    });
  });
}

describe("LessonStore implementations", () => {
  runTests("DrizzleLessonAdapter", () => new DrizzleLessonAdapter(createTestDb()));
  runTests("InMemoryLessonStore", () => new InMemoryLessonStore());
});
