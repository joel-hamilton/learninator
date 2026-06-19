import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import * as schema from "../db/schema.js";
import { createApp } from "../index.js";
import type { AiClient } from "../ai/index.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export function createTestDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = join(
    dirname(fileURLToPath(import.meta.url)),
    "../db/migrations",
  );
  migrate(db, { migrationsFolder });

  return db;
}

export function createTestApp(
  ai: AiClient,
  db: BetterSQLite3Database<typeof schema>,
) {
  return createApp({ ai, db, rateLimiter: null });
}

export async function seedUser(
  db: BetterSQLite3Database<typeof schema>,
  email: string,
  password: string,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash, name: "Test User" })
    .returning();
  return user;
}

export interface LoginResult {
  cookie: string;
  csrfToken: string;
}

export async function login(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await app.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }).toString(),
  });
  // Collect all Set-Cookie headers
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  if (rawCookies.length === 0) {
    const cookie = res.headers.get("Set-Cookie");
    if (!cookie)
      throw new Error(`login() failed — no cookie (status ${res.status})`);
    rawCookies.push(cookie);
  }
  // Parse out individual cookie name=value pairs
  const pairs: string[] = [];
  let csrfToken = "";
  for (const h of rawCookies) {
    const parts = h.split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("learninator_csrf=")) {
        csrfToken = trimmed.split("=")[1];
        pairs.push(trimmed);
      } else if (trimmed.startsWith("learninator_sid=")) {
        pairs.push(trimmed);
      }
    }
  }
  return { cookie: pairs.join("; "), csrfToken };
}

export async function authedReq(
  app: ReturnType<typeof createApp>,
  loginResult: LoginResult,
  method: string,
  path: string,
  body?: Record<string, string>,
) {
  const headers: Record<string, string> = { Cookie: loginResult.cookie };
  // Include CSRF token on state-changing methods
  if (loginResult.csrfToken && method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = loginResult.csrfToken;
  }
  let bodyStr: string | undefined;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    bodyStr = new URLSearchParams(body).toString();
  }
  return app.request(path, { method, headers, body: bodyStr });
}
