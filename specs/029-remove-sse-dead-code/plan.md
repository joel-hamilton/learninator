# Implementation Plan: Remove SSE Dead Code

**Branch**: `029-remove-sse-dead-code` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/Users/joel/Sites/learninator/specs/029-remove-sse-dead-code/spec.md`

## Summary

Remove dead code left behind after ADR-0003 chose polling over SSE for workflow progress visibility. The SSE endpoint (`/workflows/events`), its backing `subscribeUser`/`subscribe` event bus methods, and four no-op client stubs in the SSE poller script are unreachable code. Removing them reduces maintenance surface, eliminates misleading code paths, and trims dead logic plus associated type scaffolding.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (lightweight web framework), htmx (frontend interactivity)

**Storage**: Not affected — no schema changes, no data migration

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`, `FakeAiClient`

**Target Platform**: Linux server (Docker), macOS dev

**Project Type**: Multi-user AI tutoring web app (Node.js, single repo)

**Performance Goals**: Not applicable — removing dead code has negligible performance impact beyond eliminating an unused SSE keep-alive timer.

**Constraints**: 
- Must not break the active polling-based progress path (`GET /workflows/state`)
- Must not modify `WorkflowStateManager` (it's the active path)
- Must not modify the client-side polling logic in `sse-poller.ts`
- All existing tests must pass without modification to test behavior

**Scale/Scope**: Single commit, ~5 files touched, ~60 lines removed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | PASS | No new factory changes needed; the event bus is already wired via `createApp()` factory and will continue to be. |
| II. HTTP-Level Integration Testing | PASS | Tests exercise `/workflows/state` polling endpoint, not the removed SSE endpoint. No test behavior changes needed. |
| III. Hypermedia-Driven Frontend | PASS | The polling-based progress indicator uses htmx-compatible server-rendered HTML. SSE was never the active frontend path. |
| IV. Explicit Dependency Injection | PASS | The event bus will still be injected via `c.set("events", ...)` — only the shape of the injected object changes (smaller interface). |
| V. Migration Snapshot Integrity | NOT APPLICABLE | No schema changes. |
| YAGNI — no speculative features | ALIGNED | Keeping dead code violates YAGNI. Removing it brings the codebase in line with this principle. |

**GATE verdict**: PASS — no violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/029-remove-sse-dead-code/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```
src/
├── routes/
│   └── home.ts          # REMOVE: /workflows/events SSE endpoint (lines 150-187)
├── shared/
│   └── sse-poller.ts    # REMOVE: 4 no-op client stubs (lines 83-95)
├── ai/
│   ├── events.ts        # REMOVE: subscribe, subscribeUser; simplify createEventBus
│   └── index.ts         # REMOVE: re-exports of removed types
├── types.ts             # UPDATE: AppVariables.events type
└── index.ts             # No import changes needed (createEventBus stays)
```

**No new files created. No new directories needed.**

## Complexity Tracking

Not applicable — no constitution violations to justify. This is a pure deletion task.

## Phase 0: Research

Research is minimal because the codebase analysis is already complete and documented in the spec. All unknowns have been resolved by source analysis:

### Findings consolidated (research.md)

#### Decision: Remove `ToolEventBus.subscribe`
- **Why**: Zero callers in non-test source code. Only callers are test files, which can be updated to the simplified interface.
- **Evidence**: `grep -rn "\.subscribe(" src/ --include="*.ts"` returns only the definition in `events.ts` and test files.
- **Keep**: `ToolEventBus.emit` — still called from `conversation.ts` lines 151 and 163.

#### Decision: Remove `WorkflowEventBus.subscribeUser`
- **Why**: Single caller is the SSE endpoint being removed (home.ts line 159). No other non-test callers exist.
- **Evidence**: `grep -rn "subscribeUser" src/ --include="*.ts"` returns only the definition in `events.ts` and one call in `home.ts`.
- **Keep**: `WorkflowEventBus.emitUser` — still called from `WorkflowStateManager` in 4 locations.

#### Decision: Remove SSE endpoint `GET /workflows/events`
- **Why**: ADR-0003 chose polling over SSE. The endpoint is unreachable from the client (no htmx trigger or JS fetch targets it).
- **Evidence**: The client-side `sse-poller.ts` uses only `fetch("/workflows/state")` — the SSE path was never migrated to.
- **Keep**: Polling endpoint `GET /workflows/state` and its client-side polling loop.

#### Decision: Remove 4 no-op client stubs
- **Why**: `addWorkflow`, `updateStep`, `markComplete`, `markError` are declared but never called from any code path. Their comments acknowledge they are SSE leftovers.
- **Evidence**: Each function body is empty or no-op.

#### Decision: Simplify `createEventBus` to `{ emit, emitUser }`
- **Why**: After removing `subscribe` and `subscribeUser`, the factory returns only the two `emit` methods. The internal `subscribers` Map (for ToolEvent subscriptions) can be removed entirely. Only `userSubscribers` Map needs to remain (for WorkflowEventBus.emitUser).

#### Decision: Keep `ToolEvent` and `WorkflowEvent` types
- **Why**: Still referenced by `emit`, `emitUser` callers, test code, and the `WorkflowStateManager`.

## Phase 1: Design & Contracts

### Data Model

No data model changes. The event bus is a runtime wiring concern, not a persisted entity. No schema, migration, or store changes needed.

The simplified type contracts are:

#### Simplified `ToolEventBus`

```typescript
export interface ToolEventBus {
  emit(missionId: number, event: ToolEvent): void;
}
```

Remove: `subscribe(missionId: number, cb: ToolEventCallback): () => void;`

#### Simplified `WorkflowEventBus`

```typescript
export interface WorkflowEventBus {
  emitUser(userId: number, event: WorkflowEvent): void;
}
```

Remove: `subscribeUser(userId: number, cb: WorkflowEventCallback): () => void;`

#### Simplified `createEventBus`

```typescript
export function createEventBus(): ToolEventBus & WorkflowEventBus {
  const userSubscribers = new Map<number, Set<WorkflowEventCallback>>();

  function emit(missionId: number, event: ToolEvent): void {
    // No subscribers remain for ToolEvent — this is a no-op.
    // (Method kept for interface compatibility.)
  }

  function emitUser(userId: number, event: WorkflowEvent): void {
    // ... same as current implementation ...
  }

  return { emit, emitUser };
}
```

Note: Since `ToolEventBus.emit` has no subscribers after removing `ToolEventBus.subscribe`, the `emit` method becomes a no-op. It is kept for interface compatibility since `conversation.ts` calls `events?.emit(...)` and changing every caller to a conditional would be more invasive.

### Contracts

No external contracts change. The internal interfaces `ToolEventBus` and `WorkflowEventBus` shrink, but their types are consumed only within the project.

### Quickstart Validation

After implementing the removal:

1. Run `npm test` — all tests must pass.
2. Run `npx tsc --noEmit` — no compilation errors.
3. Start the app with `npm run dev` and verify the workflow progress indicator works:
   - Sign in as a user
   - Go to a mission
   - Initiate lesson generation
   - Confirm the progress bar in the header shows "Generating..." status
   - Confirm `GET /workflows/state` returns expected data
4. Grep for removed symbols to confirm no references remain:
   ```bash
   grep -rn "subscribe\b" --include="*.ts" src/ | grep -v "\.test\." | grep -v node_modules
   grep -rn "subscribeUser" --include="*.ts" src/ | grep -v "\.test\." | grep -v node_modules
   grep -rn "addWorkflow\|updateStep\|markComplete\|markError" --include="*.ts" src/shared/sse-poller.ts
   grep -rn "/workflows/events" --include="*.ts" src/
   ```
   All should return empty (or only match definitions we intentionally keep).
