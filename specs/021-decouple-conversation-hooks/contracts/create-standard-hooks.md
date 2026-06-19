# Contract: createStandardHooks

**Location**: `src/ai/conversation.ts`  
**Export name**: `createStandardHooks`  
**Signature**: `function createStandardHooks(deps: StandardHooksDeps): ConversationHooks`

---

## Purpose

Factory function that produces a `ConversationHooks` object for standard chat flows. After refactoring, it handles ONLY database persistence — no event emission.

---

## Input Contract

### StandardHooksDeps (refactored)

```typescript
interface StandardHooksDeps {
  missionId: number;
  store: ChatStore;
  logger?: Pick<Logger, "debug">;
}
```

**REMOVED**: `emit?: (missionId: number, event: ToolEvent) => void`  
**REMOVED**: Internal `pendingToolNames: string[]` tracking

---

## Output Contract

### ConversationHooks (refactored behavior)

| Hook | Behavior |
|---|---|
| `onAssistantMessage` | `saveMessage(store, missionId, "assistant", content)` — unchanged |
| `onBeforeToolExecution` | `logger.debug(...)` — event emission **removed**, logging only |
| `onAfterToolExecution` | `saveMessage(store, missionId, "user", results)` — event emission **removed**, DB save only |
| `onTruncated` | `undefined` (no-op) — unchanged |

---

## All Callers (unchanged invocations)

| Caller | File | What changes |
|---|---|---|
| `mission-chat.service.ts` | `src/services/mission-chat.service.ts` | Removes `emit:` from deps. Adds `events:` to `conversationLoop` params. |
| Any other `createStandardHooks` callers | N/A | All existing callers continue to work. |

---

## Test Assertions

- `createStandardHooks` does NOT reference `emit`, `pendingToolNames`, or any event-related code
- The returned hooks only perform DB operations via `saveMessage` and logging via `logger`
- No event emission side effects from invoking the returned hooks
