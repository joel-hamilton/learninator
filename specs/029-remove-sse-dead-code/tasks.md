---

description: "Task list for removing SSE dead code"

---

# Tasks: Remove SSE Dead Code

**Input**: Design documents from `/Users/joel/Sites/learninator/specs/029-remove-sse-dead-code/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by logical dependency order. Since all three user stories involve removing different parts of the same dead code, the phases proceed sequentially: simplify the event bus core, remove the endpoint and stubs, update tests, and verify.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed. All changes are deletions and simplifications to existing files.

No tasks for this phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Simplify the event bus interfaces and implementation in `src/ai/events.ts`. This is the central change — all other files depend on having the simplified types available.

- [X] T001 Simplify `ToolEventBus` and `WorkflowEventBus` interfaces in `src/ai/events.ts`:
  - Remove `subscribe(missionId, cb): () => void` from `ToolEventBus`
  - Remove `subscribeUser(userId, cb): () => void` from `WorkflowEventBus`
  - Remove `type ToolEventCallback`
  - Keep `WorkflowEventCallback` (still used by `userSubscribers`)
- [X] T002 [P] Simplify `createEventBus` implementation in `src/ai/events.ts`:
  - Remove the `subscribers` Map (tool event subscribers — never populated)
  - Remove the `subscribe` function
  - Remove the `subscribeUser` function
  - Keep the `userSubscribers` Map and `emitUser` function
  - Keep the `emit` function (no-op body is fine; `ToolEvent` type stays)
  - Return only `{ emit, emitUser }`
- [X] T003 [P] Update `AppVariables.events` type in `src/types.ts`:
  - The import still references `ToolEventBus` and `WorkflowEventBus` from `src/ai/index.ts` — no import change needed
  - The `events` field type remains `ToolEventBus & WorkflowEventBus` — no type change needed (the interfaces were simplified in-place)
- [X] T004 Clean up re-exports in `src/ai/index.ts`:
  - Keep `export { createEventBus } from "./events.js"`
  - Keep `export type { ToolEventBus, WorkflowEventBus, ToolEvent, WorkflowEvent } from "./events.js"`
  - No export changes needed unless types were removed

**Checkpoint**: Foundation ready — event bus simplified, no compilation errors. All consumers (WorkflowStateManager, conversation.ts) still see the methods they need.

---

## Phase 3: User Story 1 - Remove SSE Endpoint and No-op Stubs (Priority: P1)

**Goal**: Remove the dead SSE endpoint (`GET /workflows/events`) from `src/routes/home.ts` and the four no-op client stubs from `src/shared/sse-poller.ts`. These are unreachable code left from the ADR-0003 SSE-to-polling migration.

**Independent Test**: Grep the source tree for the removed symbols and confirm zero matches. The polling endpoint `GET /workflows/state` must still return 200.

- [X] T005 [US1] Remove the SSE endpoint handler at `src/routes/home.ts` lines 150-187:
  - Remove the `homeRoutes.get("/workflows/events", ...)` route handler
  - This removes the only non-test caller of `WorkflowEventBus.subscribeUser`
  - Do NOT remove any other routes or imports that are still needed
- [X] T006 [US1] Remove the four no-op client stubs in `src/shared/sse-poller.ts` lines 83-95:
  - Remove the `addWorkflow` function (empty body, SSE leftover)
  - Remove the `updateStep` function (empty body, SSE leftover)
  - Remove the `markComplete` function (empty body, SSE leftover)
  - Remove the `markError` function (empty body, SSE leftover)
  - Do NOT modify the polling logic (`fetchState`, `renderAll`, `render`, `startPolling`, etc.)

**Checkpoint**: At this point, the dead SSE code is gone. The polling-based progress path is untouched.

---

## Phase 4: User Story 2 - Update Tests for Simplified Event Bus (Priority: P1)

**Goal**: Update test files to match the simplified event bus interfaces. All tests must continue to pass with the same behavior.

**Independent Test**: `npm test` passes with zero failures and the same test count.

- [X] T007 [P] [US2] Update `src/test/conversation.test.ts`:
  - Replace calls to `createEventBus()` with a simpler test construction (remove `subscribe` usage)
  - Update `ToolEvent[]` assertions if needed
  - The test currently subscribes to the event bus and collects events — adapt to use `emit` directly or use a spy
- [X] T008 [P] [US2] Update `src/test/generator.test.ts`:
  - `FakeEventBus` class implements `ToolEventBus` — remove the `subscribe` method implementation
  - Remove imports of removed symbols if any
  - Keep `emit` method
- [X] T009 [US2] Update `src/lessons/generator.test.ts`:
  - Remove `createEventBus` import and usage if it only used subscribe
  - Or keep if it only uses `emit`

**Checkpoint**: All tests pass. Test doubles no longer implement `subscribe`.

---

## Phase 5: User Story 3 - Verification and Polish (Priority: P1)

**Goal**: Verify the removal is complete with no regressions. Confirm the polling-based workflow progress indicator still functions correctly.

**Independent Test**: Run `npx tsc --noEmit` + `npm test`. Then start the dev server and manually verify the progress indicator works during lesson generation.

- [X] T010 [P] [US3] Run TypeScript compilation check:
  ```bash
  npx tsc --noEmit
  ```
  Expected: zero compilation errors.
- [X] T011 [P] [US3] Run full test suite:
  ```bash
  npm test
  ```
  Expected: all tests pass, same test count as before removal.
- [X] T012 [P] [US3] Grep verification — confirm no references to removed symbols remain in non-test source:
  ```bash
  grep -rn "\.subscribe(" src/ --include="*.ts" | grep -v "\.test\." | grep -v node_modules
  grep -rn "subscribeUser" src/ --include="*.ts" | grep -v "\.test\." | grep -v node_modules
  grep -rn "/workflows/events" src/ --include="*.ts" | grep -v node_modules
  grep -n "addWorkflow\|updateStep\|markComplete\|markError" src/shared/sse-poller.ts
  ```
  Expected: all return empty (no matches).
- [X] T013 [US3] Manual smoke test:
  - Start the dev server (`npm run dev`)
  - Sign in as a user
  - Navigate to a mission
  - Initiate lesson generation
  - Confirm the workflow progress indicator shows "Generating..."
  - Confirm `GET /workflows/state` returns expected data
  - Confirm `GET /workflows/events` returns 404

**Checkpoint**: Clean removal verified. No regressions. Progress indicator still works.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — no tasks needed
- **Foundational (Phase 2)**: No dependencies — can start immediately. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 completion (needs simplified interfaces, but changes are in different files — could technically run in parallel)
- **US2 (Phase 4)**: Depends on Phase 2 completion (tests import from simplified event bus)
- **US3 (Phase 5)**: Depends on Phases 3 and 4 completion (verification requires all removals and test updates)

### Parallel Opportunities

- T002, T003 can run in parallel (different files: events.ts and types.ts)
- T005, T006 can run in parallel (different files: home.ts and sse-poller.ts)
- T007, T008 can run in parallel (different test files)
- T010, T011, T012 can all run in parallel (compilation, tests, grep)

---

## Parallel Example: Phase 2

```bash
# Simplify interfaces and implementation in events.ts:
T001 + T002: Edit src/ai/events.ts to remove subscribe, subscribeUser, ToolEventCallback, and simplify createEventBus

# Update types.ts in parallel:
T003: Edit src/types.ts (may need no changes if types are re-exported as-is)
```

---

## Implementation Strategy

### Single Commit Strategy

This is a focused cleanup — all changes can be done in a single commit:

1. Complete Phase 2: Simplify event bus interfaces and implementation
2. Complete Phase 3: Remove SSE endpoint and no-op stubs
3. Complete Phase 4: Update test files
4. Complete Phase 5: Verification (compile, test, grep, smoke test)

### Verification First

Since this is deletion-only, the safest order is:
1. Simplify the types (so everything still compiles)
2. Remove the endpoint and stubs
3. Update tests
4. Run full test suite
5. Manual verification
