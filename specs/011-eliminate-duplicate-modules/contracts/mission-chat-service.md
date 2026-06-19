# Contract: MissionChatService

## Factory

```typescript
createMissionChatService(deps: MissionChatDeps): { run, generateTitle }
```

## Dependencies

```
MissionChatDeps {
  ai: AiClient                              // Required — AI client for chat/tool calls
  toolExecutor: ToolExecutor                // Required — executes AI tool calls
  store: MissionStore & ChatStore & ContentStore  // Required — all DB access
  logger: Pick<Logger, "debug" | "info" | "error">  // Required — logging
  events: EventBus                          // Required — SSE tool-call event emission
  workflowState: WorkflowStateManager       // Required — site-wide progress indicator
}
```

All dependencies are required — no optional fields. The service is injected into Hono context and accessed via `c.get("missionChatService")`.

## Methods

### run(input: MissionChatInput) → MissionChatResult

Runs a complete AI conversation turn: saves the user message, builds the system prompt, loads message history, executes the conversation loop with tool calls, manages workflow state lifecycle, and emits SSE events.

```
MissionChatInput {
  missionId: number            // Required — target mission
  userId: number               // Required — for workflow state scoping
  message: string              // User message (empty string for system-initiated turns)
  missionTitle: string         // For workflow label
  missionStatus: string        // "onboarding" | "active" | "archived"
  onboardingMode?: string      // "guided" | "chat" (only when missionStatus === "onboarding")
  context?: string             // Additional context prepended to user message
  lesson?: { number, title }   // Lesson context for lesson-specific chat
  tools?: AiTool[]             // Tools to use (defaults to TEACHER_TOOLS)
  pauseOnTools?: Set<string>   // Tool names that pause the loop
  workflowType?: "chat" | "lesson_generation" | "mission_activation"
  workflowLabel?: string       // Label shown in the progress indicator
}
```

Returns:
```
MissionChatResult {
  text: string                 // Final assistant text
  didActivate: boolean         // true if mark_mission_active was called
  pausedToolUse?: AiToolUseBlock  // The tool use that paused the loop (if any)
}
```

Behavior by mission status:
- **onboarding**: Automatically appends guided/chat onboarding mode instructions to the system prompt
- **active with lesson context**: Appends lesson-aware system prompt instructions
- **active (chat)**: Injects `MISSION.md` content into system prompt if available

Workflow lifecycle:
1. `workflowState.startWorkflow(userId, type, label, missionId, returnUrl)` on entry
2. `workflowState.stepUpdate(wfId, toolName)` for each tool executed
3. `workflowState.completeWorkflow(wfId)` on success
4. `workflowState.failWorkflow(wfId, errorMessage)` on failure (re-throws)

Event emission: via `createStandardHooks({ emit: events.emit.bind(events) })` — emits tool-call events for SSE streaming.

On error: `AIError` exceptions propagate to caller. Workflow state is marked failed before the throw.

### generateTitle(missionId: number) → string | null

Generates a mission title from conversation history using the low-cost model (Haiku). Returns null silently on failure (title generation is non-critical).

- Loads all messages for the mission
- Extracts text content from each message
- Sends last 3000 chars of conversation to AI with "generate a short title" prompt
- Cleans the result (strips quotes, truncates to 120 chars)
- Updates `mission.title` in the database
- Returns the clean title or null
