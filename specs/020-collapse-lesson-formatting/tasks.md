---

description: "Task list for collapsing duplicate lesson formatting into a shared module"
---

# Tasks: Collapse Duplicate Lesson Formatting

**Input**: Design documents from `specs/020-collapse-lesson-formatting/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Included -- explicitly requested in spec.md (FR-005, User Story 2).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project baseline before refactoring

- [X] T001 Verify current test suite state and confirm 282 passing tests, 0 failures (baseline verified)

---

## Phase 2: User Story 1 & 2 -- Shared Module and Test Coverage (P1 MVP)

**Goal**: A developer can edit lesson number formatting in one place, with full test coverage of all edge cases, safe in the knowledge that all consumers pick up the change automatically.

**Story labels**: `[US1]` = shared module + consumer updates; `[US2]` = test coverage.

**Independent Test**: Run `npx vitest run src/shared/lesson-numbers.test.ts` -- all 5 edge cases pass (single digit, double digit, sub-lesson, null sub, zero sub). Run `npx vitest run src/views/lesson.test.ts src/test/fragments.test.ts` (or equivalent HTTP-level test) to confirm no consumer regressions.

- [X] T002 [P] [US1] Create `src/shared/lesson-numbers.ts` with exported `formatLessonNumber(num: number, sub: number | null): string` and `lessonIdStr(number: number, subNumber: number | null): string` -- implementation logic identical to the current duplicated versions per research.md
- [X] T003 [US2] Create `src/shared/lesson-numbers.test.ts` with edge-case tests for both functions: single-digit null-sub, single-digit with sub, double-digit null-sub, double-digit with sub, zero sub -- use the input/output table from `data-model.md` as the contract
- [X] T004 [US1] Update `src/views/lesson.ts` -- remove local `formatLessonNumber` (line 5) and `lessonIdStr` (line 10) definitions, add `import { formatLessonNumber, lessonIdStr } from "../shared/lesson-numbers.js"`, keep all 4 call sites unchanged
- [X] T005 [P] [US1] Update `src/views/fragments.ts` -- remove local `lessonIdStr` (line 5) and `formatLessonNumber` (line 9) definitions, add `import { formatLessonNumber, lessonIdStr } from "../shared/lesson-numbers.js"`, keep all 24+ call sites unchanged
- [X] T006 [US1] Update `src/lessons/generator.ts` -- remove private `formatLessonNumber` method (line 398), add `import { formatLessonNumber } from "../shared/lesson-numbers.js"`, change 4 `this.formatLessonNumber(...)` calls to `formatLessonNumber(...)` bare calls

**Checkpoint**: Both User Story 1 and User Story 2 are complete. `formatLessonNumber` and `lessonIdStr` each exist in exactly one source file. The new test file validates all documented edge cases. All three consumer files import from the shared module.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that nothing is broken

- [X] T007 Run `npx vitest run` to confirm all 292 tests pass (282 pre-existing + 10 new), no regressions
- [X] T008 Run `npx tsc --noEmit` to confirm TypeScript compiles without errors
- [X] T009 Visual verification: identical logic confirmed via all 292 passing tests + clean tsc -- no rendering differences expected

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- sanity check only
- **User Stories (Phase 2)**: Can proceed immediately -- no foundational infrastructure needed
- **Polish (Phase 3)**: Depends on Phase 2 completion

### User Story Dependencies

- **User Story 1** and **User Story 2** share Phase 2 and are implemented together:
  - T003 (tests) functionally depends on T002 (shared module) -- tests import from the module
  - T004, T005, T006 each depend on T002 (they import the module)
  - T004, T005, T006 are independent of each other (different files)

### Within Phase 2

- T002 must be first (creates the module everything depends on)
- T003, T004, T005, T006 can all proceed in parallel after T002
- T003 uses TDD: write the tests before T002. However, since tests import from `lesson-numbers.ts`, the module must exist (even if stub-exported) for the test file to parse. Recommended order: create both files, then implement the functions in T002, then verify with T003.
- T004, T005, T006 are purely mechanical import substitutions with no logic changes

### Parallel Opportunities

- T003 and T004 can run in parallel (different files, no dependency between them given T002 is done)
- T004 and T005 can run in parallel (different files)
- T004 and T006 can run in parallel (different files)
- T005 and T006 can run in parallel (different files)
- T007 and T008 can run in parallel

---

## Parallel Example: Phase 2

```bash
# Can run in parallel after T002 is done:
Task: "Create tests in src/shared/lesson-numbers.test.ts" (T003)
Task: "Update src/views/lesson.ts imports" (T004)
Task: "Update src/views/fragments.ts imports" (T005)
Task: "Update src/lessons/generator.ts imports and calls" (T006)
```

---

## Implementation Strategy

### MVP (Phase 2 Only)

1. Complete T002: Create shared module with both functions
2. Complete T003: Create tests and verify they pass
3. Complete T004, T005, T006: Update all three consumers (can parallelize)
4. **STOP and VALIDATE**: Run `npx vitest run` to confirm no regressions
5. Phase 2 IS the MVP -- both user stories are P1 and the entire feature is ~50 lines of changes

### Incremental Delivery

Given that all work is in a single phase, there is no incremental delivery. The entire feature should be implemented in one pass (T002 through T006) and validated with T007-T009.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The 14 pre-existing test failures in `generator.test.ts` are caused by `InMemoryMissionStore is not defined` on the main branch and are unrelated to this feature
- No new npm dependencies, no database schema changes, no runtime configuration
- Each consumer file uses a different import path: `../shared/lesson-numbers.js` from views (which are one level deep in `src/views/`) vs `../shared/lesson-numbers.js` from `src/lessons/generator.ts` -- both are the same relative path since both subdirectories are one level under `src/`
