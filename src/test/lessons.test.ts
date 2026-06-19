import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/index.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { parseLessonParam } from "../shared/lesson-numbers.js";

describe("parseLessonParam", () => {
  it.each([
    ["1",         1,   null],
    ["1.2",       1,   2],
    ["42",        42,  null],
    ["42.7",      42,  7],
    ["",          NaN, null],
    [".",         NaN, NaN],
    ["1.2.3",     1,   2],
    ["abc",       NaN, null],
    ["1.",        1,   NaN],
    [".1",        NaN, 1],
  ] as const)("parseLessonParam(%j) -> { number: %s, subNumber: %s }", (input, expectedNumber, expectedSub) => {
    const result = parseLessonParam(input);
    if (typeof expectedNumber === "number" && isNaN(expectedNumber)) {
      expect(isNaN(result.number)).toBe(true);
    } else {
      expect(result.number).toBe(expectedNumber);
    }
    if (expectedSub === null) {
      expect(result.subNumber).toBeNull();
    } else if (typeof expectedSub === "number" && isNaN(expectedSub)) {
      expect(result.subNumber).not.toBeNull();
      expect(isNaN(result.subNumber!)).toBe(true);
    } else {
      expect(result.subNumber).toBe(expectedSub);
    }
  });
});

describe("lessons", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let lr: any;
  let missionId: number;
  let lessonId: number;

  beforeEach(async () => {
    db = createTestDb();
    app = createTestApp(new FakeAiClient([]), db);
    await seedUser(db, "user@test.com", "password123");
    lr = await login(app, "user@test.com", "password123");

    const [mission] = await db
      .insert(schema.missions)
      .values({
        userId: 1,
        title: "Test Mission",
        slug: "test-mission",
        status: "active",
      })
      .returning();
    missionId = mission.id;

    const [lesson] = await db
      .insert(schema.lessons)
      .values({
        missionId,
        number: 1,
        title: "Lesson 1",
        slug: "lesson-1",
        htmlContent: "<p>Hello world</p>",
        status: "active",
      })
      .returning();
    lessonId = lesson.id;
  });

  it("GET /missions/:id/lessons/1 shows lesson and marks in_progress", async () => {
    const res = await authedReq(
      app,
      lr,
      "GET",
      `/missions/${missionId}/lessons/1`,
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Lesson 1");

    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);
    expect(lesson.status).toBe("in_progress");
  });

  it("POST /missions/:id/lessons/1/complete marks lesson completed", async () => {
    const res = await authedReq(
      app,
      lr,
      "POST",
      `/missions/${missionId}/lessons/1/complete`,
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("completed");

    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);
    expect(lesson.status).toBe("completed");
  });

  it("POST /missions/:id/lessons/1/incomplete marks lesson in_progress", async () => {
    // Set to completed first
    await db
      .update(schema.lessons)
      .set({ status: "completed" })
      .where(eq(schema.lessons.id, lessonId));

    const res = await authedReq(
      app,
      lr,
      "POST",
      `/missions/${missionId}/lessons/1/incomplete`,
    );
    expect(res.status).toBe(200);

    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);
    expect(lesson.status).toBe("in_progress");
  });

  it("POST /missions/:id/lessons/1/feedback saves rating", async () => {
    const res = await authedReq(
      app,
      lr,
      "POST",
      `/missions/${missionId}/lessons/1/feedback`,
      { rating: "just_right", feedbackText: "Great lesson!" },
    );
    expect(res.status).toBe(200);

    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, lessonId))
      .limit(1);
    expect(lesson.feedbackRating).toBe("just_right");
    expect(lesson.feedbackText).toBe("Great lesson!");
  });
});
