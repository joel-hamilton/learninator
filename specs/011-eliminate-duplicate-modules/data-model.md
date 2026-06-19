# Data Model: Eliminate Duplicate Modules

No schema changes. This refactor operates entirely within the existing data model.

## Existing Entities (unchanged)

- **Mission**: id, userId, title, slug, status, onboardingMode, createdAt, updatedAt
- **ChatMessage**: id, missionId, role, content, createdAt
- **GuidedQuestion**: id, missionId, question, options, answer, answerText, status, createdAt
- **MissionContent**: id, missionId, contentType, markdownContent, createdAt, updatedAt

## Module Interfaces (refactored)

### OnboardingDeps (extended)

```typescript
export interface OnboardingDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore;
  logger: Logger;
  // NEW: optional workflow state for site-wide progress indicator
  workflowState?: WorkflowStateManager;
  // NEW: optional event bus for SSE tool-call visibility
  events?: EventBus;
}
```

### OnboardingModule (unchanged API)

```typescript
export interface OnboardingModule {
  start(missionId: number, userMessage: string, mode: "guided" | "chat"): Promise<OnboardingResult>;
  continueGuided(missionId: number): Promise<OnboardingResult>;
  answerQuestion(missionId: number, questionId: number, answer: string, otherText?: string): Promise<OnboardingResult>;
  skipQuestions(missionId: number): Promise<OnboardingResult>;
  switchMode(missionId: number, newMode: "guided" | "chat"): Promise<void>;
}
```

### TopicExplorer (unchanged)

```typescript
export interface TopicExplorer {
  explore(path: string[], iteration: number): Promise<TopicOptions>;
  select(path: string[], selection: string, iteration: number, isCustom?: boolean): Promise<TopicResult>;
  refresh(path: string[], iteration: number): Promise<TopicOptions>;
}
```

### Deleted

- `MissionConversationDeps`, `MissionConversationInput`, `MissionConversationResult`, `MissionConversationModule` — all in `src/ai/mission-conversation.ts`
