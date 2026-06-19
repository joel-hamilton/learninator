# Data Model: Eliminate Duplicate Modules

No schema changes. This refactor operates entirely within the existing data model.

## Existing Entities (unchanged)

- **Mission**: id, userId, title, slug, status, onboardingMode, createdAt, updatedAt
- **ChatMessage**: id, missionId, role, content, createdAt
- **GuidedQuestion**: id, missionId, question, options, answer, answerText, status, createdAt
- **MissionContent**: id, missionId, contentType, markdownContent, createdAt, updatedAt

## Surviving Service Interface

### MissionChatService

The canonical implementation at `src/services/mission-chat.service.ts`. Created via `createMissionChatService(deps)`. Returned by `createMissionChatService()`: `{ run, generateTitle }`.

**Dependencies** (`MissionChatDeps`):
- `ai: AiClient` — Required
- `toolExecutor: ToolExecutor` — Required
- `store: MissionStore & ChatStore & ContentStore` — Required
- `logger: Pick<Logger, "debug" | "info" | "error">` — Required
- `events: EventBus` — Required (SSE tool-call visibility)
- `workflowState: WorkflowStateManager` — Required (site-wide progress indicator)

**Methods**:

- `run(input: MissionChatInput) → MissionChatResult` — Runs the conversation loop with appropriate system prompt and tool set for the given context (onboarding/active/lesson).
- `generateTitle(missionId: number) → string | null` — Generates and persists a mission title from conversation history.

**Input** (`MissionChatInput`):
- `missionId`, `userId`, `message`, `missionTitle`, `missionStatus` — Required
- `onboardingMode?: string` — Set for onboarding missions
- `context?: string` — Additional context prepended to user message
- `lesson?: { number: string; title: string }` — Lesson context for lesson-specific chat
- `tools?: AiTool[]` — Defaults to TEACHER_TOOLS
- `pauseOnTools?: Set<string>` — Tool names that pause the loop
- `workflowType?: "chat" | "lesson_generation" | "mission_activation"` — Defaults to "chat"
- `workflowLabel?: string` — Defaults to "Chat: {missionTitle}"

### TopicExplorer

Located at `src/browse/explorer.ts`. Created via `createTopicExplorer(deps)`. Unchanged by this refactor — already used by browse routes.

**Dependencies** (`TopicExplorerDeps`):
- `ai: AiClient` — Required
- `logger: Logger` — Required

**Methods**: `explore()`, `select()`, `refresh()` — see [contracts/topic-explorer.md](./contracts/topic-explorer.md).

## Deleted Modules

- `src/onboarding/index.ts` — Dead code; zero production imports. Functionality subsumed by `mission-chat.service.ts`.
- `src/onboarding/index.test.ts` — Deleted with the module. Coverage exists at HTTP level (`missions.test.ts`, `chat.test.ts`).
- `src/ai/mission-conversation.ts` — Already deleted before this plan. Replaced by `mission-chat.service.ts`.
- `src/ai/mission-conversation.test.ts` — Already deleted with its module.
