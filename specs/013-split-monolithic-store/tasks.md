# Tasks: Split Monolithic MissionStore

**Input**: Design documents from `/specs/013-split-monolithic-store/`

**Prerequisites**: plan.md (done), spec.md (done), research.md (done), data-model.md (done), quickstart.md (done)

**Tests**: Test tasks are included per FR-013 (split store.test.ts) and FR-017 (all existing tests must pass).

**Organization**: Tasks are grouped by user story. Because all stories center on the same file (`src/db/store.ts`), store.ts changes are batched in Phase 2 (Foundational). Caller updates and in-memory stores follow in story phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Verify starting state

- [X] T001 Verify all existing tests pass before any changes (`npm test`)

---

## Phase 2: Foundational — Focused Interfaces + Composite Class

**Purpose**: Core structural change in `src/db/store.ts` — the split itself. Every downstream task depends on this.

**⚠️ CRITICAL**: No caller updates can begin until this phase is complete.

- [X] T002 Define 7 focused interfaces in `src/db/store.ts`: `MissionStore` (7 methods), `LessonStore` (15 methods with `getMaxSubNumber`), `ChatStore` (6 methods for chat + guided questions), `ContentStore` (2 methods), `RefDocStore` (3 methods), `LearningRecordStore` (4 methods with `getLearningRecordCount`), `UserStore` (4 methods)
- [X] T003 Update `DrizzleMissionStore` class declaration to `implements MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore, UserStore` in `src/db/store.ts`
- [X] T004 Remove 9 compatibility aliases from `DrizzleMissionStore` class (lines 475-533) in `src/db/store.ts`
- [X] T005 Update `AppVariables.store` type from `MissionStore` to `DrizzleMissionStore` in `src/types.ts`
- [X] T006 Update `ToolHandlerContext.store` type from `MissionStore` to `DrizzleMissionStore` in `src/ai/types.ts` (or intersection type if caller needs it)

**Checkpoint**: Interfaces defined, composite class declares all implements, types updated. Store.ts compiles.

---

## Phase 3: User Story 1 — Decouple Chat Logic (Priority: P1) 🎯 MVP

**Goal**: `ai/conversation.ts` and `shared/messages.ts` accept `ChatStore` instead of `MissionStore`.

**Independent Test**: `ai/conversation.ts` imports `ChatStore` not `MissionStore`. `shared/messages.ts` function signatures use `ChatStore`. Chat tests pass unchanged.

### Implementation for User Story 1

- [X] T007 [US1] Update `StandardHooksDeps.store` type to `ChatStore` in `src/ai/conversation.ts`
- [X] T008 [US1] Update `saveMessage` and `loadMessages` parameter types to `ChatStore` in `src/shared/messages.ts`
- [X] T009 [US1] Update `MissionConversationDeps.store` type to `ChatStore & MissionStore & ContentStore` in `src/ai/mission-conversation.ts`
- [X] T010 [US1] Update `OnboardingDeps.store` type to `ChatStore & MissionStore` in `src/onboarding/index.ts`

**Checkpoint**: Chat-related files use `ChatStore`. All tests pass.

---

## Phase 4: User Story 3 — Route Handlers Depend on What They Need (Priority: P2)

**Goal**: Each route file imports only the focused interfaces it actually uses.

**Independent Test**: `routes/settings.ts` imports only `UserStore`. `routes/lessons.ts` imports only `MissionStore` and `LessonStore`.

### Implementation for User Story 3

- [X] T011 [US3] Update `routes/settings.ts` to use `UserStore` for `store` parameter type (lines using `store.updateUser` and `store.getUser`)
- [X] T012 [US3] Update `routes/lessons.ts` to use `MissionStore & LessonStore` for `store` parameter type
- [X] T013 [US3] Update `routes/chat.ts` to use `MissionStore & ContentStore` for `store` parameter type
- [X] T014 [US3] Update `routes/home.ts` `renderOobSections` parameter to use `MissionStore`
- [X] T015 [US3] Update `routes/browse.ts` to use `MissionStore` for `store` parameter type
- [X] T016 [US3] Update `routes/missions.ts` to use `MissionStore` (it uses many cross-domain methods — the composite satisfies this)
- [X] T017 [US3] Update `auth/index.ts` to use `UserStore` for `store` parameter type

