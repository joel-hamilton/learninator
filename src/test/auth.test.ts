import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { FakeAiClient } from "../ai/index.js";
import * as schema from "../db/schema.js";
import { createTestDb, createTestApp, seedUser, login } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("auth", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    db = createTestDb();
    app = createTestApp(new FakeAiClient([]), db);
  });

  describe("POST /signup", () => {
    it("creates user, sets cookie, and redirects", async () => {
      const res = await app.request("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "new@test.com",
          password: "password123",
          confirm: "password123",
        }).toString(),
      });

      expect(res.headers.get("HX-Redirect")).toBe("/");
      const cookie = res.headers.get("Set-Cookie");
      expect(cookie).toBeDefined();
      expect(cookie!).toContain("learninator_sid=");
    });

    it("rejects duplicate email", async () => {
      await seedUser(db, "dup@test.com", "password123");

      const res = await app.request("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "dup@test.com",
          password: "password123",
          confirm: "password123",
        }).toString(),
      });

      const text = await res.text();
      expect(text).toContain("already exists");
    });

    it("rejects mismatched passwords", async () => {
      const res = await app.request("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "test@test.com",
          password: "password123",
          confirm: "different",
        }).toString(),
      });

      const text = await res.text();
      expect(text).toContain("do not match");
    });
  });

  describe("POST /login", () => {
    it("logs in with correct credentials", async () => {
      await seedUser(db, "user@test.com", "password123");

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "user@test.com",
          password: "password123",
        }).toString(),
      });

      expect(res.headers.get("HX-Redirect")).toBe("/");
      const cookie = res.headers.get("Set-Cookie");
      expect(cookie).toBeDefined();
    });

    it("rejects wrong password", async () => {
      await seedUser(db, "user@test.com", "password123");

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "user@test.com",
          password: "wrongpassword",
        }).toString(),
      });

      const text = await res.text();
      expect(text).toContain("Invalid email");
    });
  });

  describe("sessions", () => {
    it("redirects unauthenticated requests to /login", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("creates session with UUID token and CSRF cookie on login", async () => {
      await seedUser(db, "user@test.com", "password123");
      const lr = await login(app, "user@test.com", "password123");

      // Cookie contains UUID (not numeric)
      expect(lr.cookie).toMatch(/learninator_sid=[0-9a-f-]{36}/);

      // CSRF token was extracted
      expect(lr.csrfToken).toBeTruthy();
      expect(lr.csrfToken.length).toBeGreaterThan(32);

      // Session row exists in DB
      const sessions = await db.select().from(schema.sessions);
      expect(sessions.length).toBe(1);
      expect(sessions[0].token).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("invalidates session on logout", async () => {
      await seedUser(db, "user@test.com", "password123");
      const lr = await login(app, "user@test.com", "password123");

      // Verify authenticated (home page with user set should not redirect)
      const beforeRes = await app.request("/", {
        headers: { Cookie: lr.cookie },
      });
      expect(beforeRes.status).toBe(200);

      // Logout
      const logoutRes = await app.request("/logout", {
        headers: { Cookie: lr.cookie },
      });
      expect(logoutRes.status).toBe(302);

      // Session row deleted
      const sessions = await db.select().from(schema.sessions);
      expect(sessions.length).toBe(0);

      // Cookie no longer works (returns redirect to login)
      const afterRes = await app.request("/", {
        headers: { Cookie: lr.cookie },
      });
      expect(afterRes.status).toBe(302);
      expect(afterRes.headers.get("Location")).toBe("/login");
    });

    it("rejects expired session token", async () => {
      await seedUser(db, "user@test.com", "password123");
      const user = await db.select().from(schema.users).where(eq(schema.users.email, "user@test.com")).limit(1);
      const userId = user[0].id;

      // Manually insert an expired session
      const expiredToken = "00000000-0000-4000-a000-000000000001";
      await db.insert(schema.sessions).values({
        userId,
        token: expiredToken,
        csrfToken: "old-csrf",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      const res = await app.request("/", {
        headers: { Cookie: `learninator_sid=${expiredToken}` },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("rejects tampered session token", async () => {
      const res = await app.request("/", {
        headers: { Cookie: "learninator_sid=not-a-valid-uuid-at-all" },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("rejects nonexistent session token", async () => {
      const res = await app.request("/", {
        headers: { Cookie: "learninator_sid=11111111-1111-4111-a111-111111111111" },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });

    it("migrates legacy numeric cookie to UUID session", async () => {
      const user = await seedUser(db, "legacy@test.com", "password123");

      const res = await app.request("/", {
        headers: { Cookie: `learninator_sid=${user.id}` },
      });

      // Should be authenticated (not redirected)
      expect(res.status).toBe(200);

      // Check that a new session was created
      const sessions = await db.select().from(schema.sessions);
      expect(sessions.length).toBe(1);
      expect(sessions[0].userId).toBe(user.id);
      expect(sessions[0].token).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("supports multiple concurrent sessions", async () => {
      await seedUser(db, "multi@test.com", "password123");

      // Login from "device A"
      const lr1 = await login(app, "multi@test.com", "password123");
      const sessions1 = await db.select().from(schema.sessions);
      expect(sessions1.length).toBe(1);

      // Login from "device B" (re-login)
      const lr2 = await login(app, "multi@test.com", "password123");
      const sessions2 = await db.select().from(schema.sessions);
      expect(sessions2.length).toBe(2);

      // Logout from device A
      await app.request("/logout", {
        headers: { Cookie: lr1.cookie },
      });

      // Device A cookie now rejected
      const resA = await app.request("/", {
        headers: { Cookie: lr1.cookie },
      });
      expect(resA.status).toBe(302);

      // Device B still authenticated
      const resB = await app.request("/", {
        headers: { Cookie: lr2.cookie },
      });
      expect(resB.status).toBe(200);
    });

    it("sets CSRF cookie on login", async () => {
      await seedUser(db, "csrfsession@test.com", "password123");
      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "csrfsession@test.com",
          password: "password123",
        }).toString(),
      });

      // Both cookies should be present via getSetCookie
      const cookies = res.headers.getSetCookie?.() ?? [];
      const cookieHeader = res.headers.get("Set-Cookie");
      const allCookies = cookies.length > 0 ? cookies : (cookieHeader ? [cookieHeader] : []);

      const hasSid = allCookies.some((c: string) => c.startsWith("learninator_sid="));
      const hasCsrf = allCookies.some((c: string) => c.startsWith("learninator_csrf="));

      expect(hasSid).toBe(true);
      expect(hasCsrf).toBe(true);
    });
  });

  describe("secure cookie flag", () => {
    it("does not set Secure flag when NODE_ENV is not production", async () => {
      const app2 = createTestApp(new FakeAiClient([]), db);
      await seedUser(db, "secure@test.com", "password123");
      const res = await app2.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "secure@test.com",
          password: "password123",
        }).toString(),
      });

      const cookies = res.headers.getSetCookie?.() ?? [];
      const cookieHeader = res.headers.get("Set-Cookie");
      const allCookies = cookies.length > 0 ? cookies : (cookieHeader ? [cookieHeader] : []);
      // In test mode, secure should not be present
      for (const c of allCookies) {
        expect(c).not.toContain("Secure");
      }
    });
  });

  describe("expired session cleanup", () => {
    it("deletes expired sessions on login", async () => {
      const user = await seedUser(db, "cleanup@test.com", "password123");

      // Insert an expired session directly
      await db.insert(schema.sessions).values({
        userId: user.id,
        token: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        csrfToken: "old-csrf",
        expiresAt: new Date(Date.now() - 3600_000).toISOString(),
      });

      const before = await db.select().from(schema.sessions);
      expect(before.length).toBe(1);

      // Login triggers cleanup
      await login(app, "cleanup@test.com", "password123");

      // Expired session should be gone, new session present
      const after = await db.select().from(schema.sessions);
      expect(after.length).toBe(1);
      expect(after[0].token).not.toBe("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
    });
  });
});
