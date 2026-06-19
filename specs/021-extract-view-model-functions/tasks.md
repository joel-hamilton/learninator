# Tasks: Extract View-Model Functions

**Input**: Design documents from `/specs/021-extract-view-model-functions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the view-models module structure and prepare for extraction

- [ ] T001 Create `src/view-models/` directory with barrel export `src/view-models/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**Critical**: No user story work can begin until this phase is complete

- [ ] T002 [P] Create `src/view-models/lesson-grouping.ts` with the `lessonGrouping()` function and `EnrichedLessonSummary` type, imported from existing `LessonSummary` type in the store layer
- [ ] T003 [P] Create `src/view-models/chat-messages.ts` with the `renderChatMessages()` function, importing `contentToText` from `src/shared/messages.ts`, `formatMarkdown` from `src/shared/markdown.ts`, and `chatMessageBubble` from `src/views/shared.ts`
- [ ] T004 [P] Create `src/view-models/lesson-navigation.ts` with the `computeLessonNavigation()` function and `LessonNavResult` type, imported from existing `LessonSummary` type

**Checkpoint**: Foundation ready — all three pure functions defined and exported from `src/view-models/index.ts`. User story implementation can now begin.

---

## Phase 3: User Story 1 - View-model functions are independently testable (Priority: P1) MVP

**Goal**: Unit tests exist for all three extracted functions covering normal cases, empty input, and boundary conditions. Each test runs without HTTP, auth, or database setup.

**Independent Test**: Run `npx vitest run src/test/view-models/` — all unit tests pass with zero HTTP/database dependencies.

### Tests for User Story 1

- [ ] T005 [P] [US1] Write unit tests for `lessonGrouping()` in `src/test/view-models/lesson-grouping.test.ts` covering: empty array, single lesson, parent with one sub-lesson, parent with multiple sub-lessons (isLastSub on the last one only), lesson without sub-lessons that is not a parent (hasSubLessons=false), mixed data
- [ ] T006 [P] [US1] Write unit tests for `renderChatMessages()` in `src/test/view-models/chat-messages.test.ts` covering: empty array (returns default greeting), single user message, single assistant message, multiple alternating messages, message with empty content (skipped), message with whitespace-only content (skipped)
- [ ] T007 [P] [US1] Write unit tests for `computeLessonNavigation()` in `src/test/view-models/lesson-navigation.test.ts` covering: single lesson list, first lesson in multi-item list (no prev), last lesson in multi-item list (no next), middle lesson (both prev and next), two lessons (first has next only, second has prev only)

**Checkpoint**: All view-model unit tests pass. Each function is verified independently against known inputs.

---

## Phase 4: User Story 2 - Route handlers become thin coordinators (Priority: P2)

**Goal**: The three route handlers call the extracted functions instead of computing inline. Existing integration tests pass without modification.

**Independent Test**: Run `npm test` — all existing integration tests pass, proving rendered output is unchanged.

### Implementation for User Story 2

- [ ] T008 [US2] Replace inline lesson grouping computation in `src/routes/missions.ts` (lines 174-193) with call to `lessonGrouping()` from `src/view-models/lesson-grouping.ts`
- [ ] T009 [US2] Replace inline chat message rendering loop in `src/routes/missions.ts` (lines 280-295) with call to `renderChatMessages()` from `src/view-models/chat-messages.ts`
- [ ] T010 [US2] Replace inline prev/next navigation computation in `src/routes/lessons.ts` (lines 52-58) with call to `computeLessonNavigation()` from `src/view-models/lesson-navigation.ts`

**Checkpoint**: All three route handlers delegate to view-model functions. Existing integration tests pass.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [ ] T011 Run `npm test` to verify all existing integration tests pass
- [ ] T012 Run `npx vitest run src/test/view-models/` to verify all view-model unit tests pass
- [ ] T013 Manually smoke-test the app: navigate to a mission with sub-lessons, verify grouping, verify chat messages render, verify prev/next lesson navigation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-4)**: Both depend on Foundational phase completion
  - User Story 1 (unit tests) and User Story 2 (route integration) are independent of each other and can proceed in parallel
- **Polish (Phase 5)**: Depends on both user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — depends only on the extracted functions existing
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — depends only on the extracted functions existing
- User Stories 1 and 2 have no dependency on each other

### Within Each User Story

- Tests (US1) are independent of each other — all marked [P]
- Route integrations (US2) are independent of each other — all can be done in any order

### Parallel Opportunities

- All Foundational tasks (T002-T004) can run in parallel — they create separate files
- All US1 test tasks (T005-T007) can run in parallel — they test separate files
- All US2 route changes (T008-T010) are independent — changes to different route files or different parts of the same file

---

## Parallel Example: Phase 2

```bash
# Launch all three function extractions together:
Task: "Create lesson-grouping.ts in src/view-models/lesson-grouping.ts"
Task: "Create chat-messages.ts in src/view-models/chat-messages.ts"
Task: "Create lesson-navigation.ts in src/view-models/lesson-navigation.ts"
```

## Parallel Example: User Story 1

```bash
# Launch all three test files together:
Task: "Write unit tests for lessonGrouping in src/test/view-models/lesson-grouping.test.ts"
Task: "Write unit tests for renderChatMessages in src/test/view-models/chat-messages.test.ts"
Task: "Write unit tests for computeLessonNavigation in src/test/view-models/lesson-navigation.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all three route integrations together:
Task: "Replace inline lesson grouping in src/routes/missions.ts"
Task: "Replace inline chat rendering in src/routes/missions.ts"
Task: "Replace inline lesson navigation in src/routes/lessons.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Create directory and barrel export
2. Complete Phase 2: Create the three function modules
3. Complete Phase 3: Write unit tests for all three functions
4. **STOP and VALIDATE**: Run `npx vitest run src/test/view-models/` — all pass
5. Deploy/demo — tests prove the extraction is correct even before routes use the functions

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (functions exist but routes still use inline code)
2. Add User Story 1 → Unit tests pass independently → Foundation validated (MVP!)
3. Add User Story 2 → Routes use extracted functions → All tests pass → Feature complete
4. Run smoke test to confirm no visual regression

### Parallel Team Strategy

With multiple developers:

1. Developer A: Phase 2 extraction + US1 tests + US2 route changes for lesson grouping
2. Developer B: Phase 2 extraction + US1 tests + US2 route changes for chat messages
3. Developer C: Phase 2 extraction + US1 tests + US2 route changes for lesson navigation
