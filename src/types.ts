import type { InferSelectModel } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "./db/schema.js"
import type { users } from "./db/schema.js"
import type { Logger } from "./logger.js"
import type { AiClient, EventBus, ToolExecutor, WorkflowStateManager } from "./ai/index.js"
import type { MissionStore } from "./db/store.js"
import type { RateLimiter } from "./security/rate-limiter.js"
import type { LessonGenerator } from "./lessons/generator.js"

export type User = InferSelectModel<typeof users>

export interface ProfileReportRow {
  routePattern: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  recentSlow: { url: string; durationMs: number }[];
}

export interface ProfileStore {
  record(method: string, routePattern: string, durationMs: number, url: string): void;
  generateReport(): ProfileReportRow[];
  isEnabled(): boolean;
}

/** Extend Hono's context to include our typed variables */
export type AppVariables = {
  user: User | null
  logger: Logger
  ai: AiClient
  db: BetterSQLite3Database<typeof schema>
  toolExecutor: ToolExecutor
  store: MissionStore
  events: EventBus
  workflowState: WorkflowStateManager
  profileStore: ProfileStore | null
  rateLimiter: RateLimiter | null
  lessonGenerator: LessonGenerator
}
