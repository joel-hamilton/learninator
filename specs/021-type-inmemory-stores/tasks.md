# Tasks: Type the InMemory Store Adapters

**Input**: Design documents from `specs/021-type-inmemory-stores/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested in spec. Validation is compile-time via `npx tsc --noEmit --strict` and existing test suite (`npm test`).

**Scope**: Type-only change to 8 InMemory store classes in `src/db/store.ts`. No new files, no behavioral changes, no test modifications.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required. This is a type-only change using existing row types already exported from `src/db/store.ts`. No new dependencies, no project initialization, no configuration changes.

No tasks for this phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Understand the existing row types and InMemory store structure before making changes.

- [X] T001 Read and verify exported row types (lines ~10-26 of `src/db/store.ts`) and map each to the corresponding InMemory store class at lines ~526-642. Confirm all 9 row types (MissionRow, LessonRow, ChatMessageRow, GuidedQuestionRow, ReferenceDocRow, LearningRecordRow, MissionContentRow, UserRow, SessionRow) are correctly imported from the Drizzle schema and cover all 8 store collections.

**Checkpoint**: Row types verified. Implementation can begin.

---

## Phase 3: User Story 1 — Type-Safe Collections (Priority: P1) and User Story 2 — Typed Method Returns (Priority: P1) -- COMBINED MVP

**Goal**: Replace all `any[]` internal collections with typed arrays using Drizzle-inferred row types, and ensure all mutation methods (create, update, find) accept and return properly typed row objects instead of `any`.

These two P1 stories are combined because each store-level task necessarily addresses both: changing the collection type to `RowType[]` enforces push-value typing, and adding explicit return type annotations ensures callers get proper autocompletion. The 8 stores are organized into sequential tasks (all in `src/db/store.ts`), orderable from simplest to most complex.

**Independent Test**: Run `npx tsc --noEmit --strict` -- must produce zero type errors in InMemory store code. A temporary test passing an invalid enum string (e.g., `"bogus"` to `updateMissionStatus`) must produce a compile-time error.

**Note**: Tasks T002-T009 are sequential because all edits target the same file (`src/db/store.ts`). Start with the simplest store (InMemorySessionStore) and work toward the most complex (InMemoryLessonStore with sort callbacks). Each task builds naturally on the file state left by the previous.

### Implementation

- [X] T002 [US1][US2] Type InMemorySessionStore: change `sessions: SessionRow[]` (was `any[]`). Methods already have typed parameters -- no method signature changes needed. Confirm `createSession(v)` return type is properly inferred as `SessionRow` in `src/db/store.ts`

- [X] T003 [US1][US2] Type InMemoryUserStore: change `users: UserRow[]` (was `any[]`). Type `createUser(v)` parameter as `{ email: string; passwordHash: string; name?: string }` matching `UserStore.createUser` interface. Type `updateUser(id, values)` parameter `values` as `{ name?: string; email?: string; passwordHash?: string }`. Ensure return types are properly inferred as `UserRow` in `src/db/store.ts`

- [X] T004 [US1][US2] Type InMemoryContentStore: change `missionContents: MissionContentRow[]` (was `any[]`). Type `upsertMissionContent(v)` parameter as `{ missionId: number; contentType: string; markdownContent: string }` matching `ContentStore.upsertMissionContent` interface. Ensure return type is properly inferred as `MissionContentRow` in `src/db/store.ts`

- [X] T005 [US1][US2] Type InMemoryRefDocStore: change `referenceDocs: ReferenceDocRow[]` (was `any[]`). Type `createReferenceDoc(v)` parameter as `{ missionId: number; title: string; slug: string; htmlContent: string; docType: string }` matching `RefDocStore.createReferenceDoc` interface. Type sort callback parameters as `(a: ReferenceDocRow, b: ReferenceDocRow)`. Ensure return type is properly inferred as `ReferenceDocRow` in `src/db/store.ts`

- [X] T006 [US1][US2] Type InMemoryLearningRecordStore: change `learningRecords: LearningRecordRow[]` (was `any[]`). Type `createLearningRecord(v)` parameter as `{ missionId: number; number: number; title: string; markdownContent: string; status?: string; supersededBy?: number | null }` matching `LearningRecordStore.createLearningRecord` interface. Type `updateLearningRecord(id, values)` parameter `values` as `{ status?: string; supersededBy?: number | null }`. Type sort callback as `(a: LearningRecordRow, b: LearningRecordRow)`. Ensure return types in `src/db/store.ts`

- [X] T007 [US1][US2] Type InMemoryMissionStore: change `missions: MissionRow[]` (was `any[]`). Type `createMission(v)` parameter matching `MissionStore.createMission` interface. Type `updateMissionStatus(status)` parameter as `"onboarding" | "active" | "archived"`. The spread-construction `{ id: this.id(), ...v, status: v.status ?? "onboarding", ... }` may need a minimal type assertion (`as MissionRow`) if TypeScript cannot infer the constructed shape. Ensure all method return types in `src/db/store.ts`

- [X] T008 [US1][US2] Type InMemoryChatStore: change `chatMessages: ChatMessageRow[]` (was `any[]`) and `guidedQuestions: GuidedQuestionRow[]` (was `any[]`). Type `saveChatMessage(v)` parameter as `{ missionId: number; role: "user" | "assistant"; content: string }` matching `ChatStore.saveChatMessage` interface. Type `createGuidedQuestion(v)` parameter as `{ missionId: number; question: string; options: string }`. Type sort callback as `(a: ChatMessageRow, b: ChatMessageRow)`. Ensure return types in `src/db/store.ts`

- [X] T009 [US1][US2] Type InMemoryLessonStore: change `lessons: LessonRow[]` (was `any[]`). Type `createLesson(v)` parameter matching `LessonStore.createLesson` interface. Type sort callback as `(a: LessonRow, b: LessonRow)`. The spread-construction with defaults may need type assertion. Ensure all method return types in `src/db/store.ts`

**Checkpoint**: All 8 InMemory stores are fully typed. Compile `npx tsc --noEmit --strict` and verify zero type errors.

---

## Phase 4: User Story 3 — Existing Tests Continue to Pass (Priority: P2)

**Goal**: Verify that all existing behavioral contracts are preserved -- the type-only changes did not alter any runtime behavior.

**Independent Test**: Run `npm test` -- all tests must pass with exit code 0 without any modifications to test files.

### Verification

- [X] T010 [US3] Run `npm test` and confirm all tests pass. If any test fails, inspect the InMemory store typing for unintended behavioral changes (e.g., a type assertion that widened a value or a missing default) and fix in `src/db/store.ts`.

**Checkpoint**: Full test suite passes. The type-only change is verified as behavior-preserving.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and belt-and-suspenders checks to ensure no `any` escaped and all quickstart scenarios pass.

- [X] T011 Run validation scenarios from `specs/021-type-inmemory-stores/quickstart.md`:
  1. `npx tsc --noEmit --strict` -- must exit 0 with zero type errors
  2. `npm test` -- must exit 0 with no test modifications
  3. Grep `src/db/store.ts` for remaining `any` in InMemory store class declarations (collections, method parameters, method return types) and confirm zero remaining in the 526-642 range
  4. Open `src/db/store.ts` and verify that hovering over any InMemory store method shows the exact row type (e.g., `MissionRow`, `LessonRow`) not `any`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks -- can start immediately
- **Foundational (Phase 2)**: No dependencies -- T001 is a read-only task
- **US1+US2 Combined (Phase 3)**: Depends on T001 (understanding row types)
- **US3 (Phase 4)**: Depends on completion of ALL Phase 3 tasks (T002-T009)
- **Polish (Final Phase)**: Depends on Phase 4

### User Story Dependencies

- **US1 + US2 (P1)**: Combined MVP. All 8 tasks are sequential (same file).
- **US3 (P2)**: Pure verification of existing test suite. No implementation work.

### Within Each User Story

- Phase 3 tasks should be completed in order: Session (simplest) through Lesson (most complex with sort callbacks and spread-construction). Each leaves `src/db/store.ts` in a valid type-checking state.
- No test tasks precede implementation (tests not requested).

### Sequential Nature

All implementation tasks modify `src/db/store.ts`. Tasks T002-T009 are inherently sequential because they edit the same file. Complete them in the listed order (simplest store first, most complex last) to minimize friction.

### Parallel Opportunities

- **T001 (understand row types)**: Trivially parallel with Phase 3 planning if desired
- **T010-T011**: Both can run independently at different terminals
- **No [P] tasks in Phase 3** due to single-file constraint

---

## Parallel Example: Phase 3 (Conceptual -- all same file)

Because all Phase 3 tasks modify `src/db/store.ts`, they run sequentially. The fastest approach is a single pass through the file from top to bottom:

1. Task: "Type InMemorySessionStore" -- simplest, no method signature changes
2. Task: "Type InMemoryUserStore" -- simple parameter typing
3. Task: "Type InMemoryContentStore" -- simple parameter typing
4. Task: "Type InMemoryRefDocStore" -- adds sort callback typing
5. Task: "Type InMemoryLearningRecordStore" -- adds sort callback typing
6. Task: "Type InMemoryMissionStore" -- spread-construction with enum defaults
7. Task: "Type InMemoryChatStore" -- two collections plus sort callback
8. Task: "Type InMemoryLessonStore" -- most complex, sort callback + spread-construction

---

## Implementation Strategy

### MVP First (US1 + US2 Only, Both P1)

1. Complete Phase 2: T001 (understand row types)
2. Complete Phase 3: T002-T009 (type all 8 stores)
3. **STOP and VALIDATE**: `npx tsc --noEmit --strict` must pass
4. MVP delivered -- compile-time type safety achieved

### Incremental Delivery

1. Phase 2 (foundational read) -- ~5 minutes
2. Phase 3 (all 8 stores typed) -- the bulk of the work, sequential single-file edits
3. Phase 4 (test suite passes) -- verify no behavioral changes
4. Phase 5 (quickstart validation) -- final sign-off

### Single-Developer Strategy

This is a single-file change. One developer works through the 8 stores in order. Each task produces a valid intermediate state (the file compiles after each task). Run `npx tsc --noEmit` after each task to verify.

---

## Notes

- No new files are created. All changes are within `src/db/store.ts` (lines ~526-642).
- Use Approach A from research.md: object spread with explicit defaults and minimal type assertions (`as MissionRow` etc.) where TypeScript cannot infer the constructed row shape.
- If a type assertion is needed, add a comment explaining why (e.g., `// as MissionRow: spread with defaults produces anonymous type`).
- Zero behavioral change constraint: do not modify any runtime logic, only add/change type annotations.
- The `InMemorySessionStore.createSession(v)` parameter is already properly typed -- only its `sessions: any[]` collection needs retyping.
