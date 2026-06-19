# Data Model: Eliminate Duplicate Modules

No schema changes. This refactor operates entirely within the existing data model.

## Existing Entities (unchanged)

- **Mission**: id, userId, title, slug, status, onboardingMode, createdAt, updatedAt
- **ChatMessage**: id, missionId, role, content, createdAt
- **GuidedQuestion**: id, missionId, question, options, answer, answerText, status, createdAt
- **MissionContent**: id, missionId, contentType, markdownContent, createdAt, updatedAt

## Service Interfaces

### MissionChatService (canonical — in `src/services/mission-chat.service.ts`)

```typescript
export interface MissionChatDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & ChatStore & ContentStore;
  logger: Pick<Logger, "debug" | "info" | "error">;
  events: EventBus;
  workflowState: WorkflowStateManager;
}

export interface MissionChatInput {
  missionId: number;
  userId: number;
  message: string;
  missionTitle: string;
  missionStatus: string;
  onboardingMode?: string;
  context?: string;
  lesson?: { number: string; title: string };
  tools?: AiTool[];
  pauseOnTools?: Set<string>;
  workflowType?: "chat" | "lesson_generation" | "mission_activation";
  workflowLabel?: string;
}

export interface MissionChatResult {
  text: string;
  didActivate: boolean;
  pausedToolUse?: AiToolUseBlock;
}

// Factory returns { run, generateTitle }
export type MissionChatService = {
  run(input: MissionChatInput): Promise<MissionChatResult>;
  generateTitle(missionId: number): Promise<string | null>;
};
```

MissionChatService is injected into Hono context as `c.get("missionChatService")` and consumed by:
- `src/routes/missions.ts` (mission creation, chat)
- `src/routes/onboarding.ts` (guided start/answer/skip, mode switch)
- `src/routes/chat.ts` (active mission chat)
- `src/routes/lessons.ts` (lesson-specific chat)

### TopicExplorer (unchanged — in `src/browse/explorer.ts`)

```typescript
export interface TopicExplorer {
  explore(path: string[], iteration: number): Promise<TopicOptions>;
  select(path: string[], selection: string, iteration: number, isCustom?: boolean): Promise<TopicResult>;
  refresh(path: string[], iteration: number): Promise<TopicOptions>;
}
```

### Superseded / Deleted

- **OnboardingDeps / OnboardingModule** (in `src/onboarding/index.ts`): Superseded by `MissionChatService`. Dead code — only imported by own test. To be deleted.
- **MissionConversationDeps / MissionConversationModule** (in `src/ai/mission-conversation.ts`): Deleted. Functionality merged into `MissionChatService`.
