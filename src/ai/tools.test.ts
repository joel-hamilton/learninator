import { describe, it, expect, beforeAll } from "vitest"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "../db/schema.js"
import { createToolExecutor } from "./tools.js"
import type { AiToolUseBlock } from "./types.js"

describe("tool handlers", () => {
  let executor: ReturnType<typeof createToolExecutor>

  beforeAll(() => {
    const sqlite = new Database(":memory:")
    sqlite.pragma("journal_mode = WAL")
    sqlite.pragma("foreign_keys = ON")

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
        parent_lesson_id INTEGER REFERENCES lessons(id),
        sub_number INTEGER,
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
    `)

    // Seed a user and mission for FK constraints
    sqlite.exec(
      "INSERT INTO users (id, email, password_hash) VALUES (1, 'test@test.com', 'hash');"
    )
    sqlite.exec(
      "INSERT INTO missions (id, user_id, title, slug) VALUES (1, 1, 'Test', 'test');"
    )

    const testDb = drizzle(sqlite, { schema })
    executor = createToolExecutor(testDb)
  })

  it("read_mission_content returns empty for missing content", async () => {
    const result = await executor.executeTool(1, "read_mission_content", {
      content_type: "mission",
    })
    expect(result).toBe("(empty)")
  })

  it("write_mission_content creates and read_mission_content reads back", async () => {
    await executor.executeTool(1, "write_mission_content", {
      content_type: "notes",
      markdown_content: "# Test Notes",
    })

    const result = await executor.executeTool(1, "read_mission_content", {
      content_type: "notes",
    })
    expect(result).toBe("# Test Notes")
  })

  it("unknown tool returns fallback", async () => {
    const result = await executor.executeTool(1, "nonexistent", {})
    expect(result).toBe("Unknown tool: nonexistent")
  })

  it("executeToolCalls processes multiple blocks", async () => {
    const results = await executor.executeToolCalls(1, [
      {
        type: "tool_use",
        id: "tu_1",
        name: "read_mission_content",
        input: { content_type: "mission" },
      } as AiToolUseBlock,
      {
        type: "tool_use",
        id: "tu_2",
        name: "list_lessons",
        input: {},
      } as AiToolUseBlock,
    ])
    expect(results).toHaveLength(2)
    expect(results[0].tool_use_id).toBe("tu_1")
    expect(results[1].tool_use_id).toBe("tu_2")
  })

  it("creates a lesson with auto-incremented number", async () => {
    const result = await executor.executeTool(1, "create_lesson", {
      title: "First Lesson",
      slug: "first-lesson",
      html_content: "<p>Hello</p>",
    })
    expect(result).toContain('Created lesson 0001: "First Lesson"')
  })

  it("reads a created lesson", async () => {
    const result = await executor.executeTool(1, "read_lesson", {
      number: 1,
    })
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe("First Lesson")
    expect(parsed.slug).toBe("first-lesson")
    expect(parsed.html_content).toBe("<p>Hello</p>")
    expect(parsed.sub_number).toBeNull()
  })

  it("list_lessons returns created lessons", async () => {
    const result = await executor.executeTool(1, "list_lessons", {})
    const parsed = JSON.parse(result)
    expect(parsed.length).toBe(1)
    expect(parsed[0].title).toBe("First Lesson")
  })

  // ── Sub-lesson tests ──

  it("create_sub_lesson creates a sub-lesson under a main lesson", async () => {
    const result = await executor.executeTool(1, "create_sub_lesson", {
      parent_lesson_number: 1,
      title: "Deeper Dive",
      slug: "deeper-dive",
      html_content: "<p>More depth</p>",
    })
    expect(result).toContain('Created sub-lesson 0001.1: "Deeper Dive"')
  })

  it("create_sub_lesson auto-increments sub_number", async () => {
    const result = await executor.executeTool(1, "create_sub_lesson", {
      parent_lesson_number: 1,
      title: "Even Deeper",
      slug: "even-deeper",
      html_content: "<p>Even more depth</p>",
    })
    expect(result).toContain('Created sub-lesson 0001.2: "Even Deeper"')
  })

  it("create_sub_lesson fails for non-existent parent", async () => {
    const result = await executor.executeTool(1, "create_sub_lesson", {
      parent_lesson_number: 999,
      title: "Orphan",
      slug: "orphan",
      html_content: "<p>no parent</p>",
    })
    expect(result).toBe("Parent lesson 999 not found.")
  })

  it("create_sub_lesson always creates under main lesson (even when number matches sub-lessons)", async () => {
    // Passing parent_lesson_number: 1 still finds the main lesson 0001
    // (the handler checks isNull(parentLessonId) on the parent)
    const result = await executor.executeTool(1, "create_sub_lesson", {
      parent_lesson_number: 1,
      title: "Another Sub",
      slug: "another-sub",
      html_content: "<p>sub 3</p>",
    })
    expect(result).toContain("Created sub-lesson 0001.3")
  })

  it("read_lesson with sub_number returns sub-lesson", async () => {
    const result = await executor.executeTool(1, "read_lesson", {
      number: 1,
      sub_number: 1,
    })
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe("Deeper Dive")
    expect(parsed.sub_number).toBe(1)
  })

  it("read_lesson without sub_number returns main lesson only", async () => {
    const result = await executor.executeTool(1, "read_lesson", {
      number: 1,
    })
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe("First Lesson")
    expect(parsed.sub_number).toBeNull()
  })

  it("list_lessons returns lessons in correct order (main first, then subs)", async () => {
    const result = await executor.executeTool(1, "list_lessons", {})
    const parsed = JSON.parse(result)
    expect(parsed.length).toBe(4)
    // 0001 main, 0001.1 sub, 0001.2 sub, 0001.3 sub
    expect(parsed[0].number).toBe(1)
    expect(parsed[0].subNumber).toBeNull()
    expect(parsed[0].title).toBe("First Lesson")
    expect(parsed[1].number).toBe(1)
    expect(parsed[1].subNumber).toBe(1)
    expect(parsed[2].number).toBe(1)
    expect(parsed[2].subNumber).toBe(2)
    expect(parsed[3].number).toBe(1)
    expect(parsed[3].subNumber).toBe(3)
  })

  it("create_lesson counts only main lessons for numbering", async () => {
    // Currently: main lesson 0001, sub-lessons 0001.1 and 0001.2
    // So count of main lessons = 1, next should be 0002
    const result = await executor.executeTool(1, "create_lesson", {
      title: "Second Lesson",
      slug: "second-lesson",
      html_content: "<p>Second</p>",
    })
    expect(result).toContain('Created lesson 0002: "Second Lesson"')
  })

  it("list_lessons orders main lessons and sub-lessons interleaved correctly", async () => {
    // Now: 0001, 0001.1, 0001.2, 0001.3, 0002
    const result = await executor.executeTool(1, "list_lessons", {})
    const parsed = JSON.parse(result)
    expect(parsed.length).toBe(5)
    expect([parsed[0].number, parsed[0].subNumber]).toEqual([1, null])
    expect([parsed[1].number, parsed[1].subNumber]).toEqual([1, 1])
    expect([parsed[2].number, parsed[2].subNumber]).toEqual([1, 2])
    expect([parsed[3].number, parsed[3].subNumber]).toEqual([1, 3])
    expect([parsed[4].number, parsed[4].subNumber]).toEqual([2, null])
  })

  // ── Existing tests (unchanged expectations) ──

  it("mark_mission_active updates mission status", async () => {
    const result = await executor.executeTool(1, "mark_mission_active", {})
    expect(result).toBe("Mission is now active. You can begin creating lessons.")
  })

  it("create_learning_record and list_learning_records work", async () => {
    const createResult = await executor.executeTool(1, "create_learning_record", {
      title: "Key Insight",
      markdown_content: "This is an important thing I learned.",
    })
    expect(createResult).toContain('Created learning record LR0001: "Key Insight"')

    const listResult = await executor.executeTool(1, "list_learning_records", {})
    const parsed = JSON.parse(listResult)
    expect(parsed.length).toBe(1)
    expect(parsed[0].title).toBe("Key Insight")
  })

  it("update_learning_record changes status", async () => {
    const result = await executor.executeTool(1, "update_learning_record", {
      number: 1,
      status: "superseded",
      superseded_by: 2,
    })
    expect(result).toBe("Updated learning record LR0001 status to superseded.")
  })

  it("create_reference_doc and list_reference_docs work", async () => {
    const createResult = await executor.executeTool(1, "create_reference_doc", {
      title: "Cheatsheet",
      slug: "cheatsheet",
      html_content: "<p>ref</p>",
      doc_type: "cheatsheet",
    })
    expect(createResult).toContain('Created reference doc: "Cheatsheet"')

    const listResult = await executor.executeTool(1, "list_reference_docs", {})
    const parsed = JSON.parse(listResult)
    expect(parsed.length).toBe(1)
    expect(parsed[0].title).toBe("Cheatsheet")
  })

  it("read_lesson for non-existent lesson returns not found", async () => {
    const result = await executor.executeTool(1, "read_lesson", {
      number: 999,
    })
    expect(result).toBe("Lesson not found.")
  })

  it("handles tool execution errors gracefully with invalid input", async () => {
    const result = await executor.executeTool(1, "read_lesson", {
      number: "not-a-number",
    })
    // Drizzle/better-sqlite3 coerces the type, so the query just finds no match
    expect(result).toBe("Lesson not found.")
  })
})
