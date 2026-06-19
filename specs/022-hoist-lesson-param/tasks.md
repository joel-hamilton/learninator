---

description: "Task list for hoisting parseLessonParam into shared lesson-numbers.ts"
---

# Tasks: Hoist Duplicate parseLessonParam

**Input**: Design documents from `specs/022-hoist-lesson-param/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Unit tests for `parseLessonParam` edge cases are explicitly required by FR-006 and SC-003 in spec.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline before refactoring

- [X] T001 Verify existing tests pass with `npm test` before making any changes

**Checkpoint**: Baseline confirmed -- all tests green before refactoring begins

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared function export so both route files and tests can import it

- [X] T002 Add `parseLessonParam` export to `src/shared/lesson-numbers.ts`, following the established pattern of `formatLessonNumber` and `lessonIdStr`. Preserve the exact existing signature and body.

**Checkpoint**: `parseLessonParam` is importable from `src/shared/lesson-numbers.js` -- foundational dependency satisfied

---

## Phase 3: User Story 1 - Eliminate Duplicated Parsing Logic (Priority: P1) MVP

**Goal**: Remove both local `parseLessonParam` definitions; both route files import the shared function instead. Zero behavioral change.

**Independent Test**: `grep -c "function parseLessonParam" src/routes/lessons.ts` returns `0` and `grep -c "function parseLessonParam" src/routes/lesson-generation.ts` returns `0`, while `grep -c "export function parseLessonParam" src/shared/lesson-numbers.ts` returns `1`.

### Implementation for User Story 1

- [X] T003 [P] [US1] Update `src/routes/lessons.ts`: remove the local `parseLessonParam` definition (lines 34-40), add `import { parseLessonParam } from "../shared/lesson-numbers.js";`
- [X] T004 [P] [US1] Update `src/routes/lesson-generation.ts`: remove the local `parseLessonParam` definition (lines 26-32), add `import { parseLessonParam } from "../shared/lesson-numbers.js";`
- [X] T005 [US1] Run `npm test` to verify all 11 call sites (6 in lessons.ts, 5 in lesson-generation.ts) resolve correctly and existing tests pass

**Checkpoint**: Duplicate code eliminated, existing tests pass with zero modifications to test files

---

## Phase 4: User Story 2 - Correct Parsing Behavior (Priority: P2)

**Goal**: Unit tests for `parseLessonParam` cover all edge cases; function correctness is verified independently of route behavior.

**Independent Test**: Unit tests for `parseLessonParam` pass via `npm test` -- the tests can be run independently as they only test a pure function with no DB or app factory needed.

### Implementation for User Story 2

- [X] T006 [US2] Add unit tests for `parseLessonParam` in `src/test/lessons.test.ts` using `describe`/`it.each` blocks covering all cases from the edge case matrix in data-model.md:
  - Single digit (`"1"` -> `{ number: 1, subNumber: null }`)
  - With sub-number (`"1.2"` -> `{ number: 1, subNumber: 2 }`)
  - Double digit (`"42"` -> `{ number: 42, subNumber: null }`)
  - Double with sub (`"42.7"` -> `{ number: 42, subNumber: 7 }`)
  - Empty string (`""` -> `{ number: NaN, subNumber: null }`)
  - Just dot (`"."` -> `{ number: NaN, subNumber: null }`)
  - Multiple dots (`"1.2.3"` -> `{ number: 1, subNumber: 2 }`)
  - Non-numeric (`"abc"` -> `{ number: NaN, subNumber: null }`)
  - Trailing dot (`"1."` -> `{ number: 1, subNumber: NaN }`)
  - Leading dot (`".1"` -> `{ number: NaN, subNumber: 1 }`)

**Checkpoint**: All 10 edge cases are covered by automated tests; `npm test` passes

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that the refactoring is clean and complete

- [X] T007 [P] Run quickstart validation from `specs/022-hoist-lesson-param/quickstart.md` -- confirm grep commands return expected counts and `npm test` passes
- [X] T008 [P] Verify no stale comments or dead-code references remain in the two route files related to the removed `parseLessonParam` definitions

**Checkpoint**: Refactoring verified -- zero local definitions, shared export confirmed, all tests green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 -- BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on T002 (foundational) -- T005 also depends on T003+T004 being complete
- **User Story 2 (Phase 4)**: Depends on T002 (foundational) -- no dependency on US1 tasks
- **Polish (Phase 5)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T002. T003 and T004 are independent of each other and can be done in parallel. T005 is the verification step.
- **User Story 2 (P2)**: Depends on T002 only -- can technically proceed in parallel with US1 since the unit tests only import the shared function, not the route files.

### Within Each User Story

- Implementation before verification
- Story complete before moving to next priority

### Parallel Opportunities

- T003 and T004 modify different files (`lessons.ts` vs `lesson-generation.ts`) -- can run in parallel
- T007 and T008 are independent -- can run in parallel
- US1 and US2 can technically proceed in parallel after T002 is complete

---

## Parallel Example: User Story 1

```bash
# Both route file updates are independent:
Task: "Update src/routes/lessons.ts -- add import, remove local def"
Task: "Update src/routes/lesson-generation.ts -- add import, remove local def"

# After both complete:
Task: "Verify all existing tests pass with npm test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: T001 (baseline test pass)
2. Complete Phase 2: T002 (add shared export)
3. Complete Phase 3: T003, T004, T005 (route file updates + verification)
4. **STOP and VALIDATE**: `npm test` passes, zero local definitions remain
5. Deploy/demo if ready -- the refactoring is invisible to users

### Incremental Delivery

1. Complete Setup + Foundational (T001, T002) -- foundation ready
2. Add User Story 1 (T003-T005) -- duplication eliminated, test green (MVP!)
3. Add User Story 2 (T006) -- edge case coverage complete
4. Polish (T007-T008) -- final validation

### Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate
- No new dependencies, no schema changes, no migration steps required
