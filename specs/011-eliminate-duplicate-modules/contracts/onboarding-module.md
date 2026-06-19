# Contract: OnboardingModule (SUPERSEDED)

> **Status**: Superseded by [MissionChatService](./mission-chat-service.md).
> The OnboardingModule in `src/onboarding/index.ts` is dead code — routes use `MissionChatService` injected via Hono context.
> This contract is retained for reference during the cleanup phase. Delete this file when `src/onboarding/index.ts` is removed.

## Factory

```typescript
createOnboarding(deps: OnboardingDeps): OnboardingModule
```

## Dependencies

```
OnboardingDeps {
  ai: AiClient           // Required — AI client for chat/tool calls
  toolExecutor: ToolExecutor  // Required — executes AI tool calls
  store: MissionStore & ChatStore  // Required — database access
  logger: Logger          // Required — logging
  // NOTE: No workflowState or events fields — these were never added.
  // MissionChatService was created instead of extending this interface.
}
```

## Methods

### start(missionId, userMessage, mode) → OnboardingResult

Creates the first conversation turn for a new mission.

### continueGuided(missionId) → OnboardingResult

Continues a guided onboarding conversation when there's no pending question.

### answerQuestion(missionId, questionId, answer, otherText?) → OnboardingResult

Submits an answer to a guided question and continues the conversation.

### skipQuestions(missionId) → OnboardingResult

Skips remaining guided questions and tells AI to proceed to activation.

### switchMode(missionId, newMode) → void

Switches between "guided" and "chat" onboarding modes.
