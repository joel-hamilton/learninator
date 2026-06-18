import { describe, it, expect, beforeEach } from "vitest";
import { FakeAiClient } from "../ai/fake.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("workflow visibility", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let cookie: string;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "wf@test.com", "password123");
  });

  function setupApp() {
    app = createTestApp(new FakeAiClient([]), db);
  }

  async function loginUser() {
    cookie = await login(app, "wf@test.com", "password123");
  }

  it("site-wide workflow indicator is rendered on every page", async () => {
    setupApp();
    await loginUser();

    // Home page
    const homeRes = await authedReq(app, cookie, "GET", "/");
    const homeHtml = await homeRes.text();
    expect(homeHtml).toContain("workflow-indicator");

    // Dashboard has SSE poller script
    expect(homeHtml).toContain("workflows/state");
  });

  it("workflow state endpoint returns empty array when idle", async () => {
    setupApp();
    await loginUser();

    const res = await authedReq(app, cookie, "GET", "/workflows/state");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflows).toEqual([]);
  });

  it("workflow events SSE endpoint returns event-stream", async () => {
    setupApp();
    await loginUser();

    const res = await authedReq(app, cookie, "GET", "/workflows/events");
    expect(res.headers.get("Content-Type") || res.headers.get("content-type")).toBe("text/event-stream");
  });

  it("old tool-events endpoint returns 404 after removal", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "SSE Removal", slug: "sse-removal", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "GET", `/missions/${mission.id}/chat/tool-events`);
    expect(res.status).toBe(404);
  });

  it("chat page renders workflow indicator", async () => {
    setupApp();
    await loginUser();

    const [mission] = await db
      .insert(schema.missions)
      .values({ userId: 1, title: "Chat Test", slug: "chat-test", status: "active" })
      .returning();

    const res = await authedReq(app, cookie, "GET", `/missions/${mission.id}/chat`);
    const html = await res.text();
    expect(html).toContain("workflow-indicator");
  });
});
