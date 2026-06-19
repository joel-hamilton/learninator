# Contract: OnboardingModule

## Factory

```typescript
createOnboarding(deps: OnboardingDeps): OnboardingModule
```

## Dependencies

```
OnboardingDeps {
  ai: AiClient           // Required — AI client for chat/tool calls
  toolExecutor: ToolExecutor  // Required — executes AI tool calls
  store: MissionStore     // Required — database access
  logger: Logger          // Required — logging
  workflowState?: WorkflowStateManager  // Optional — site-wide progress indicator
  events?: EventBus       // Optional — SSE tool-call event emission
}
```

## Methods

### start(missionId, userMessage, mode) → OnboardingResult

Creates the first conversation turn for a new mission.
- Saves the user message
- Runs the conversation loop with onboarding system prompt
- If mode === "guided", pauses after `ask_guided_question`
- If mark_mission_active is called, triggers title generation
- Returns `{ type: "redirect", url: "/missions/:id" }`

### continueGuided(missionId) → OnboardingResult

Continues a guided onboarding conversation when there's no pending question.
- Loads existing messages
- Runs conversation loop with guided prompt, pauseOnTools: ask_guided_question
- Returns `{ type: "redirect" }` on activation, `{ type: "question" }` with question data, or `{ type: "thinking" }` to trigger another turn

### answerQuestion(missionId, questionId, answer, otherText?) → OnboardingResult

Submits an answer to a guided question and continues the conversation.
- Marks question as answered in DB
- Saves answer as a user message
- Runs conversation loop
- Returns same result types as continueGuided

### skipQuestions(missionId) → OnboardingResult

Skips remaining guided questions and tells AI to proceed to activation.
- Marks all pending questions as answered
- Removes ask_guided_question from tools
- Adds skip instruction to system prompt
- Returns `{ type: "redirect" }`

### switchMode(missionId, newMode) → void

Switches between "guided" and "chat" onboarding modes.
- If switching guided→chat: converts pending questions to chat messages
- Updates mission.onboardingMode in DB
