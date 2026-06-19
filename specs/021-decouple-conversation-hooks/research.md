# Research: Decouple Conversation Hooks

## Unknown 1: EventBus integration point in conversationLoop

**Decision**: Inject `events` as an optional field on `ConversationLoopParams`. Emit `tool_start` immediately before `hooks?.onBeforeToolExecution(...)` and emit `tool_end` immediately after `hooks?.onAfterToolExecution(...)`. This preserves the current ordering: event fires, then hook runs (or vice versa for post-execution).

**Rationale**: The current code has event emission inside hook callbacks (`createStandardHooks` and `LessonGenerator` both emit inside `onBeforeToolExecution`/`onAfterToolExecution`). Moving the emit calls to `conversationLoop` adjacent to the hook calls (not replacing them) keeps the temporal order: tool_start event -> hook's onBeforeToolExecution -> tool execution -> hook's onAfterToolExecution -> tool_end event. This ordering is not user-visible since SSE events and DB saves are asynchronous from the client's perspective, but it keeps the code logically grouped.

**Alternatives considered**:
- Emit inside hooks? That's the current design and the one being refactored away.
- Replace hook calls entirely? No, hooks still carry domain logic (DB saves, job.messages updates).

## Unknown 2: Error handling for event emission

**Decision**: No special error handling needed in `conversationLoop`. `EventBus.emit()` (from `src/ai/events.ts`) already catches and swallows all subscriber errors:

```typescript
function emit(missionId: number, event: ToolEvent): void {
  const subs = subscribers.get(missionId);
  if (!subs || subs.size === 0) return;  // silent no-op if no subscribers
  subs.forEach((cb) => {
    try {
      const result = cb(event);
      if (result instanceof Promise) {
        result.catch(() => {}); // swallow subscriber errors
      }
    } catch {
      // swallow subscriber errors
    }
  });
}
```

If the `events` field is `undefined`, `conversationLoop` simply skips the emit calls via optional chaining (`events?.emit(...)`). There is no crash path.

**Rationale**: The existing `EventBus` is already defensive. Adding a try/catch wrapper in `conversationLoop` would be redundant — the spec requirement (FR-011) is already satisfied by the EventBus implementation.

## Unknown 3: Tool display name resolution in conversationLoop

**Decision**: `conversationLoop` will use `TOOL_DISPLAY_NAMES` (already imported in `conversation.ts` on line 16) to resolve display names before emitting events. The event payload matches the current shape: `{ type: "tool_start", names: displayNames[] }`.

```typescript
// Inside conversationLoop, around tool execution:
const displayNames = toolUseBlocks.map(
  (b) => TOOL_DISPLAY_NAMES[b.name] || b.name
);
events?.emit(missionId, { type: "tool_start", names: displayNames });
// ... execute tools ...
events?.emit(missionId, { type: "tool_end", names: displayNames });
```

**Rationale**: The current callers both derive display names via `TOOL_DISPLAY_NAMES`. Since `conversationLoop` already imports this module (for other purposes), there is no new dependency. The display name is the canonical value used by SSE subscribers (e.g., the job progress UI).

**Alternatives considered**:
- Move display name resolution into `EventBus` layer? Breaks separation of concerns — the event bus is a generic pub/sub, not a presentation layer.
- Use raw tool names? Would require UI changes to display `create_lesson` as "Create Lesson". Unnecessary churn.

## Unknown 4: Backward compatibility with mission-chat.service.ts

**Decision**: After the refactor:

1. `createStandardHooks()` signature changes from `(deps: StandardHooksDeps)` to `(deps: Omit<StandardHooksDeps, 'emit'>)` or a new simpler interface.
2. `mission-chat.service.ts`'s call to `createStandardHooks({ missionId, store, emit: events.emit.bind(events), logger })` becomes `createStandardHooks({ missionId, store, logger })`.
3. The `hooks` spread with `onBeforeToolExecution` override continues to work — it will still track `didActivate` for `mark_mission_active` and call `workflowState.stepUpdate`. The events that were previously emitted here now come from `conversationLoop` instead.
4. `conversationLoop` itself is called with an additional `events` parameter (the EventBus instance from `MissionChatDeps`).

**Rationale**: The override in `mission-chat.service.ts` calls `await stdHooks.onBeforeToolExecution!(toolUseBlocks)` first, which after the refactor will only log (no event emission). The override then checks `mark_mission_active` and calls `workflowState.stepUpdate`. This domain logic is separate from event emission and belongs in the service layer.

## Unknown 5: Test isolation for event verification

**Decision**: A new test file `src/test/conversation.test.ts` (or inline in an existing test) will use a real `EventBus` created via `createEventBus()`, subscribe to a mission ID, and verify that the callback is invoked with correct events after a `conversationLoop` call.

**Test pattern**:

```typescript
import { createEventBus } from "../ai/events.js";
import { conversationLoop } from "../ai/conversation.js";

const events = createEventBus();
const received: ToolEvent[] = [];
events.subscribe(42, (e) => received.push(e));

await conversationLoop({
  // ... minimal params with FakeAiClient returning tool_use blocks ...
  events,  // new field
});

expect(received).toHaveLength(2);
expect(received[0].type).toBe("tool_start");
expect(received[1].type).toBe("tool_end");
```

**Rationale**: No SSE infrastructure needed — just verify that the `emit` calls happen. The `FakeAiClient` can be configured to return tool_use responses in queue. This follows the existing testing patterns (in-memory, no HTTP binding, deterministic).

**Alternatives considered**:
- End-to-end test with real SSE stream? Overkill for this refactor.
- Mock the EventBus? Unnecessary — `createEventBus()` has no side effects.
