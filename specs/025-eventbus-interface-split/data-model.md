# Data Model: EventBus Interface Split

## Type Interfaces

### ToolEventBus (mission-scoped)

```typescript
interface ToolEventBus {
  subscribe(missionId: number, cb: ToolEventCallback): () => void;
  emit(missionId: number, event: ToolEvent): void;
}
```

- **Purpose**: Track tool execution progress within a specific mission context
- **Callback type**: `ToolEventCallback = (event: ToolEvent) => void | Promise<void>`
- **Event type**: `ToolEvent { type: "tool_start" | "tool_end"; names: string[] }`
- **Scoping**: By `missionId` — each subscription is bound to a specific mission

### WorkflowEventBus (user-scoped)

```typescript
interface WorkflowEventBus {
  subscribeUser(userId: number, cb: WorkflowEventCallback): () => void;
  emitUser(userId: number, event: WorkflowEvent): void;
}
```

- **Purpose**: Track workflow lifecycle (start/step/complete/error) for a specific user
- **Callback type**: `WorkflowEventCallback = (event: WorkflowEvent) => void | Promise<void>`
- **Event type**: `WorkflowEvent { event: "workflow_start" | "workflow_step" | "workflow_complete" | "workflow_error"; workflowId: string; ... }`
- **Scoping**: By `userId` — each subscription is bound to a specific user (site-wide indicator)

### Intersection type (for consumers needing both)

```typescript
type EventBus = ToolEventBus & WorkflowEventBus;
```

Used by:
- `AppVariables.events` in `src/types.ts`
- `MissionChatDeps.events` in `mission-chat.service.ts`
- `createEventBus()` return type

## No runtime data model changes

- No new tables, columns, or database entities
- No API changes
- No frontend changes
- No configuration changes

## State transitions

No state model changes. The runtime implementation (separate `Map` objects for tool vs. workflow subscribers) remains identical.
