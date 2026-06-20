import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/index.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { LoginResult } from "./helpers.js";
import { parseLessonParam } from "../shared/lesson-numbers.js";
import { buildJobKey } from "../lessons/generator.js";

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

// ── Helpers for generation + review tests ──────────────────────────

const DRAFT_HTML = "<html><head></head><body><h1>Lesson 2</h1><p>Hello world</p></body></html>";
const CORRECTED_HTML = "<html><head></head><body><h1>Lesson 2</h1><p>Hello world!</p></body></html>";
const BROKEN_HTML = "<html><head></head><body><h2>Title</h2><h4>Sub</h4><table><tr><td>Cell</tr></table></body></html>";
const FIXED_HTML = "<html><head></head><body><h2>Title</h2><h3>Sub</h3><table><tr><td>Cell</td></tr></table></body></html>";

async function pollForDone(
  app: ReturnType<typeof createTestApp>,
  lr: LoginResult,
  path: string,
  maxAttempts = 20,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await authedReq(app, lr, "GET", path);
    const text = await res.text();
    if (text.includes("Lesson") && !text.includes("Working") && !text.includes("Reviewing")) {
      return text;
    }
    if (!text.includes("htmx") && text.length > 10) return text;
    await new Promise((r) => setTimeout(r, 10));
  }
  return "";
}

describe("lesson generation with QA review", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let lr: LoginResult;
  let missionId: number;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "user@test.com", "password123");
    const app = createTestApp(new FakeAiClient([]), db);
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

    await db.insert(schema.lessons).values({
      missionId,
      number: 1,
      title: "Lesson 1",
      slug: "lesson-1",
      htmlContent: "<p>Hello world</p>",
      status: "completed",
    });
  });

  // T008 — reviewer corrects factual errors
  it("reviewer corrects errors in generated lesson", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_lesson", {
        title: "Lesson 2",
        slug: "lesson-2",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Lesson created successfully."),
      FakeAiClient.textResponse(CORRECTED_HTML),
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-next`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-next/status`);

    const latest = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const lesson2 = latest.find((l) => l.number === 2 && l.subNumber === null);
    expect(lesson2).toBeDefined();
    expect(lesson2!.htmlContent).toBe(CORRECTED_HTML);
    expect(lesson2!.htmlContent).not.toBe(DRAFT_HTML);
  });

  // T009 — reviewer passes through unchanged content
  it("reviewer passes through unchanged lesson content", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_lesson", {
        title: "Lesson 2",
        slug: "lesson-2",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Lesson created."),
      FakeAiClient.textResponse(DRAFT_HTML), // reviewer returns identical HTML
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-next`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-next/status`);

    const latest = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const lesson2 = latest.find((l) => l.number === 2 && l.subNumber === null);
    expect(lesson2).toBeDefined();
    expect(lesson2!.htmlContent).toBe(DRAFT_HTML);
  });

  // T010 — reviewer failure falls back to original
  it("reviewer failure falls back to original lesson", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_lesson", {
        title: "Lesson 2",
        slug: "lesson-2",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Lesson created."),
      FakeAiClient.textResponse(""), // reviewer returns empty string (failure)
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-next`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-next/status`);

    const latest = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const lesson2 = latest.find((l) => l.number === 2 && l.subNumber === null);
    expect(lesson2).toBeDefined();
    expect(lesson2!.htmlContent).toBe(DRAFT_HTML); // original delivered
  });

  // T011 — reviewer fixes HTML formatting
  it("reviewer fixes broken HTML formatting", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_lesson", {
        title: "Lesson 2",
        slug: "lesson-2",
        html_content: BROKEN_HTML,
      }),
      FakeAiClient.textResponse("Lesson created."),
      FakeAiClient.textResponse(FIXED_HTML),
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-next`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-next/status`);

    const latest = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const lesson2 = latest.find((l) => l.number === 2 && l.subNumber === null);
    expect(lesson2).toBeDefined();
    expect(lesson2!.htmlContent).toBe(FIXED_HTML);
    expect(lesson2!.htmlContent).toContain("<h3>Sub</h3>"); // heading level fixed
    expect(lesson2!.htmlContent).toContain("</td>"); // missing closing tag fixed
  });

  // T012 — review runs for sub-lesson generation
  it("review step runs for sub-lesson generation", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_sub_lesson", {
        parent_lesson_number: 1,
        title: "Deeper Dive",
        slug: "deeper-dive",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Sub-lesson created."),
      FakeAiClient.textResponse(CORRECTED_HTML),
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-sub-lesson`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-sub-lesson/status`);

    const sub = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const subLesson = sub.find((l) => l.number === 1 && l.subNumber === 1);
    expect(subLesson).toBeDefined();
    expect(subLesson!.htmlContent).toBe(CORRECTED_HTML);
  });

  // T013 — review runs for regeneration
  it("review step runs for regeneration", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("regenerate_lesson", {
        number: 1,
        title: "Lesson 1 v2",
        slug: "lesson-1-v2",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Lesson regenerated."),
      FakeAiClient.textResponse(CORRECTED_HTML),
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/regenerate`, {
      direction: "harder",
    });
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/regenerate/status`);

    const [lesson] = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.id, 1))
      .limit(1);
    expect(lesson).toBeDefined();
    expect(lesson!.htmlContent).toBe(CORRECTED_HTML);
  });

  // T014 — review runs for bridging sub-lesson
  it("review step runs for bridging sub-lesson", async () => {
    const fakeAi = new FakeAiClient([
      FakeAiClient.toolUseResponse("create_sub_lesson", {
        parent_lesson_number: 1,
        title: "Bridging Lesson",
        slug: "bridging-lesson",
        html_content: DRAFT_HTML,
      }),
      FakeAiClient.textResponse("Bridging lesson created."),
      FakeAiClient.textResponse(CORRECTED_HTML),
    ]);
    const app = createTestApp(fakeAi, db);
    lr = await login(app, "user@test.com", "password123");

    await authedReq(app, lr, "POST", `/missions/${missionId}/lessons/1/generate-bridging`);
    await pollForDone(app, lr, `/missions/${missionId}/lessons/1/generate-bridging/status`);

    const sub = await db
      .select()
      .from(schema.lessons)
      .where(eq(schema.lessons.missionId, missionId))
      .orderBy(schema.lessons.number)
      .all();
    const bridge = sub.find((l) => l.number === 1 && l.subNumber === 1);
    expect(bridge).toBeDefined();
    expect(bridge!.htmlContent).toBe(CORRECTED_HTML);
  });
});
