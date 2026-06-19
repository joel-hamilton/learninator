# Tasks: Parameterize Generation Progress Bars

**Input**: Design documents from `specs/025-parameterize-progress-bars/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No new tests are needed — this is a behavior-preserving refactoring. Existing tests must continue to pass.

**Organization**: Single-user-story feature. One file changes (`src/views/fragments.ts`), no call-site changes.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/views/fragments.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline before refactoring

- [X] T001 Verify all existing tests pass with `npm test` -- confirm a clean baseline before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

Nothing to do — no blocking prerequisites. The refactoring is confined to a single file with no infrastructure changes.

---

## Phase 3: User Story 1 - Developer Maintains Progress Bar Rendering (Priority: P1) MVP

**Goal**: Replace 13 individual generation progress bar functions with a single parameterized function driven by GenStyle config objects, preserving all existing exports so callers in `src/routes/lesson-generation.ts` work without changes.

**Independent Test**: All existing tests pass unchanged. The rendered HTML for every state/type combination is byte-identical.

### Implementation for User Story 1

- [X] T002 [P] [US1] Define `LessonInfo` type, `JobStatus` type, and `GenStyle` interface at the top of the generation bars section in `src/views/fragments.ts`
- [X] T003 [P] [US1] Define three `GenStyle` config objects (`nextStyle`, `regenStyle`, `bridgeStyle`) with all per-generation-type text and color values in `src/views/fragments.ts`
- [X] T004 [US1] Implement the parameterized `generationProgressBar(style, status, missionId, lesson, opts?)` function that renders the correct HTML for polling/running/done/error/missing states based on the given `GenStyle` config in `src/views/fragments.ts`
- [X] T005 [US1] Remove the 13 individual generation bar functions from `src/views/fragments.ts`
- [X] T006 [US1] Replace the 13 removed functions with 3 convenience wrappers (`generateNextBar`, `regenerateBar`, `bridgingBar`) that delegate to `generationProgressBar` with the correct config, preserving identical parameter signatures so `src/routes/lesson-generation.ts` imports work unchanged

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: Validation (Cross-Cutting)

**Purpose**: Verify the refactoring is behavior-preserving

- [X] T007 Run `npx tsc --noEmit` to confirm no type errors (pre-existing error in `src/test/view-models/lesson-grouping.test.ts` is unrelated to this change)
- [X] T008 Run `npm test` to confirm all existing tests pass
- [ ] T009 Run quickstart.md validation: verify each generation flow (next, sub, regenerate, bridge) works in the browser (manual step)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Can start after Setup
- **Validation (Phase 4)**: Depends on User Story 1 completion

### User Story Dependencies

- **User Story 1 (P1)**: Single and only story — no inter-story dependencies

### Within User Story 1

- T002 and T003 can run in parallel (types and config objects don't depend on each other)
- T004 depends on T002 and T003 (needs types and configs)
- T005 depends on T004 (can only remove old functions after new one exists and is exported)
- T006 depends on T004 (wrappers call the parameterized function)
- T005 and T006 can be done together (remove old + add wrappers)

### Parallel Opportunities

- T002 and T003 can run in parallel
- T007, T008 can run in parallel after T006 completes

---

## Parallel Example: User Story 1

```bash
# Launch type and config definition in parallel:
Task: "Define LessonInfo, JobStatus, and GenStyle types in src/views/fragments.ts"
Task: "Define nextStyle, regenStyle, bridgeStyle configs in src/views/fragments.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup (verify test baseline)
2. Complete Phase 3: User Story 1 (the entire refactoring)
3. Complete Phase 4: Validation
4. Done — this is a single increment with no MVP staging needed

### Incremental Delivery

The entire feature is one increment. There is no value in staging because:
- No callers need gradual migration (wrappers preserve exact signatures)
- The old functions must be removed to realize the benefit
- Tests validate the entire surface area at once

---

## Notes

- Only one file is modified: `src/views/fragments.ts`
- No changes to `src/routes/lesson-generation.ts` or any test files
- The rendered HTML must be byte-identical to the current output
- [P] tasks can run in parallel (independent, different conceptual units)
- [US1] label maps task to User Story 1
