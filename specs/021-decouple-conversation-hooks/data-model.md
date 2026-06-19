# Data Model: Conversation Hook Decoupling

This feature is a pure code refactoring — no database schema changes. The "data model" below describes the TypeScript type/interface changes and the responsibilities of each entity.

---

## ConversationLoopParams

The input parameter bag for `conversationLoop()`.

**Location**: `src/ai/conversation.ts`

**Current fields** (unchanged):

| Field | Type | Description |
|---|---|---|
| `client` | `AiClient` | AI chat client |
| `toolExecutor` | `ToolExecutor` | Executes tool calls server-side |
| `missionId` | `number` | Current mission ID |
| `systemPrompt` | `string` | System prompt sent to AI |
| `initialMessages` | `AiMessageParam[]` | Conversation history |
| `tools` | `AiTool[]` | Tool definitions for AI |
| `options?` | `ToolCallOptions` | AI call options |
| `hooks?` | `ConversationHooks` | Domain callbacks |
| `logger?` | `Pick<Logger, "debug">` | Debug logger |
| `pauseOnTools?` | `Set<string>` | Tool names that break the loop |
| `maxTurns?` | `number` | Max tool-use turns (default 20) |

**New field**:

| Field | Type | Description | Required |
|---|---|---|---|
| `events` | `EventBus` | Event bus for emitting tool progress events | Optional |

**Validation rules**:
- If `events` is provided, `tool_start` and `tool_end` events MUST be emitted at the appropriate points in the loop
- If `events` is `undefined` or omitted, no events are emitted (no crash, no undefined access)
- The `events` object is used only for `emit()` calls — `conversationLoop` does NOT subscribe to events

---

## StandardHooksDeps

The dependency bag for `createStandardHooks()`.

**Location**: `src/ai/conversation.ts`

**Current fields**:

| Field | Type | Description | Action |
|---|---|---|---|
| `missionId` | `number` | Current mission ID | KEEP |
| `store` | `ChatStore` | Database store | KEEP |
| `emit` | `(missionId: number, event: ToolEvent) => void` | Event emitter function | **REMOVE** |
| `logger?` | `Pick<Logger, "debug">` | Debug logger | KEEP |

**Refactored fields**:

| Field | Type | Description |
|---|---|---|
| `missionId` | `number` | Current mission ID |
| `store` | `ChatStore` | Database store |
| `logger?` | `Pick<Logger, "debug">` | Debug logger |

---

## ConversationHooks

The hook callbacks passed into `conversationLoop()`.

**Location**: `src/ai/conversation.ts`

**Interface** (structurally unchanged, but semantically simplified):

| Callback | Signature | Current Behavior | Refactored Behavior |
|---|---|---|---|
| `onAssistantMessage` | `(content: AiContentBlock[]) => Promise<void>` | Saves assistant message to DB | Unchanged (still saves to DB) |
| `onBeforeToolExecution` | `(toolUseBlocks: AiToolUseBlock[]) => Promise<void>` | Tracks pending names, emits `tool_start` event, logs | **Removed event emission**; still logs |
| `onAfterToolExecution` | `(results: AiToolResultBlockParam[]) => Promise<void>` | Emits `tool_end` event, saves tool results to DB | **Removed event emission**; still saves to DB |
| `onTruncated` | `() => void` | Placeholder | Unchanged |

**Key design principle**: Hooks are now "pure domain callbacks" — they handle DB persistence and application-specific side effects only. Event emission is a framework concern moved into `conversationLoop` itself.

---

## LessonGenerator.runConversation (method)

**Location**: `src/lessons/generator.ts`, private method

**Current behavior**:
- Maintains `pendingToolNames` (duplicated from `createStandardHooks`)
- Emits `tool_start`/`tool_end` via `events?.emit()` (duplicated from `createStandardHooks`)
- Pushes tool labels to `job.messages` (domain-specific, NOT duplicated)

**Refactored behavior**:
- `pendingToolNames` and `events?.emit()` calls **removed**
- `job.messages.push(label)` **kept** in `onBeforeToolExecution` — this is the domain-specific behavior unique to `LessonGenerator`
- Event emission comes from `conversationLoop` via the `events` field on `ConversationLoopParams`

---

## Event Flow (post-refactor)

```
conversationLoop (src/ai/conversation.ts)
│
├─ [NEW] events?.emit(missionId, { type: "tool_start", names: [...] })
│
├─ hooks?.onBeforeToolExecution(toolUseBlocks)
│   ├─ createStandardHooks: logger.debug(...) ONLY
│   └─ LessonGenerator: job.messages.push(label) ONLY
│
├─ toolExecutor.executeToolCalls(missionId, toolUseBlocks)
│
├─ hooks?.onAfterToolExecution(results)
│   ├─ createStandardHooks: saveMessage(missionId, "user", results) ONLY
│   └─ LessonGenerator: (no-op or empty)
│
└─ [NEW] events?.emit(missionId, { type: "tool_end", names: [...] })
```
