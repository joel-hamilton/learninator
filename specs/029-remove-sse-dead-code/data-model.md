# Data Model: Remove SSE Dead Code

No data model changes. This feature removes runtime code only — no schema, migration, store interface, or database table changes are needed.

## Event Bus Types (simplified)

The following interfaces are simplified but remain in `src/ai/events.ts`:

### ToolEventBus (simplified)
- **Removed**: `subscribe(missionId, callback)` — zero callers
- **Kept**: `emit(missionId, event)` — called from `conversation.ts`

### WorkflowEventBus (simplified)
- **Removed**: `subscribeUser(userId, callback)` — single caller was the SSE endpoint
- **Kept**: `emitUser(userId, event)` — called from `WorkflowStateManager`

### createEventBus (simplified)
- **Removed internal state**: `subscribers` Map (tool event subscriptions, never populated)
- **Kept internal state**: `userSubscribers` Map (workflow event subscriptions, used by WorkflowStateManager)
- **Removed functions**: `subscribe`, `subscribeUser`
- **Kept functions**: `emit`, `emitUser`

### Removed types
- `ToolEventCallback` — only used by the removed `subscribe` method
- Kept: `WorkflowEventCallback` — still used by `userSubscribers` internal Map
