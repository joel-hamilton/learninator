import { describe, it, expect, beforeEach } from "vitest";
import { FakeAiClient } from "../../ai/index.js";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema.js";
import { createTestDb, createTestApp, seedUser, login, authedReq } from "../helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("csrf", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;
  let lr: any;

  beforeEach(async () => {
    db = createTestDb();
    app = createTestApp(new FakeAiClient([]), db);
    await seedUser(db, "csrf@test.com", "password123");
    lr = await login(app, "csrf@test.com", "password123");
  });

  it("rejects POST without X-CSRF-Token header", async () => {
    const res = await app.request("/missions/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: lr.cookie,
      },
      body: new URLSearchParams({ title: "test" }).toString(),
    });

    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Invalid CSRF token");
  });

  it("rejects POST with mismatched CSRF token", async () => {
    const res = await app.request("/missions/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: lr.cookie,
        "X-CSRF-Token": "wrong-token-value",
      },
      body: new URLSearchParams({ title: "test" }).toString(),
    });

    expect(res.status).toBe(403);
  });

  it("allows POST with valid CSRF token", async () => {
    const res = await authedReq(app, lr, "POST", "/missions/new", {
      title: "CSRF Test Mission",
    });

    expect(res.status).not.toBe(403);
  });

  it("allows GET requests without CSRF token", async () => {
    const res = await app.request("/", {
      headers: { Cookie: lr.cookie },
    });

    expect(res.status).toBe(200);
  });

  it("rejects PUT without CSRF token", async () => {
    const [mission] = await db
      .insert(schema.missions)
      .values({
        userId: 1,
        title: "PUT Test",
        slug: "put-test",
        status: "active",
      })
      .returning();

    const res = await app.request(`/missions/${mission.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: lr.cookie,
      },
      body: new URLSearchParams({ title: "hacked" }).toString(),
    });

    expect(res.status).toBe(403);
  });
});
