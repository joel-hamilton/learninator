# Research: Remove SSE Dead Code

## Unknowns Resolved

### 1. Is `ToolEventBus.subscribe` called anywhere in non-test code?
**Finding**: No. Only the definition in `events.ts` and test files reference `subscribe`. The `conversation.ts` file uses only `emit`. The `generator.ts` imports the type but never calls `subscribe`.
**Action**: Remove `subscribe` from the interface and implementation.

### 2. Is `WorkflowEventBus.subscribeUser` called anywhere in non-test code?
**Finding**: Single caller is the SSE endpoint in `home.ts` line 159 — which is being removed. No other callers.
**Action**: Remove `subscribeUser` from the interface and implementation.

### 3. Are the 4 no-op stubs in `sse-poller.ts` referenced externally?
**Finding**: No. `addWorkflow`, `updateStep`, `markComplete`, `markError` are declared as local `function` declarations within an IIFE. They are not attached to `window` or exported. They are unreachable dead code.
**Action**: Remove the four function declarations and their bodies.

### 4. Does anything call `GET /workflows/events`?
**Finding**: No client-side code references this endpoint. The polling script uses only `GET /workflows/state`. No htmx attribute or JS `fetch` targets `/workflows/events`.
**Action**: Remove the route handler and its `streamSSE` + keep-alive logic.

### 5. Can `createEventBus` be simplified?
**Finding**: Yes. After removing `subscribe` and `subscribeUser`, the internal `subscribers` Map (tool event subscribers) has no callers. The `emit` method iterates over an empty set, making it a no-op. The `userSubscribers` Map is still needed for `emitUser` calls from `WorkflowStateManager`.
**Action**: Remove `subscribers` Map, `subscribe` function, and `subscribeUser` function. Keep `emit`, `emitUser`, and `userSubscribers`.

### 6. Is `ToolEventBus` type still needed?
**Finding**: Yes — `conversation.ts` passes `events` parameter typed as `ToolEventBus` and calls `emit()`. `generator.ts` and `mission-chat.service.ts` also reference the type. But the interface can be simplified to only `emit`.
**Action**: Simplify `ToolEventBus` interface to only contain `emit`.

### 7. Is `WorkflowEventBus` type still needed?
**Finding**: Yes — `WorkflowStateManager` takes it as a constructor parameter and calls `emitUser()`. `mission-chat.service.ts` also references it via the combined type.
**Action**: Simplify `WorkflowEventBus` interface to only contain `emitUser`.

### 8. Are `ToolEventCallback` and `WorkflowEventCallback` types still needed?
**Finding**: `ToolEventCallback` is only used by `subscribe` — remove it. `WorkflowEventCallback` is used by the `userSubscribers` Set in `createEventBus` — keep it.
**Action**: Remove `ToolEventCallback` type. Keep `WorkflowEventCallback` type.

### 9. What about test files referencing removed symbols?
**Finding**: `src/test/conversation.test.ts` imports `createEventBus` and `ToolEvent`, calls `createEventBus()`, and calls `.subscribe()` on the result. `src/test/generator.test.ts` imports `ToolEventBus`, `ToolEvent`, and `createEventBus`, and implements `FakeEventBus` with `subscribe` and `emit`.
**Action**: Update test files to use the simplified interfaces. Replace `subscribe` usage in test `FakeEventBus` with just `emit`. Remove `subscribe` from test spy implementations.