**Checkpoint**: All route files use focused interface types. All tests pass.

---

## Phase 5: User Story 4 — In-Memory Stores Implement Only What's Needed (Priority: P2)

**Goal**: Replace monolithic `InMemoryMissionStore` with 7 independent `InMemory*` classes.

**Independent Test**: A test needing only chat can instantiate `InMemoryChatStore`. Each InMemory class implements exactly one focused interface.

### Implementation for User Story 4

- [X] T018 [P] [US4] Create `InMemoryMissionStore implements MissionStore` in `src/db/store.ts`
- [X] T019 [P] [US4] Create `InMemoryLessonStore implements LessonStore` in `src/db/store.ts`
- [X] T020 [P] [US4] Create `InMemoryChatStore implements ChatStore` in `src/db/store.ts`
- [X] T021 [P] [US4] Create `InMemoryContentStore implements ContentStore` in `src/db/store.ts`
- [X] T022 [P] [US4] Create `InMemoryRefDocStore implements RefDocStore` in `src/db/store.ts`
- [X] T023 [P] [US4] Create `InMemoryLearningRecordStore implements LearningRecordStore` in `src/db/store.ts`
- [X] T024 [P] [US4] Create `InMemoryUserStore implements UserStore` in `src/db/store.ts`
- [X] T025 [US4] Remove old monolithic `InMemoryMissionStore` class from `src/db/store.ts`

**Checkpoint**: All 7 InMemory* classes exist and are independently instantiable.

---

## Phase 6: User Story 5 — Remove Compatibility Aliases + Split Tests (Priority: P3)

**Goal**: Zero compatibility aliases remain. `src/db/store.test.ts` is split into per-interface test files.

**Independent Test**: `grep -r "Compatibility aliases" src/` returns nothing. Each per-interface test file tests only its focused interface. All tests pass.

### Implementation for User Story 5

- [X] T026 [US5] Remove compatibility aliases from `InMemoryMissionStore` (if class still exists) or ensure no InMemory* class has alias methods in `src/db/store.ts`
- [X] T027 [P] [US5] Create `src/db/__tests__/mission-store.test.ts` testing `InMemoryMissionStore` (mission CRUD only)
- [X] T028 [P] [US5] Create `src/db/__tests__/lesson-store.test.ts` testing `InMemoryLessonStore` (lesson CRUD, summaries, content, feedback, counts)
- [X] T029 [P] [US5] Create `src/db/__tests__/chat-store.test.ts` testing `InMemoryChatStore` (chat messages + guided questions)
- [X] T030 [P] [US5] Create `src/db/__tests__/content-store.test.ts` testing `InMemoryContentStore` (mission content read/write)
- [X] T031 [P] [US5] Create `src/db/__tests__/refdoc-store.test.ts` testing `InMemoryRefDocStore` (reference docs CRUD)
- [X] T032 [P] [US5] Create `src/db/__tests__/learningrecord-store.test.ts` testing `InMemoryLearningRecordStore` (learning records CRUD + count)
- [X] T033 [P] [US5] Create `src/db/__tests__/user-store.test.ts` testing `InMemoryUserStore` (user CRUD + lookup)
- [X] T034 [US5] Remove old `src/db/store.test.ts` after confirming all coverage is migrated

**Checkpoint**: Per-interface test files exist. Old monolithic store.test.ts removed. All tests pass.

---

## Phase 7: User Story 2 — Verify Scoped Modifications (Priority: P1)

**Goal**: Confirm that a new domain method only requires changes to one focused interface + its two implementations.

