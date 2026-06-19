# Data Model: Consolidate Activation Bootstrap

## Status

No new data entities. This feature is a pure structural refactoring.

## Existing Interfaces (referenced by the helper)

### `MissionChatResult`

Defined in `src/services/mission-chat.service.ts`:

```typescript
interface MissionChatResult {
  text: string;
  didActivate: boolean;
  pausedToolUse?: AiToolUseBlock;
}
```

The helper only reads `didActivate` — a boolean that is `true` when the AI has called `mark_mission_active` during the conversation loop.

### `MissionChatService`

Exposed by `createMissionChatService()` in `src/services/mission-chat.service.ts`:

```typescript
interface MissionChatService {
  run(opts: MissionChatRunOpts): Promise<MissionChatResult>;
  generateTitle(missionId: number): Promise<string | null>;
}
```

The helper calls only `generateTitle(missionId)` — which loads the conversation messages, sends them to the AI (low-cost model) for summarization, and updates the mission title in the database.

### `AppVariables`

Defined in `src/types.ts` — the Hono context variable shape:

```typescript
type AppVariables = {
  user: User | null;
  logger: Logger;
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: DrizzleMissionStore;
  events: EventBus;
  workflowState: WorkflowStateManager;
  profileStore: ProfileStore | null;
  rateLimiter: RateLimiter | null;
  lessonGenerator: LessonGenerator;
  missionChatService: MissionChatService;
};
```

The helper accesses `missionChatService` through `c.get("missionChatService")`.

## No schema changes

Database schema is unaffected. No migrations, no new tables, no new columns.
