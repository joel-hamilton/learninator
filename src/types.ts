import type { InferSelectModel } from "drizzle-orm";
import type { users } from "./db/schema.js";

export type User = InferSelectModel<typeof users>;

/** Extend Hono's context to include our typed variables */
export type AppVariables = {
  user: User | null;
};