**Independent Test**: Adding `searchReferenceDocs` only touches `RefDocStore` interface and `DrizzleMissionStore` + `InMemoryRefDocStore`.

### Implementation for User Story 2

- [X] T035 [US2] Verify by inspection: adding a hypothetical method to `RefDocStore` requires changing only the `RefDocStore` interface, `DrizzleMissionStore`, and `InMemoryRefDocStore` — no other interfaces or callers affected

**Checkpoint**: US2 confirmed — scoped modification validated.

---

## Phase 8: Polish & Final Validation

**Purpose**: Run full test suite, verify success criteria, clean up.

- [X] T036 Run full test suite (`npm test`) and verify all tests pass
- [X] T037 Verify SC-001: `MissionStore` interface has ≤ 8 methods
- [X] T038 Verify SC-002: Zero compatibility alias methods exist (`grep -r "Compatibility aliases" src/`)
- [X] T039 Verify SC-006: `src/db/store.ts` is under 600 lines
- [X] T040 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2
- **US3 (Phase 4)**: Depends on Phase 2 (can run parallel with US1 — different files)
- **US4 (Phase 5)**: Depends on Phase 2 (InMemory classes need focused interfaces)
- **US5 (Phase 6)**: Depends on Phase 2, 5 (tests need InMemory* classes)
- **US2 (Phase 7)**: Depends on Phase 2 (verification only)
- **Polish (Phase 8)**: Depends on all preceding phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependencies on other stories.
- **US3 (P2)**: Can start after Phase 2. Independent of US1 (different files).
- **US4 (P2)**: Can start after Phase 2. Independent of US1/US3.
- **US5 (P3)**: Depends on US4 (need InMemory* classes for test files).
- **US2 (P1)**: Verification only — confirms outcome of Phase 2.

### Parallel Opportunities

- US1 and US3 can run in parallel after Phase 2 (different files)
- All InMemory* classes (T018-T024) can be created in parallel
- All per-interface test files (T027-T033) can be created in parallel
- Within US1: T007-T010 are independent (different files)

---

## Parallel Example: Phase 5 (InMemory* Classes)

```bash
# Launch all InMemory* class creation in parallel:
Task: "Create InMemoryMissionStore implements MissionStore in src/db/store.ts"
Task: "Create InMemoryLessonStore implements LessonStore in src/db/store.ts"
Task: "Create InMemoryChatStore implements ChatStore in src/db/store.ts"
Task: "Create InMemoryContentStore implements ContentStore in src/db/store.ts"
Task: "Create InMemoryRefDocStore implements RefDocStore in src/db/store.ts"
Task: "Create InMemoryLearningRecordStore implements LearningRecordStore in src/db/store.ts"
Task: "Create InMemoryUserStore implements UserStore in src/db/store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (split interfaces + composite class)
3. Complete Phase 3: User Story 1 (ChatStore decoupling)
4. **STOP and VALIDATE**: `npm test` passes, chat files use ChatStore
5. Commit

### Incremental Delivery

1. Setup + Foundational → interfaces split, composite class updated
2. Add US1 → ChatStore decoupling → tests pass → commit
3. Add US3 → Route handler narrowing → tests pass → commit
4. Add US4 → InMemory* classes → tests pass → commit
5. Add US5 → Test split + alias removal → tests pass → commit
6. Polish → Final validation → commit

### Sequential Strategy (this implementation)

Because all stories modify `src/db/store.ts` (the central file), and Phase 2 already does the heavy interface split, subsequent phases are independent file updates. Execute sequentially to avoid merge conflicts on store.ts.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The "Foundational" phase (Phase 2) does the actual interface split — all user stories build on it
- All 9 compatibility aliases are removed in Phase 2 (Drizzle) and Phase 5 (InMemory)
- `src/db/store.test.ts` can only be removed after all per-interface tests exist and pass
- Commit after each phase for clean history
