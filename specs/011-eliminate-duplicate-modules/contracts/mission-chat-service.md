# Contract: MissionChatService

## Factory

```typescript
createMissionChatService(deps: MissionChatDeps): { run, generateTitle }
```

Injected into Hono context as `missionChatService` by `src/index.ts`.

## Dependencies

```
MissionChatDeps {
  ai: AiClient                                  // Required — AI client for chat/tool calls
  toolExecutor: ToolExecutor                     // Required — executes AI tool calls
  store: MissionStore & ChatStore & ContentStore // Required — database access
  logger: Pick<Logger, "debug" | "info" | "error"> // Required — logging
  events: EventBus                              // Required — SSE tool-call event emission
  workflowState: WorkflowStateManager           // Required — site-wide progress indicator
}
```

## Methods

### run(input) → MissionChatResult

Runs an AI conversation turn for a mission. Adapts behavior based on `missionStatus`:
- **onboarding**: Builds onboarding system prompt with mode-specific instructions. Pauses after `ask_guided_question` when `pauseOnTools` is set.
- **active (no lesson)**: Injects mission content (MISSION.md) into the system prompt.
- **active (with lesson)**: Adds lesson-specific context to both system prompt and user message.

Wraps the conversation loop with workflow lifecycle (`startWorkflow`, `stepUpdate`, `completeWorkflow`/`failWorkflow`) and event emission via `createStandardHooks`.

**Input** (`MissionChatInput`):
- `missionId: number` — Required
- `userId: number` — Required
- `message: string` — User message (empty string for auto-continue)
- `missionTitle: string` — Required for workflow labels
- `missionStatus: string` — "onboarding" | "active" | "archived"
- `onboardingMode?: string` — "guided" | "chat", only when missionStatus === "onboarding"
- `context?: string` — Prepended to user message for additional context
- `lesson?: { number: string; title: string }` — Current lesson context
- `tools?: AiTool[]` — Defaults to TEACHER_TOOLS
- `pauseOnTools?: Set<string>` — Tool names that pause the loop (e.g., "ask_guided_question")
- `workflowType?: "chat" | "lesson_generation" | "mission_activation"` — Default "chat"
- `workflowLabel?: string` — Default "Chat: {missionTitle}"

**Result** (`MissionChatResult`):
- `text: string` — Assistant's text response
- `didActivate: boolean` — True if `mark_mission_active` was called
- `pausedToolUse?: AiToolUseBlock` — The blocking tool use (e.g., ask_guided_question)

### generateTitle(missionId) → string | null

Generates and persists a mission title from conversation history.
- Loads messages, extracts text, sends to AI with model: "low"
- Cleans and persists the title via `store.updateMissionTitle()`
- Returns null on failure (title generation is non-critical)
