# Tasks: Route Generator Through Store Seam

**Input**: Design documents from `/specs/014-generator-through-store-seam/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included — US4 explicitly requires generator unit tests; US5 requires running the existing suite.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Current state**: Implementation (US1, US2, US3) is complete. TypeScript compiles clean. All 228 existing tests pass. Remaining work: generator unit tests (US4) and final verification (US5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm project state — all infrastructure exists, no new setup needed

- [X] T001 Verify TypeScript compiles with `npx tsc --noEmit`
- [X] T002 [P] Verify no Drizzle imports remain in `src/lessons/generator.ts` via `grep -E "drizzle-orm|from.*schema"`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify the refactored `GeneratorDeps` and `runGenerationJob` are correctly wired before adding tests

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Verify `GeneratorDeps` interface in `src/lessons/generator.ts` contains `store: MissionStore` and `events: EventBus` (not `db: any` or module-level `emit` import)
- [X] T004 Verify `createApp()` in `src/index.ts` passes `store` and `events: eventBus` to `createLessonGenerator()` (not raw `db`)

**Checkpoint**: Foundation ready — new unit tests can now be written against the refactored generator

---

## Phase 3: User Story 1 - Generator Uses MissionStore Instead of Raw Drizzle (Priority: P1) 🎯 MVP

**Goal**: Generator depends on `MissionStore` interface, not raw Drizzle. Schema changes only require store updates.

**Independent Test**: Instantiate `LessonGenerator` with `InMemoryMissionStore`, call all four generation methods, verify no Drizzle imports reachable from generator module.

### Implementation for User Story 1

> **Status**: COMPLETE. `GeneratorDeps` uses `store: MissionStore`. No drizzle-orm or schema imports remain. All four generation methods call `store.getLatestLesson()` or `store.getLesson()`. Verified by grep and tsc.

- [X] T005 [US1] Rename `Deps` to `GeneratorDeps` in `src/lessons/generator.ts`
- [X] T006 [US1] Replace `db: any` with `store: MissionStore` in `GeneratorDeps` interface in `src/lessons/generator.ts`
- [X] T007 [US1] Remove `import { eq, and, isNull, desc } from "drizzle-orm"` and `import * as schema from "../db/schema.js"` from `src/lessons/generator.ts`
- [X] T008 [US1] Replace raw Drizzle `SELECT ... ORDER BY id DESC LIMIT 1` with `this.deps.store.getLatestLesson(missionId)` in `generateNext`, `generateSubLesson`, `generateBridging` in `src/lessons/generator.ts`
- [X] T009 [US1] Replace raw Drizzle `SELECT ... WHERE and(eq, eq, isNull)` with `this.deps.store.getLesson(missionId, number, subNumber)` in `generateRegenerate` in `src/lessons/generator.ts`

**Checkpoint**: US1 implementation verified complete — grep confirms zero Drizzle imports, tsc compiles clean.

---

## Phase 4: User Story 2 - Shared Job-Boilerplate Extracted (Priority: P1)

**Goal**: Single `runGenerationJob()` private method handles all async job boilerplate. Adding a fifth generation method requires only prompt + result-finding callback.

**Independent Test**: Verify `generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging` all produce identical `InternalJob` lifecycle behavior (status transitions, message tracking, `setTimeout` cleanup).

### Implementation for User Story 2

> **Status**: COMPLETE. `runGenerationJob()` encapsulates InternalJob creation, IIFE, try/catch/finally, conversation loop, result finding, error logging, and 60-second cleanup. All four public methods delegate to it.

- [X] T010 [US2] Create `FindResultFn` type alias for result-finding callback in `src/lessons/generator.ts`
- [X] T011 [US2] Create `runGenerationJob(key, missionId, systemPrompt, initialMessages, findResult, errorLabel)` private method in `src/lessons/generator.ts`
- [X] T012 [US2] Refactor `generateNext` to delegate to `runGenerationJob` in `src/lessons/generator.ts`
- [X] T013 [US2] Refactor `generateSubLesson` to delegate to `runGenerationJob` in `src/lessons/generator.ts`
- [X] T014 [US2] Refactor `generateRegenerate` to delegate to `runGenerationJob` in `src/lessons/generator.ts`
- [X] T015 [US2] Refactor `generateBridging` to delegate to `runGenerationJob` in `src/lessons/generator.ts`
- [X] T016 [US2] Extract `runConversation(missionId, job, systemPrompt, initialMessages)` private method with tool-event hooks in `src/lessons/generator.ts`

**Checkpoint**: US2 implementation verified complete — four public methods are thin wrappers around `runGenerationJob`.

---

## Phase 5: User Story 3 - EventBus Injected via Constructor (Priority: P2)

**Goal**: Generator receives `EventBus` via constructor injection, not module-level singleton. Test spy can verify emitted events.

**Independent Test**: Construct `LessonGenerator` with test `EventBus` spy, call a generation method, assert `tool_start` and `tool_end` events emitted for expected tool names.

### Implementation for User Story 3

> **Status**: COMPLETE. `GeneratorDeps` includes `events: EventBus`. `runConversation` calls `this.deps.events.emit()`. `createApp()` passes `events: eventBus`. Module-level `emit` import removed.

- [X] T017 [US3] Add `events: EventBus` to `GeneratorDeps` in `src/lessons/generator.ts`
- [X] T018 [US3] Add `import type { EventBus } from "../ai/events.js"` and remove `import { emit } from "../ai/events.js"` in `src/lessons/generator.ts`
- [X] T019 [US3] Replace `emit(missionId, ...)` with `this.deps.events.emit(missionId, ...)` in `runConversation` in `src/lessons/generator.ts`
- [X] T020 [US3] Update `createApp()` in `src/index.ts` to pass `events: eventBus` to `createLessonGenerator()`

**Checkpoint**: US3 implementation verified complete — EventBus is constructor-injected, testable with spy.

---

## Phase 6: User Story 4 - Generator Testable Without Real SQLite (Priority: P2)

**Goal**: Write unit tests for `LessonGenerator` using `InMemoryMissionStore` + `FakeAiClient`. No SQLite, no migrations, <500ms total.

**Independent Test**: Seed `InMemoryMissionStore` with a lesson, call `generateNext` with matching args, verify job key returned and status transitions to "done".

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation passes them**

- [X] T021 [P] [US4] Create test file `src/test/generator.test.ts` with Vitest imports, test helpers setup
- [X] T022 [P] [US4] Test: `generateNext` creates a running job and returns valid key in `src/test/generator.test.ts`
- [X] T023 [P] [US4] Test: duplicate calls with same args return same job key (deduplication) in `src/test/generator.test.ts`
- [X] T024 [P] [US4] Test: `getJobStatus` transitions through lifecycle (not_found → running → done → not_found) in `src/test/generator.test.ts`
- [X] T025 [P] [US4] Test: AI error during generation sets job status to "error" with message in `src/test/generator.test.ts`
- [X] T026 [P] [US4] Test: `EventBus` spy records `tool_start` and `tool_end` events during generation in `src/test/generator.test.ts`
- [X] T027 [P] [US4] Test: `generateSubLesson`, `generateRegenerate`, `generateBridging` each create jobs with correct key prefixes in `src/test/generator.test.ts`

### Implementation for User Story 4

- [X] T028 [US4] Run `src/test/generator.test.ts` with `npm test -- src/test/generator.test.ts` — verify all tests pass

**Checkpoint**: Generator unit tests complete, running without SQLite or migrations

---

## Phase 7: User Story 5 - Existing Production Behavior is Preserved (Priority: P1)

**Goal**: Full test suite passes without modification. Route handlers, htmx fragments, and `AppVariables` type unchanged.

**Independent Test**: Run `npm test` — all 228+ existing tests pass without modification.

### Implementation for User Story 5

- [X] T029 [US5] Run `npm test` — confirm all 14 test files, 228+ tests pass with zero modifications
- [X] T030 [US5] Verify `createLessonGenerator` wiring in `src/index.ts` uses `store` and `events: eventBus` (not raw `db`)
- [X] T031 [US5] Verify `AppVariables` type in `src/types.ts` still exposes `lessonGenerator` via `c.get("lessonGenerator")`
- [X] T032 [US5] Run quickstart.md validation: `grep -E "drizzle-orm|from.*schema" src/lessons/generator.ts` returns empty

**Checkpoint**: All existing behavior preserved, refactor is a no-op from external perspective

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [X] T033 Run `npx tsc --noEmit` — confirm zero TypeScript errors
- [X] T034 Verify `src/lessons/generator.ts` exports: `JobStatus`, `GeneratorDeps`, `buildJobKey`, `LessonGenerator`, `createLessonGenerator` all present with matching signatures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1, US2, US3 (Phases 3-5)**: Implementation COMPLETE — verification only
- **US4 (Phase 6)**: Depends on Phases 3-5 being done (generator must accept InMemoryMissionStore + EventBus spy)
- **US5 (Phase 7)**: Depends on all phases — final regression gate
- **Polish (Phase 8)**: Depends on US5 passing

### User Story Dependencies

- **User Story 1 (P1)**: COMPLETE — No dependencies on other stories
- **User Story 2 (P1)**: COMPLETE — Built on US1 (same file, same `runGenerationJob` extraction)
- **User Story 3 (P2)**: COMPLETE — Built on US1/US2 (injects events into refactored `runConversation`)
- **User Story 4 (P2)**: Can start now — Depends on US1+US2+US3 implementation being done
- **User Story 5 (P1)**: Can start after US4 — Final verification gate

### Within Each User Story

- US4: Write tests first (T021-T027), then verify they pass (T028)
- US5: All verification tasks independent, can run in parallel

### Parallel Opportunities

- T021-T027 (all US4 test tasks) can be written in parallel since they test different facets
- T029, T030, T031, T032 (US5 verification) can all run in parallel
- T033, T034 (Polish) can run in parallel

---

## Parallel Example: User Story 4 Tests

```bash
# Launch test file creation and all test implementations together:
Task: "Create test file src/test/generator.test.ts"
Task: "Test: generateNext creates a running job"
Task: "Test: duplicate calls deduplicate"
Task: "Test: getJobStatus lifecycle transitions"
Task: "Test: AI error handling"
Task: "Test: EventBus spy records events"
Task: "Test: all four generation methods create correct keys"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. ✅ Complete Phase 1: Setup (verify tsc compiles, no Drizzle imports)
2. ✅ Complete Phase 2: Foundational (verify GeneratorDeps + index.ts wiring)
3. ✅ Complete Phases 3-5: US1 + US2 + US3 (implementation done)
4. **NEXT**: Complete Phase 6: US4 (generator unit tests)
5. Complete Phase 7: US5 (verification gate)
6. **STOP and VALIDATE**: All tests pass, TypeScript compiles, production behavior unchanged

### Incremental Delivery

1. ✅ Setup + Foundational → Foundation verified
2. ✅ US1 + US2 + US3 → Generator refactored (MVP!)
3. Next: US4 → Generator is independently testable → Test
4. US5 → Final verification → Deploy

### Current State

Implementation (Phases 1-5) is complete. The remaining work is:
- **T021-T028**: Write generator unit tests with InMemoryMissionStore (US4)
- **T029-T034**: Run final verification (US5 + Polish)
