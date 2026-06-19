import { describe, it, expect, beforeEach } from "vitest";
import { FakeAiClient } from "../ai/index.js";
import { SlidingWindowRateLimiter } from "../security/rate-limiter.js";
import { createApp } from "../index.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("US1 - Remove insecure SSE tool-events endpoint", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "us1@test.com", "password123");
  });

  function setupApp() {
    app = createTestApp(new FakeAiClient([]), db);
  }

  async function loginUser() {
    cookie = await login(app, "us1@test.com", "password123");
  }

  it("T006: GET /missions/:missionId/chat/tool-events returns 404 after removal", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "SSE Removal Test", slug: "sse-removal-test", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "GET", `/missions/${mission.id}/chat/tool-events`);
    expect(res.status).toBe(404);
  });

  it("T007: /workflows/events SSE endpoint still functional after tool-events removal", async () => {
    setupApp();
    await loginUser();

    const res = await authedReq(app, cookie, "GET", "/workflows/events");
    const contentType = res.headers.get("Content-Type") || res.headers.get("content-type");
    expect(contentType).toBe("text/event-stream");
  });
});

describe("US2 - Server-side input length limits", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "us2@test.com", "password123");
  });

  function setupApp(responses?: any[]) {
    app = createTestApp(new FakeAiClient(responses ?? []), db);
  }

  async function loginUser() {
    cookie = await login(app, "us2@test.com", "password123");
  }

  const over10k = "x".repeat(10_001);
  const exact10k = "x".repeat(10_000);
  const over200 = "x".repeat(201);
  const over2k = "x".repeat(2_001);
  const over1k = "x".repeat(1_001);

  it("T012: chat message > 10,000 chars rejected on POST /missions/:id/chat", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Chat Limit", slug: "chat-limit", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: over10k });
    const html = await res.text();
    expect(html).toContain("too long");
    expect(html).toContain("10,000");
  });

  it("T013: chat message ≤ 10,000 chars accepted normally", async () => {
    setupApp([FakeAiClient.textResponse("Thanks for your message!")]);
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Chat OK", slug: "chat-ok", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: exact10k });
    const html = await res.text();
    expect(html).not.toContain("too long");
  });

  it("T014a: mission title > 200 chars rejected on rename", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Original", slug: "original", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "PUT", `/missions/${mission.id}/title`, { title: over200 });
    const html = await res.text();
    expect(html).toContain("Title must be 200 characters or fewer");
  });

  it("T014b: mission topic > 200 chars rejected on create", async () => {
    setupApp();
    await loginUser();

    const res = await authedReq(app, cookie, "POST", "/missions/new", { topic: over200, mode: "chat" });
    const html = await res.text();
    expect(html).toContain("bit long");
    expect(html).toContain("200");
  });

  it("T014c: mission message > 200 chars rejected on create from dashboard", async () => {
    setupApp();
    await loginUser();

    const res = await authedReq(app, cookie, "POST", "/missions", { message: over200, mode: "guided" });
    const html = await res.text();
    expect(html).toContain("bit long");
    expect(html).toContain("200");
  });

  it("T015: lesson feedback > 2,000 chars rejected", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Feedback", slug: "feedback", status: "active" })
      .returning();
    await db
      .insert(schema.lessons)
      .values({
        missionId: mission.id,
        number: 1,
        title: "Lesson 1",
        slug: "lesson-1",
        htmlContent: "<p>Hello</p>",
        status: "completed",
      });

    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/lessons/1/feedback`, { rating: "just_right", feedbackText: over2k });
    const html = await res.text();
    expect(html).toContain("Feedback");
    expect(html).toContain("2,000");
  });

  it("T016: lesson notes > 1,000 chars rejected on generate-next", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Notes", slug: "notes", status: "active" })
      .returning();
    await db
      .insert(schema.lessons)
      .values({
        missionId: mission.id,
        number: 1,
        title: "Lesson 1",
        slug: "lesson-1",
        htmlContent: "<p>Hello</p>",
        status: "completed",
      });

    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/lessons/1/generate-next`, { notes: over1k, feedback: "" });
    const html = await res.text();
    expect(html).toContain("Notes");
    expect(html).toContain("1,000");
  });

  it("T017: guided answer > 5,000 chars combined rejected", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Guided", slug: "guided", status: "onboarding", onboardingMode: "guided" })
      .returning();
    await db
      .insert(schema.guidedQuestions)
      .values({
        missionId: mission.id,
        question: "What do you want to learn?",
        options: JSON.stringify(["A", "B", "C", "Other (please specify)"]),
        status: "pending",
      });

    const over5k = "x".repeat(5_001);
    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/guided/answer`, { question_id: "1", answer: over5k, other_text: "" });
    const html = await res.text();
    expect(html).toContain("too long");
    expect(html).toContain("5,000");
  });
});

describe("US3 - In-memory rate limiting on AI endpoints", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "us3@test.com", "password123");
  });

  async function loginUser(app: ReturnType<typeof createApp>) {
    cookie = await login(app, "us3@test.com", "password123");
  }

  it("T025: 21 chat requests → first 20 accepted, 21st rate limited", async () => {
    const app = createApp({
      ai: new FakeAiClient(Array(20).fill(FakeAiClient.textResponse("OK"))),
      db,
      rateLimiter: new SlidingWindowRateLimiter(),
    });
    await loginUser(app);

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Rate Test", slug: "rate-test", status: "active" })
      .returning();

    // Send 20 requests — all should be accepted
    for (let i = 0; i < 20; i++) {
      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: `test ${i}` });
      const html = await res.text();
      expect(html).not.toContain("too quickly");
    }

    // 21st request should be rate limited
    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: "one too many" });
    const html = await res.text();
    expect(html).toContain("too quickly");
  });

  it("T026: sliding window resets — requests accepted after window passes", async () => {
    const rl = new SlidingWindowRateLimiter();
    // Exhaust the limit with a short window
    expect(rl.check(1, "test", 2, 50)).toBe(true);
    expect(rl.check(1, "test", 2, 50)).toBe(true);
    expect(rl.check(1, "test", 2, 50)).toBe(false);

    // Wait for window to slide
    await new Promise((r) => setTimeout(r, 60));

    // Should be accepted again
    expect(rl.check(1, "test", 2, 50)).toBe(true);
  });

  it("T027: oversized input does not consume rate limit quota", async () => {
    const app = createApp({
      ai: new FakeAiClient([FakeAiClient.textResponse("OK")]),
      db,
      rateLimiter: new SlidingWindowRateLimiter(),
    });
    await loginUser(app);

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Quota Test", slug: "quota-test", status: "active" })
      .returning();

    // Send oversized message — should be rejected by input validation, not consume rate limit
    const over10k = "x".repeat(10_001);
    const big = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: over10k });
    expect(await big.text()).toContain("too long");

    // Normal message should still be accepted (rate limit not consumed)
    const normal = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: "hello" });
    expect(await normal.text()).not.toContain("too quickly");
  });

  it("T028: rate limiter bypassed when rateLimiter is null (test mode)", async () => {
    const app = createApp({ ai: new FakeAiClient([]), db, rateLimiter: null });
    await loginUser(app);

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Null Test", slug: "null-test", status: "active" })
      .returning();

    // With no rate limiter, requests should not be rate limited (they'll hit AI error, but not rate limit)
    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/chat`, { message: "test" });
    const html = await res.text();
    expect(html).not.toContain("too quickly");
  });

  it("T029a: lesson generation rate limit — 11 requests, 11th rejected", async () => {
    const app = createApp({
      ai: new FakeAiClient([]),
      db,
      rateLimiter: new SlidingWindowRateLimiter(),
    });
    await loginUser(app);

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Lesson Rate", slug: "lesson-rate", status: "active" })
      .returning();
    await db
      .insert(schema.lessons)
      .values({
        missionId: mission.id,
        number: 1,
        title: "Lesson 1",
        slug: "lesson-1",
        htmlContent: "<p>Hello</p>",
        status: "completed",
      });

    // 10 lesson generation requests — accepted
    for (let i = 0; i < 10; i++) {
      const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/lessons/1/generate-next`, { notes: "", feedback: "" });
      const html = await res.text();
      expect(html).not.toContain("too quickly");
    }

    // 11th should be rate limited
    const res = await authedReq(app, cookie, "POST", `/missions/${mission.id}/lessons/1/generate-next`, { notes: "", feedback: "" });
    const html = await res.text();
    expect(html).toContain("too quickly");
  });

  it("T029b: mission creation rate limit — 6 requests, 6th rejected", async () => {
    const app = createApp({
      ai: new FakeAiClient([]),
      db,
      rateLimiter: new SlidingWindowRateLimiter(),
    });
    await loginUser(app);

    // 5 mission creates via POST /missions/new — accepted (redirect)
    for (let i = 0; i < 5; i++) {
      const res = await authedReq(app, cookie, "POST", "/missions/new", { topic: `Mission ${i}`, mode: "chat" });
      // Accepted means a redirect, not a rate limit error
      expect(await res.text()).not.toContain("too quickly");
    }

    // 6th should be rate limited
    const res = await authedReq(app, cookie, "POST", "/missions/new", { topic: "Mission 6", mode: "chat" });
    expect(await res.text()).toContain("too quickly");
  });
});
