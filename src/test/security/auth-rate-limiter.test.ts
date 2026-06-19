import { describe, it, expect, beforeEach } from "vitest";
import { FakeAiClient } from "../../ai/index.js";
import { createTestDb, createTestApp, seedUser, login } from "../helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../../db/schema.js";
import { SlidingWindowRateLimiter } from "../../security/rate-limiter.js";
import { createApp } from "../../index.js";

describe("auth rate limiting", () => {
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(async () => {
    db = createTestDb();
    await seedUser(db, "ratelimit@test.com", "password123");
  });

  function makeLoginReq(app: ReturnType<typeof createApp>, email: string, password: string) {
    return app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password }).toString(),
    });
  }

  function makeSignupReq(app: ReturnType<typeof createApp>, suffix: string) {
    return app.request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: `test${suffix}@test.com`,
        password: "password123",
        confirm: "password123",
      }).toString(),
    });
  }

  it("rate limits login after 10 attempts within 60 seconds", { timeout: 15000 }, async () => {
    const rateLimiter = new SlidingWindowRateLimiter();
    const app = createApp({ ai: new FakeAiClient([]), db, rateLimiter });

    // First 10 should be accepted (even if credentials are wrong)
    for (let i = 0; i < 10; i++) {
      const res = await makeLoginReq(app, "ratelimit@test.com", "wrong");
      expect(res.status).not.toBe(429);
    }

    // 11th should be rate limited
    const res = await makeLoginReq(app, "ratelimit@test.com", "wrong");
    const text = await res.text();
    expect(text).toContain("Too many login attempts");
  });

  it("rate limits signup after 5 attempts within 60 seconds", async () => {
    const rateLimiter = new SlidingWindowRateLimiter();
    const app = createApp({ ai: new FakeAiClient([]), db, rateLimiter });

    // First 5 should be accepted
    for (let i = 1; i <= 5; i++) {
      const res = await makeSignupReq(app, String(i));
      expect(res.status).not.toBe(429);
    }

    // 6th should be rate limited
    const res = await makeSignupReq(app, "6");
    const text = await res.text();
    expect(text).toContain("Too many signup attempts");
  });

  it("does not rate limit when rateLimiter is null (test mode)", async () => {
    const app = createTestApp(new FakeAiClient([]), db);

    // Many requests should all succeed without 429
    for (let i = 0; i < 10; i++) {
      const res = await makeLoginReq(app, "ratelimit@test.com", "wrong");
      expect(res.status).not.toBe(429);
    }
    // 11th should still pass since rateLimiter is null
    const res = await makeLoginReq(app, "ratelimit@test.com", "wrong");
    expect(res.status).not.toBe(429);
  });
});
