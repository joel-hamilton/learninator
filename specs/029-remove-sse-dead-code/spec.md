# Feature Specification: Remove SSE Dead Code

**Feature Branch**: `029-remove-sse-dead-code`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: ADR-0003 chose polling over SSE for workflow progress, but the SSE endpoint, WorkflowEventBus subscribe/emit machinery, ToolEventBus (emits with 0 subscribers), and 4 client-side SSE stubs remain as dead code. Remove them all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developers can maintain the codebase without dead-code confusion (Priority: P1)

A developer working on the workflow progress system or event bus reads the code and encounters no unreachable code paths, no no-op stubs, and no subscribe methods that have zero callers. Every exported function and endpoint in the events/wiring layer is actively used, making the system's architecture self-documenting.

**Why this priority**: Dead code creates cognitive load — every developer must either trace callers to discover something is unused, or risk making changes to code that has no effect. Removing it reduces maintenance overhead and eliminates the risk of someone building on top of a defunct SSE path.

**Independent Test**: After removal, grep the entire non-test source tree for the removed symbols (`subscribe`, `subscribeUser`, `addWorkflow`, `updateStep`, `markComplete`, `markError`, the SSE endpoint route) and confirm zero matches. Run the full test suite and confirm no regressions.

**Acceptance Scenarios**:

1. **Given** the SSE endpoint at `GET /workflows/events` exists in the codebase,
   **When** the removal is complete,
   **Then** the endpoint is removed — no route handler for `/workflows/events` exists.
2. **Given** the four no-op client stubs (`addWorkflow`, `updateStep`, `markComplete`, `markError`) exist in `sse-poller.ts`,
   **When** the removal is complete,
   **Then** these stub functions are removed from the source.
3. **Given** `ToolEventBus.subscribe` exists in the event bus implementation,
   **When** the removal is complete,
   **Then** `subscribe` is removed from the `ToolEventBus` interface, its implementation, and any imports/exports referencing it.

---

### User Story 2 - Developer can verify the event bus still works through WorkflowStateManager (Priority: P1)

The `WorkflowStateManager` continues to emit workflow events via `emitUser` to the polling-based progress indicator. The event bus interface and implementation are simplified to only what's needed — `ToolEventBus.emit` and `WorkflowEventBus.emitUser` — while remaining compatible with existing consumers.

**Why this priority**: WorkflowStateManager is the active path for progress indication. Breaking it would regress the user-facing lesson generation progress bar. This story ensures the surgery is safe.

**Independent Test**: Start a workflow (e.g., lesson generation) and confirm the polling endpoint `GET /workflows/state` returns active workflow data. No subscribe/SSE machinery is needed for this to work.

**Acceptance Scenarios**:

1. **Given** a lesson generation workflow is started,
   **When** the generation proceeds through steps,
   **Then** `GET /workflows/state` returns the correct workflow status after each step, confirming `WorkflowStateManager` still emits events correctly.
2. **Given** the event bus has been simplified,
   **When** `conversationLoop` runs tool calls,
   **Then** `ToolEventBus.emit` still fires tool_start/tool_end events.

---

### User Story 3 - Tests continue to pass without the removed code (Priority: P1)

The test suite is updated to stop relying on removed event bus features (`subscribe`, `createEventBus` in its current form). Tests that need to verify event emission use a compatible interface that only requires `emit`.

**Why this priority**: Regressions in test code are still regressions. Tests must remain green after the removal.

**Independent Test**: Run `npm test` and confirm all existing tests pass.

**Acceptance Scenarios**:

1. **Given** the test suite contains tests that call `createEventBus()` or `ToolEventBus.subscribe`,
   **When** the removal removes `subscribe` from `ToolEventBus`,
   **Then** the test suite is updated to match the simplified interface and all tests pass.

---

### Edge Cases

- What if some external code (not tracked in this repo) depends on `ToolEventBus.subscribe` or `WorkflowEventBus.subscribeUser`? We verify there are zero callers in the entire source tree.
- What if removing a code path triggers a TypeScript compilation error due to an interface mismatch? We update the types to match the simplified implementation.
- What if `WorkflowEventBus.emitUser` is later found to be unnecessary (WorkflowStateManager could work without it)? This removal is scoped strictly to what is known dead — `emitUser` remains until a future cleanup proves it dead.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SSE endpoint `GET /workflows/events` MUST be removed from `src/routes/home.ts`.
- **FR-002**: The four no-op client stubs `addWorkflow`, `updateStep`, `markComplete`, and `markError` MUST be removed from `src/shared/sse-poller.ts`.
- **FR-003**: The `subscribe` method MUST be removed from the `ToolEventBus` interface and its implementation in `createEventBus`.
- **FR-004**: The `subscribeUser` method MUST be removed from the `WorkflowEventBus` interface and its implementation in `createEventBus`.
- **FR-005**: The `createEventBus` function MUST be simplified to produce only an object with `emit` and `emitUser` methods.
- **FR-006**: The `AppVariables.events` type in `src/types.ts` MUST be updated to use the simplified event bus interfaces.
- **FR-007**: All imports and re-exports of the removed symbols from `src/ai/index.ts`, `src/types.ts`, and `src/index.ts` MUST be cleaned up.
- **FR-008**: All test files importing or using removed symbols MUST be updated to use the simplified interfaces.
- **FR-009**: The `WorkflowStateManager` MUST continue to work as before, still receiving and calling `emitUser` on the event bus.
- **FR-010**: The polling endpoint `GET /workflows/state` MUST NOT be modified.
- **FR-011**: The client-side polling logic in `sse-poller.ts` that calls `/workflows/state` MUST NOT be modified.
- **FR-012**: The full test suite MUST pass after all removals are complete.

### Key Entities

- **ToolEventBus**: Interface with `emit` (keep) and `subscribe` (remove). Used by `conversationLoop` to emit tool_start/tool_end events.
- **WorkflowEventBus**: Interface with `emitUser` (keep) and `subscribeUser` (remove). Used by `WorkflowStateManager` to emit workflow lifecycle events.
- **SSE Endpoint**: `GET /workflows/events` in `home.ts` — the only consumer of `subscribeUser`. Removed entirely.
- **Client stubs**: Four unused functions in the `sse-poller` script that were placeholders for SSE event handling. Removed entirely.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of the removed symbols (`subscribe`, `subscribeUser`, `addWorkflow`, `updateStep`, `markComplete`, `markError`, `/workflows/events` route) remain in non-test source code after removal.
- **SC-002**: The full test suite (`npm test`) passes with zero failures and zero changes to test behavior (same number of passing tests).
- **SC-003**: The workflow progress indicator continues to function correctly: `GET /workflows/state` returns active workflows and the client polls as expected.
- **SC-004**: No compilation errors (TypeScript `tsc`) after all removals and type simplifications.
- **SC-005**: Lines of code removed exceeds 15 across the files touched.

## Assumptions

- The only callers of `ToolEventBus.subscribe` are test files, which will be updated to use a simpler test double.
- The only caller of `WorkflowEventBus.subscribeUser` is the SSE endpoint being removed, making it safe to remove entirely.
- `WorkflowStateManager`'s calls to `emitUser` are the only reason to keep `WorkflowEventBus.emitUser` — and those calls are essential for the polling path.
- The `ToolEvent` and `WorkflowEvent` types are still referenced by `emit`/`emitUser` callers and must be preserved.
- No other feature branch in flight depends on the SSE endpoint or `subscribe` — this removal is safe to merge independently.
