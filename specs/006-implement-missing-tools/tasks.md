# Tasks: Implement Missing AI Tools

**Input**: Design documents from `specs/006-implement-missing-tools/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Add store layer methods that both tools depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 [P] Add `LessonFeedbackSummary` type and `listLessonFeedback()` / `updateLessonContent()` methods to `MissionStore` interface in `src/db/store.ts`
- [X] T002 [P] Implement `listLessonFeedback()` in `DrizzleMissionStore` in `src/db/store.ts`
- [X] T003 [P] Implement `updateLessonContent()` in `DrizzleMissionStore` in `src/db/store.ts`
- [X] T004 [P] Implement `listLessonFeedback()` in `InMemoryMissionStore` in `src/db/store.ts`
- [X] T005 [P] Implement `updateLessonContent()` in `InMemoryMissionStore` in `src/db/store.ts`

**Checkpoint**: Foundation ready - tool handler implementation can now begin in parallel

---

## Phase 2: User Story 1 - AI Teacher Uses Feedback History (Priority: P1) 

**Goal**: Implement `list_feedback_history` tool so the AI can see past lesson ratings and text feedback.

**Independent Test**: Call `list_feedback_history` on a mission with and without lessons that have feedback — verify correct output format.

### Implementation for User Story 1

- [X] T006 [US1] Implement `listFeedbackHistory` handler function in `src/ai/tools.ts` that calls `store.listLessonFeedback()` and formats the result
- [X] T007 [US1] Register `list_feedback_history` in `TOOL_DISPLAY_NAMES` and `buildHandlerMap()` in `src/ai/tools.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 3: User Story 2 - AI Teacher Regenerates Lessons (Priority: P1)

**Goal**: Implement `regenerate_lesson` tool so the AI can update existing lesson content in-place.

**Independent Test**: Call `regenerate_lesson` on an existing lesson and verify the content updates; call with a non-existent lesson number and verify error handling.

### Implementation for User Story 2

- [X] T008 [P] [US2] Implement `regenerateLesson` handler function in `src/ai/tools.ts` that validates the lesson exists and calls `store.updateLessonContent()`
- [X] T009 [P] [US2] Register `regenerate_lesson` in `TOOL_DISPLAY_NAMES` and `buildHandlerMap()` in `src/ai/tools.ts`

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently

---

## Phase 4: Tests

**Purpose**: Add test coverage for both new tools

- [X] T010 [P] [US1] Add test: `list_feedback_history` returns "No feedback yet." when no lessons exist in `src/ai/tools.test.ts`
- [X] T011 [P] [US1] Add test: `list_feedback_history` returns formatted feedback for lessons that have ratings in `src/ai/tools.test.ts`
- [X] T012 [P] [US2] Add test: `regenerate_lesson` updates lesson title, slug, and htmlContent in `src/ai/tools.test.ts`
- [X] T013 [P] [US2] Add test: `regenerate_lesson` returns error for non-existent lesson in `src/ai/tools.test.ts`
- [X] T014 Run full test suite and verify no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Stories (Phase 2-3)**: Both depend on Foundational phase completion
  - T006/T007 depend on T001-T002/T004 (store methods)
  - T008/T009 depend on T001-T003/T005 (store methods)
  - T006/T007 and T008/T009 can proceed in parallel
- **Tests (Phase 4)**: Depends on all user story implementations being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — No dependencies on US2
- **User Story 2 (P1)**: Can start after Foundational — No dependencies on US1

### Parallel Opportunities

- All Foundational tasks T001-T005 marked [P] can run in parallel
- T006/T007 and T008/T009 can run in parallel (different handler functions, same file)
- All test tasks T010-T013 marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (All Stories)

Since both tools are P1 and the implementation is small:

1. Complete Phase 1: Foundational
2. Complete Phase 2 + 3: Both user stories (in parallel or sequentially)
3. Complete Phase 4: Tests
4. **STOP and VALIDATE**: Run `npm test` to verify no regressions
