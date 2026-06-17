import type { InferSelectModel } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "./db/schema.js"
import type { users } from "./db/schema.js"
import type { Logger } from "./logger.js"
import type { AiClient, ToolExecutor } from "./ai/types.js"

export type User = InferSelectModel<typeof users>

/** Extend Hono's context to include our typed variables */
export type AppVariables = {
  user: User | null
  logger: Logger
  ai: AiClient
  db: BetterSQLite3Database<typeof schema>
  toolExecutor: ToolExecutor
}
