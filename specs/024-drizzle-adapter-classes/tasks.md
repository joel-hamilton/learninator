# Tasks: Drizzle Adapter Classes

**Input**: Design documents from `specs/024-drizzle-adapter-classes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create adapter directory structure and convenience composite class.

- [ ] T001 Create `src/db/adapters/` directory and `src/db/adapters/index.ts` with `DrizzleStore` composite class that implements all 8 store interfaces by composing the 8 adapter instances (each passed as constructor params, delegation methods to be filled after adapters are created)

---

## Phase 2: Create Individual Drizzle Adapter Classes (US1)

**Story 1 goal**: Replace `DrizzleMissionStore` with 8 focused Drizzle adapter classes, one per interface. Each adapter lives in its own file under `src/db/adapters/`.

**Story 1 independent test**: Each adapter file exists, implements exactly one interface, and all 8 together pass the same tests that `DrizzleMissionStore` passed.

- [ ] T002 [P] [US1] Create `src/db/adapters/drizzle-mission-adapter.ts` — `DrizzleMissionAdapter` implements `MissionStore`. Copy all mission-related methods (createMission, getMission, listMissions, updateMissionTitle, updateMissionOnboardingMode, updateMissionStatus, deleteMission with cascade) from `DrizzleMissionStore` in `src/db/store.ts`. Constructor takes `BetterSQLite3Database<typeof schema>`.

- [ ] T003 [P] [US1] Create `src/db/adapters/drizzle-lesson-adapter.ts` — `DrizzleLessonAdapter` implements `LessonStore`. Copy all lesson-related methods (createLesson, getLesson, getLatestLesson, listLessons, listLessonSummaries, getMaxLessonNumber, getSubLessonCount, getLessonCount, getMainLessonCount, getMaxSubNumber, findLessonBySlug, updateLessonStatus, updateLessonFeedback, listLessonFeedback, updateLessonContent) from `DrizzleMissionStore`.

- [ ] T004 [P] [US1] Create `src/db/adapters/drizzle-chat-adapter.ts` — `DrizzleChatAdapter` implements `ChatStore`. Copy chat message methods (saveChatMessage, getChatMessages) and guided question methods (createGuidedQuestion, getPendingQuestion, answerQuestion, skipPendingQuestions) from `DrizzleMissionStore`.

- [ ] T005 [P] [US1] Create `src/db/adapters/drizzle-content-adapter.ts` — `DrizzleContentAdapter` implements `ContentStore`. Copy content methods (getMissionContent, upsertMissionContent) from `DrizzleMissionStore`.

- [ ] T006 [P] [US1] Create `src/db/adapters/drizzle-refdoc-adapter.ts` — `DrizzleRefDocAdapter` implements `RefDocStore`. Copy reference doc methods (createReferenceDoc, getReferenceDoc, listReferenceDocs) from `DrizzleMissionStore`.

- [ ] T007 [P] [US1] Create `src/db/adapters/drizzle-learning-record-adapter.ts` — `DrizzleLearningRecordAdapter` implements `LearningRecordStore`. Copy learning record methods (createLearningRecord, listLearningRecords, updateLearningRecord, getLearningRecordCount) from `DrizzleMissionStore`.

- [ ] T008 [P] [US1] Create `src/db/adapters/drizzle-user-adapter.ts` — `DrizzleUserAdapter` implements `UserStore`. Copy user methods (getUser, getUserByEmail, createUser, updateUser) from `DrizzleMissionStore`.

- [ ] T009 [P] [US1] Create `src/db/adapters/drizzle-session-adapter.ts` — `DrizzleSessionAdapter` implements `SessionStore`. Copy session methods (createSession, getSessionByToken, deleteSession, deleteExpiredSessions) from `DrizzleMissionStore`.

**Checkpoint**: All 8 adapter files exist. The `DrizzleStore` composite in `src/db/adapters/index.ts` has its delegation methods filled in.

---

## Phase 3: Wire Adapters in App and Types (US2)

**Story 2 goal**: The `createApp()` function in `src/index.ts` instantiates each Drizzle adapter separately and passes them to the services and tool executor that need them. The `AppVariables` type is updated.

**Story 2 independent test**: `npx tsc --noEmit` passes with zero errors. `npm test` passes.

- [ ] T010 [US2] Update `src/types.ts` — change `AppVariables.store` type from `DrizzleMissionStore` to the intersection `MissionStore & LessonStore & ChatStore & ContentStore & RefDocStore & LearningRecordStore & UserStore & SessionStore`. Change the import to import the individual interfaces from `../db/store.js` instead of `DrizzleMissionStore`.

- [ ] T011 [US2] Update `src/index.ts` — import all 8 adapter classes from `src/db/adapters/` and the `DrizzleStore` composite. In `createApp()`, instantiate each adapter separately with `resolvedDb`, then create the `DrizzleStore` composite passing all adapters. Set `store` to the composite (preserving `c.get("store")` backward compatibility). Pass individual adapters to `createToolExecutor()`, `createLessonGenerator()`, and `createMissionChatService()`.

- [ ] T012 [US2] Update `src/ai/types.ts` — change the `ToolStore` type import to import the needed individual store interfaces from `../db/store.js` instead of relying on a single class. Update `ToolHandlerContext.store` type from `ToolStore` to the individual interface types as needed.

- [ ] T013 [US2] Update `src/ai/tools.ts` — update `createToolExecutor` signature to accept individual store interfaces instead of a single `ToolStore` parameter. Pass the interfaces through to the tool handlers.

**Checkpoint**: App compiles. All HTTP-level tests pass (auth, missions, lessons, chat, onboarding tests that use `createTestApp()`).

---

## Phase 4: Update Service Signatures (US3)

**Story 3 goal**: Each service factory accepts only the specific store interfaces it actually uses. No service receives interfaces it does not call.

**Story 3 independent test**: Tool tests pass. Generator tests pass. Chat service tests pass.

- [ ] T014 [P] [US3] Update `src/services/mission-chat.service.ts` — the `MissionChatDeps.store` type is already `MissionStore & ChatStore & ContentStore`. Update the `createMissionChatService` function signature (and the `buildSystemPrompt` and `generateTitle` methods) to receive these 3 interfaces individually instead of through a composite `store` object. Update the `createStandardHooks` call to pass only `ChatStore`.

- [ ] T015 [P] [US3] Update `src/lessons/generator.ts` — the `GeneratorDeps.store` type is already `MissionStore & LessonStore`. Update the `createLessonGenerator` and `LessonGenerator` class to receive these 2 interfaces individually. Update internal method calls.

- [ ] T016 [P] [US3] Update `src/ai/conversation.ts` — verify `createStandardHooks` already accepts `ChatStore`. No changes needed, but add a concise comment confirming the minimal interface.

**Checkpoint**: Service-level tests pass (tools.test.ts, conversation.test.ts, generator.test.ts).

---

## Phase 5: Delete InMemoryToolStore and Update Test Files (US4)

**Story 4 goal**: `InMemoryToolStore` is deleted. All tests that used it now use individual InMemory* stores directly.

**Story 4 independent test**: `grep -r "InMemoryToolStore" src/` returns no matches. All tests pass.

- [ ] T017 [P] [US4] Update `src/test/conversation.test.ts` — replace `new InMemoryToolStore()` with individual InMemory* stores as needed by each test. `createToolExecutor` needs `ToolStore` (mission + lesson + chat + content + refdoc + learningrecord). Create individual instances and pass them to `createToolExecutor` via the updated signature.

- [ ] T018 [P] [US4] Update `src/test/generator.test.ts` — replace `new InMemoryToolStore()` with individual InMemory* stores. Update helper functions (`seedMission`, `seedLesson`, `makeGenerator`) to accept the specific stores they need.

- [ ] T019 Delete `InMemoryToolStore` class from `src/db/store.ts` (lines 624-680) and its comment block (line 621-622).

**Checkpoint**: No references to `InMemoryToolStore` remain. Tests pass.

---

## Phase 6: Update DrizzleMissionStore Test References

**Purpose**: Replace remaining test usages of `new DrizzleMissionStore(db)` with the appropriate adapter class.

- [ ] T020 [P] Update `src/ai/tools.test.ts` — replace `new DrizzleMissionStore(testDb)` with `new DrizzleMissionAdapter(testDb)` (or the composite). Also add imports from the new adapter files.

- [ ] T021 [P] Update `src/ai/conversation.test.ts` — replace `new DrizzleMissionStore(testDb)` with the appropriate adapter(s). Update imports.

- [ ] T022 [P] Update `src/test/content-upsert.test.ts` — replace `new DrizzleMissionStore(db)` with the appropriate adapter(s). Update imports.

- [ ] T023 [P] Update `src/lessons/generator.test.ts` — replace all `new DrizzleMissionStore(db)` usages with the appropriate adapter(s). Update imports. Note: some usages wrap for GeneratorDeps.store which is `MissionStore & LessonStore`.

- [ ] T024 [P] Update `src/db/__tests__/mission-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleMissionAdapter(createTestDb())`. Update import.

- [ ] T025 [P] Update `src/db/__tests__/lesson-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleLessonAdapter(createTestDb())`. Update import.

- [ ] T026 [P] Update `src/db/__tests__/chat-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleChatAdapter(createTestDb())`. Update import.

- [ ] T027 [P] Update `src/db/__tests__/content-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleContentAdapter(createTestDb())`. Update import.

- [ ] T028 [P] Update `src/db/__tests__/refdoc-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleRefDocAdapter(createTestDb())`. Update import.

- [ ] T029 [P] Update `src/db/__tests__/user-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleUserAdapter(createTestDb())`. Update import.

- [ ] T030 [P] Update `src/db/__tests__/learningrecord-store.test.ts` — replace `new DrizzleMissionStore(createTestDb())` with `new DrizzleLearningRecordAdapter(createTestDb())`. Update import.

**Checkpoint**: No references to `DrizzleMissionStore` remain in source code (except the class itself in store.ts).

---

## Phase 7: Delete DrizzleMissionStore and Final Verification

**Purpose**: Remove the old monolithic class now that no code references it. Run full verification.

- [ ] T031 Delete the `DrizzleMissionStore` class from `src/db/store.ts` (lines 112-518).
- [ ] T032 Remove the `export { schema }` re-export from `src/db/store.ts` if it is unused, or ensure it stays if needed by callers.
- [ ] T033 Run `npx tsc --noEmit` to verify zero type errors.
- [ ] T034 Run `npm test` to verify all tests pass.
- [ ] T035 Update `CLAUDE.md` project structure section — change `store.ts` description from "MissionStore interface + DrizzleMissionStore adapter" to "Store interfaces + InMemory stores".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (US1)**: Depends on Phase 1 — adapter files need the directory
- **Phase 3 (US2)**: Depends on Phase 2 — adapters must exist before wiring
- **Phase 4 (US3)**: Can start after Phase 3 — services depend on updated wiring
- **Phase 5 (US4)**: Depends on Phase 2 — adapters must exist before removing InMemoryToolStore
- **Phase 6 (Test updates)**: Depends on Phase 2 — test files must use new adapter imports
- **Phase 7 (Cleanup)**: Depends on all prior phases — DrizzleMissionStore must have zero references

### Parallel Opportunities

- **Phase 2**: All 8 adapter files (T002-T009) can be created in parallel
- **Phase 4**: Service updates (T014-T015) can be done in parallel
- **Phase 5-6**: Test file updates (T017-T030) can be done in parallel (different files)

### Within Each Phase

- Adapter creation (Phase 2): All files are independent
- Wiring (Phase 3): Sequential — types first, then index.ts, then tools
- Test updates (Phases 5-6): All test files are independent of each other

---

## Implementation Strategy

### Incremental Delivery

1. **Phase 1**: Create adapter directory + composite class skeleton
2. **Phase 2**: Extract all 8 adapters (files can be created in parallel)
3. **Stop and compile**: `npx tsc --noEmit` to verify adapter extraction is correct
4. **Phase 3**: Wire adapters in `createApp()`, update types
5. **Stop and test**: Run `npm test` — HTTP-level tests should pass
6. **Phase 4**: Update service signatures
7. **Stop and test**: Run all tests
8. **Phases 5-6**: Update test files
9. **Phase 7**: Delete old class, final verification

### MVP Scope

The minimal viable refactoring is Phases 1-3: creating the adapter files and wiring them in `createApp()` while keeping the old `DrizzleMissionStore` class for backward compatibility. This proves the adapter extraction works without breaking anything. Once that's validated, delete the old class (Phase 7).

### Rollback Plan

If `npm test` fails at any checkpoint:
1. Check which tests fail and why
2. If adapter extraction issue: compare the extracted method against the original in `DrizzleMissionStore`
3. If wiring issue: verify the DrizzleStore composite delegates correctly
4. If import issue: verify all imports are .js extensions (ES modules)
