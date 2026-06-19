import type { InferSelectModel } from "drizzle-orm"
import type { users } from "./db/schema.js"
import type { Logger } from "./logger.js"
import type { AiClient, EventBus, ToolExecutor, WorkflowStateManager } from "./ai/index.js"
import type { MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore, UserStore, SessionStore } from "./db/store.js"
import type { RateLimiter } from "./security/rate-limiter.js"
import type { LessonGenerator } from "./lessons/generator.js"
import type { MissionChatService } from "./services/mission-chat.service.js"

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
  toolExecutor: ToolExecutor
  store: MissionStore & LessonStore & ChatStore & ContentStore & RefDocStore & LearningRecordStore & UserStore & SessionStore
  events: EventBus
  workflowState: WorkflowStateManager
  profileStore: ProfileStore | null
  rateLimiter: RateLimiter | null
  lessonGenerator: LessonGenerator
  missionChatService: MissionChatService
}
