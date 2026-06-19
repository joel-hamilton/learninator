import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { SessionStore, SessionRow } from "../store.js";

export class DrizzleSessionAdapter implements SessionStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async createSession(values: { userId: number; token: string; csrfToken: string; expiresAt: string }) {
    const [row] = await this.db.insert(schema.sessions).values({
      userId: values.userId,
      token: values.token,
      csrfToken: values.csrfToken,
      expiresAt: values.expiresAt,
    }).returning();
    return row;
  }

  async getSessionByToken(token: string) {
    const [row] = await this.db.select().from(schema.sessions)
      .where(eq(schema.sessions.token, token))
      .limit(1);
    return row;
  }

  async deleteSession(token: string) {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }

  async deleteExpiredSessions() {
    await this.db.delete(schema.sessions)
      .where(
        sql`${schema.sessions.expiresAt} <= ${new Date().toISOString()}`
      );
  }
}
