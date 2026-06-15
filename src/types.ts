import type { InferSelectModel } from "drizzle-orm"
import type { users } from "./db/schema.js"
import type { Logger } from "./logger.js"
import type { AiClient, ToolExecutor } from "./ai/types.js"

export type User = InferSelectModel<typeof users>

/** Extend Hono's context to include our typed variables */
export type AppVariables = {
  user: User | null
  logger: Logger
  ai: AiClient
  toolExecutor: ToolExecutor
}
