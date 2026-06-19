import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema.js";
import type { UserStore, UserRow } from "../store.js";

export class DrizzleUserAdapter implements UserStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async getUser(id: number) {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return row;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return row;
  }

  async createUser(values: { email: string; passwordHash: string; name?: string }) {
    const [row] = await this.db.insert(schema.users).values({
      email: values.email,
      passwordHash: values.passwordHash,
      name: values.name ?? "",
    }).returning();
    return row;
  }

  async updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }) {
    const setData: Record<string, unknown> = {};
    if (values.name !== undefined) setData.name = values.name;
    if (values.email !== undefined) setData.email = values.email;
    if (values.passwordHash !== undefined) setData.passwordHash = values.passwordHash;
    if (Object.keys(setData).length > 0) {
      await this.db.update(schema.users).set(setData).where(eq(schema.users.id, id));
    }
  }
}
