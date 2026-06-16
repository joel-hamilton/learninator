import { describe, it, expect, beforeEach } from "vitest"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema.js"
import { DrizzleMissionStore, InMemoryMissionStore } from "./store.js"
import type { MissionStore } from "./store.js"

function createTestDb() {
  const sqlite = new Database(":memory:")
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

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
    INSERT INTO missions (id, user_id, title, slug, status) VALUES (999, 1, 'Other Mission', 'other-mission', 'onboarding');
  `)

  return drizzle(sqlite, { schema })
}

function runTests(label: string, factory: () => MissionStore) {
  describe(label, () => {
    let store: MissionStore

    beforeEach(() => {
      store = factory()
    })

    // ── Mission Content ──

    it("readMissionContent returns null for missing content", async () => {
      expect(await store.readMissionContent(1, "mission")).toBeNull()
    })

    it("upsertMissionContent creates and reads back", async () => {
      await store.upsertMissionContent(1, "notes", "# Notes")
      expect(await store.readMissionContent(1, "notes")).toBe("# Notes")
    })

    it("upsertMissionContent overwrites existing", async () => {
      await store.upsertMissionContent(1, "notes", "# First")
      await store.upsertMissionContent(1, "notes", "# Updated")
      expect(await store.readMissionContent(1, "notes")).toBe("# Updated")
    })

    it("readMissionContent returns content for different content types", async () => {
      await store.upsertMissionContent(1, "mission", "# Mission")
      await store.upsertMissionContent(1, "resources", "# Resources")
      await store.upsertMissionContent(1, "glossary", "# Glossary")
      expect(await store.readMissionContent(1, "mission")).toBe("# Mission")
      expect(await store.readMissionContent(1, "resources")).toBe("# Resources")
      expect(await store.readMissionContent(1, "glossary")).toBe("# Glossary")
    })

    // ── Main Lessons ──

    it("getMainLessonCount returns 0 initially", async () => {
      expect(await store.getMainLessonCount(1)).toBe(0)
    })

    it("getMainLessonCount returns correct count after inserts", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" })
      await store.insertLesson({ missionId: 1, number: 2, title: "L2", slug: "l2", htmlContent: "<p>L2</p>" })
      expect(await store.getMainLessonCount(1)).toBe(2)
    })

    it("getMainLessonCount excludes sub-lessons", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 })
      expect(await store.getMainLessonCount(1)).toBe(1)
    })

    it("getMainLessonByNumber returns null for non-existent", async () => {
      expect(await store.getMainLessonByNumber(1, 999)).toBeNull()
    })

    it("getMainLessonByNumber returns id for existing main lesson", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" })
      const result = await store.getMainLessonByNumber(1, 1)
      expect(result).not.toBeNull()
      expect(result!.id).toBeGreaterThan(0)
    })

    it("getMainLessonByNumber does not return sub-lessons", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 })
      const result = await store.getMainLessonByNumber(1, 1)
      expect(result).not.toBeNull()
      // Should still find the main lesson, not the sub
      expect(result!.id).toBe(main!.id)
    })

    // ── Sub-lessons ──

    it("getMaxSubNumber returns null when no sub-lessons", async () => {
      const mainId = 999
      expect(await store.getMaxSubNumber(mainId)).toBeNull()
    })

    it("getMaxSubNumber returns correct max", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 })
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub2", slug: "sub2", htmlContent: "<p>Sub2</p>", parentLessonId: main!.id, subNumber: 2 })
      expect(await store.getMaxSubNumber(main!.id)).toBe(2)
    })

    // ── getLesson ──

    it("getLesson returns null for non-existent lesson", async () => {
      expect(await store.getLesson(1, 999)).toBeNull()
    })

    it("getLesson returns main lesson", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" })
      const lesson = await store.getLesson(1, 1)
      expect(lesson).not.toBeNull()
      expect(lesson!.number).toBe(1)
      expect(lesson!.subNumber).toBeNull()
      expect(lesson!.title).toBe("L1")
      expect(lesson!.htmlContent).toBe("<p>L1</p>")
    })

    it("getLesson with subNumber returns sub-lesson", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 })
      const lesson = await store.getLesson(1, 1, 1)
      expect(lesson).not.toBeNull()
      expect(lesson!.title).toBe("Sub1")
      expect(lesson!.subNumber).toBe(1)
    })

    it("getLesson without subNumber does not return sub-lesson", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub1", slug: "sub1", htmlContent: "<p>Sub1</p>", parentLessonId: main!.id, subNumber: 1 })
      // Without subNumber, should return the main lesson
      const lesson = await store.getLesson(1, 1)
      expect(lesson).not.toBeNull()
      expect(lesson!.title).toBe("Main")
      expect(lesson!.subNumber).toBeNull()
    })

    // ── listLessons ──

    it("listLessons returns empty array initially", async () => {
      expect(await store.listLessons(1)).toEqual([])
    })

    it("listLessons returns lessons in correct order", async () => {
      await store.insertLesson({ missionId: 1, number: 2, title: "L2", slug: "l2", htmlContent: "<p>L2</p>" })
      await store.insertLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" })
      const lessons = await store.listLessons(1)
      expect(lessons).toHaveLength(2)
      expect(lessons[0].number).toBe(1)
      expect(lessons[0].title).toBe("L1")
      expect(lessons[1].number).toBe(2)
      expect(lessons[1].title).toBe("L2")
    })

    it("listLessons includes sub-lessons interleaved", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "Main", slug: "main", htmlContent: "<p>Main</p>" })
      const main = await store.getMainLessonByNumber(1, 1)
      await store.insertLesson({ missionId: 1, number: 1, title: "Sub", slug: "sub", htmlContent: "<p>Sub</p>", parentLessonId: main!.id, subNumber: 1 })
      const lessons = await store.listLessons(1)
      expect(lessons).toHaveLength(2)
      expect(lessons[0].subNumber).toBeNull()
      expect(lessons[1].subNumber).toBe(1)
    })

    it("listLessons returns correct keys in summary", async () => {
      await store.insertLesson({ missionId: 1, number: 1, title: "L1", slug: "l1", htmlContent: "<p>L1</p>" })
      const lesson = (await store.listLessons(1))[0]
      expect(lesson).toHaveProperty("number")
      expect(lesson).toHaveProperty("subNumber")
      expect(lesson).toHaveProperty("title")
      expect(lesson).toHaveProperty("slug")
      expect(lesson).toHaveProperty("status")
      expect(lesson).toHaveProperty("createdAt")
      expect(lesson).not.toHaveProperty("htmlContent")
    })

    // ── Reference Docs ──

    it("insertReferenceDoc and listReferenceDocs work", async () => {
      await store.insertReferenceDoc({ missionId: 1, title: "Ref", slug: "ref", htmlContent: "<p>Ref</p>", docType: "cheatsheet" })
      const docs = await store.listReferenceDocs(1)
      expect(docs).toHaveLength(1)
      expect(docs[0].title).toBe("Ref")
      expect(docs[0].slug).toBe("ref")
      expect(docs[0].docType).toBe("cheatsheet")
    })

    it("listReferenceDocs returns only docs for the given mission", async () => {
      await store.insertReferenceDoc({ missionId: 1, title: "Ref1", slug: "ref1", htmlContent: "<p>Ref1</p>", docType: "other" })
      await store.insertReferenceDoc({ missionId: 999, title: "Ref2", slug: "ref2", htmlContent: "<p>Ref2</p>", docType: "other" })
      const docs = await store.listReferenceDocs(1)
      expect(docs).toHaveLength(1)
      expect(docs[0].title).toBe("Ref1")
    })

    // ── Learning Records ──

    it("getLearningRecordCount returns 0 initially", async () => {
      expect(await store.getLearningRecordCount(1)).toBe(0)
    })

    it("getLearningRecordCount returns correct count", async () => {
      await store.insertLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" })
      await store.insertLearningRecord({ missionId: 1, number: 2, title: "LR2", markdownContent: "Content" })
      expect(await store.getLearningRecordCount(1)).toBe(2)
    })

    it("insert and list learning records", async () => {
      await store.insertLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content 1" })
      await store.insertLearningRecord({ missionId: 1, number: 2, title: "LR2", markdownContent: "Content 2" })
      const records = await store.listLearningRecords(1)
      expect(records).toHaveLength(2)
      expect(records[0].number).toBe(1)
      expect(records[0].title).toBe("LR1")
      expect(records[1].number).toBe(2)
    })

    it("updateLearningRecord updates status and supersededBy", async () => {
      await store.insertLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" })
      await store.updateLearningRecord(1, 1, { status: "superseded", supersededBy: 2 })
      const records = await store.listLearningRecords(1)
      expect(records[0].status).toBe("superseded")
      expect(records[0].supersededBy).toBe(2)
    })

    it("updateLearningRecord updates status only (no supersededBy)", async () => {
      await store.insertLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" })
      await store.updateLearningRecord(1, 1, { status: "superseded" })
      const records = await store.listLearningRecords(1)
      expect(records[0].status).toBe("superseded")
    })

    it("listLearningRecords returns correct keys", async () => {
      await store.insertLearningRecord({ missionId: 1, number: 1, title: "LR1", markdownContent: "Content" })
      const record = (await store.listLearningRecords(1))[0]
      expect(record).toHaveProperty("number")
      expect(record).toHaveProperty("title")
      expect(record).toHaveProperty("status")
      expect(record).toHaveProperty("supersededBy")
      expect(record).toHaveProperty("createdAt")
    })

    // ── Guided Questions ──

    it("insertGuidedQuestion stores question", async () => {
      await store.insertGuidedQuestion({ missionId: 1, question: "What?", options: JSON.stringify(["A", "B"]) })
      // Method should not throw
    })

    // ── Mission Status ──

    it("updateMissionStatus does not throw", async () => {
      await store.updateMissionStatus(1, "active")
    })
  })
}

// ── Test both implementations ──

describe("MissionStore implementations", () => {
  runTests("DrizzleMissionStore", () => new DrizzleMissionStore(createTestDb()))
  runTests("InMemoryMissionStore", () => new InMemoryMissionStore())
})
