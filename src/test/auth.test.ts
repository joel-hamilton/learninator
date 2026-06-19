import { describe, it, expect, beforeEach } from "vitest";
import { FakeAiClient } from "../ai/index.js";
import { createTestDb, createTestApp, seedUser, login } from "./helpers.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "../db/schema.js";

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

    it("logs out and clears cookie", async () => {
      await seedUser(db, "user@test.com", "password123");
      const cookie = await login(app, "user@test.com", "password123");

      const res = await app.request("/logout", {
        headers: { Cookie: cookie },
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("/login");
    });
  });
});
