---

description: "Task list for narrowing tool handler store types"

---

# Tasks: Tool Store Type Narrowing

**Input**: Design documents from `/specs/025-tool-store-type-narrowing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No new tests are needed. Existing tests validate the unchanged runtime behavior. Feature spec does not request test changes.

**Organization**: Tasks are grouped by store interface to maximize parallelism. Each handler group shares a common narrowed parameter type.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project at repository root. All changes in `src/ai/tools.ts` and optionally `src/ai/types.ts`.

---

## Phase 1: ContentStore Handler Narrowing

**Purpose**: Narrow the 4 handlers that only use `ContentStore` (`getMissionContent`, `upsertMissionContent`)

**Dependencies on other phases**: None — ContentStore handlers do not share types with other handler groups.

### Implementation

- [ ] T001 [P] [US1] Narrow `readMissionContent` parameter type to `{ store: ContentStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T002 [P] [US1] Narrow `writeMissionContent` parameter type to `{ store: ContentStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T003 [P] [US1] Narrow `readResources` parameter type to `{ store: ContentStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T004 [P] [US1] Narrow `writeResources` parameter type to `{ store: ContentStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`

**Checkpoint**: 4 ContentStore handlers narrowed.

---

## Phase 2: LessonStore Handler Narrowing

**Purpose**: Narrow the 6 handlers that only use `LessonStore` (`getLesson`, `createLesson`, `getSubLessonCount`, `getMainLessonCount`, `listLessons`, `listLessonFeedback`, `updateLessonContent`)

**Dependencies on other phases**: None — independent of other handler groups.

### Implementation

- [ ] T005 [P] [US1] Narrow `createLesson` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T006 [P] [US1] Narrow `createSubLesson` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T007 [P] [US1] Narrow `readLesson` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T008 [P] [US1] Narrow `listLessons` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T009 [P] [US1] Narrow `listFeedbackHistory` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T010 [P] [US1] Narrow `regenerateLesson` parameter type to `{ store: LessonStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`

**Checkpoint**: 6 LessonStore handlers narrowed.

---

## Phase 3: Other Store Interface Handler Narrowing

**Purpose**: Narrow the remaining 7 handlers covering RefDocStore, LearningRecordStore, MissionStore, and ChatStore.

**Dependencies on other phases**: None — independent of other handler groups.

### Implementation

- [ ] T011 [P] [US1] Narrow `createReferenceDoc` parameter type to `{ store: RefDocStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T012 [P] [US1] Narrow `listReferenceDocs` parameter type to `{ store: RefDocStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T013 [P] [US1] Narrow `createLearningRecord` parameter type to `{ store: LearningRecordStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T014 [P] [US1] Narrow `listLearningRecords` parameter type to `{ store: LearningRecordStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T015 [P] [US1] Narrow `updateLearningRecord` parameter type to `{ store: LearningRecordStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T016 [P] [US1] Narrow `markMissionActive` parameter type to `{ store: MissionStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`
- [ ] T017 [P] [US1] Narrow `askGuidedQuestion` parameter type to `{ store: ChatStore; missionId: number; input: Record<string, unknown> }` in `src/ai/tools.ts`

**Checkpoint**: All 17 tool handlers have narrowed store types.

---

## Phase 4: Adapt buildHandlerMap() and createToolExecutor

**Purpose**: Update the handler map and executor to work with the divergent handler signatures.

**Dependencies on other phases**: Must complete after all handler narrowing (Phases 1-3) since the map includes all handlers.

### Implementation

- [ ] T018 [US1] Remove the `import type { ToolHandler, ToolHandlerContext }` (or keep `ToolHandler` import if used) and add imports for `ContentStore`, `LessonStore`, `ChatStore`, `MissionStore`, `RefDocStore`, `LearningRecordStore` from `../db/store.js` in `src/ai/tools.ts`
- [ ] T019 [US1] Update `buildHandlerMap()` return type and cast each handler with `as ToolHandler` in `src/ai/tools.ts`
- [ ] T020 [US1] Verify no changes needed to `createToolExecutor` in `src/ai/tools.ts` — it passes `store: ToolStore` which structurally satisfies all narrowed interfaces

**Checkpoint**: Handler map adapted, executor unchanged.

---

## Phase 5: TypeScript Header Imports (types.ts)

**Purpose**: Ensure `src/ai/types.ts` only imports the interfaces it actually needs.

**Dependencies on other phases**: Independent of handler narrowing.

### Implementation

- [ ] T021 [P] [US1] Evaluate whether `ToolHandlerContext` and `ToolHandler` type aliases are still used in `src/ai/types.ts`. If `ToolHandler` is only used by `buildHandlerMap()` in tools.ts, remove the exports from types.ts or keep them as internal types. Update the `import type` in tools.ts accordingly.

**Checkpoint**: types.ts cleaned up.

---

## Phase 6: Verification

**Purpose**: Confirm zero runtime impact and type safety.

**Dependencies on other phases**: Must run after all type changes are complete.

- [ ] T022 [US1] Run `npx tsc --noEmit` from project root to confirm zero type errors
- [ ] T023 [US1] Run `npm test` from project root to confirm all existing tests pass
- [ ] T024 [US1] Review `git diff` to confirm no runtime behavior changes (only type annotations)

**Checkpoint**: Feature complete and verified.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phases 1-3 (Handler Narrowing)**: No dependencies on each other — all handlers are independent and can be narrowed in any order. These phases can run in parallel.
- **Phase 4 (buildHandlerMap)**: Depends on Phases 1-3 because the map includes all handlers.
- **Phase 5 (types.ts cleanup)**: No dependency on other phases — can run anytime.
- **Phase 6 (Verification)**: Depends on Phases 1-5 being complete.

### Within Each Phase

- Tasks marked [P] within a phase can run in parallel (they modify different handler functions in the same file but have no inter-dependencies).

### Parallel Opportunities

- All tasks within Phases 1-3 marked [P] can run in parallel — each modifies a different function signature in the same file.
- T021 (Phase 5) can run in parallel with any other phase.

---

## Parallel Example: Handler Narrowing

```bash
# All ContentStore handlers can be narrowed in parallel:
Task: "Narrow readMissionContent in src/ai/tools.ts"
Task: "Narrow writeMissionContent in src/ai/tools.ts"
Task: "Narrow readResources in src/ai/tools.ts"
Task: "Narrow writeResources in src/ai/tools.ts"

# All LessonStore handlers can be narrowed in parallel:
Task: "Narrow createLesson in src/ai/tools.ts"
Task: "Narrow createSubLesson in src/ai/tools.ts"
Task: "Narrow readLesson in src/ai/tools.ts"
Task: "Narrow listLessons in src/ai/tools.ts"
Task: "Narrow listFeedbackHistory in src/ai/tools.ts"
Task: "Narrow regenerateLesson in src/ai/tools.ts"
```

---

## Implementation Strategy

### Approach

This feature is a single atomic type-change across one file (`src/ai/tools.ts`). There is no meaningful MVP staging since all handlers must be narrowed and the map adapted before verification. However, all individual handler changes can be applied in bulk since they are type-only and have zero runtime impact:

1. Apply all 17 handler narrowing changes (T001-T017) — these can be done in any order
2. Adapt buildHandlerMap() (T018-T020) — must come after T001-T017
3. Clean up types.ts imports (T021) — independent
4. Run verification (T022-T024)

### Parallel Team Strategy

With multiple developers:
- Developer A: T001-T004 (ContentStore group)
- Developer B: T005-T010 (LessonStore group)
- Developer C: T011-T017 (Remaining interface groups)
- All three finish → Developer D: T018-T020 (buildHandlerMap adaptation)
- Any developer: T021 (types.ts cleanup — independent)
- All developers: T022-T024 (verification)

---

## Notes

- No test tasks are needed. The feature spec does not call for new tests, and existing tests validate the unchanged runtime behavior.
- Each task in Phases 1-3 changes only the function signature type annotation — the destructuring `{ store, missionId, input } = ctx` stays the same, just `ctx` changes from `ToolHandlerContext` to the narrowed type.
- After narrowing, each handler's `store` value is structurally the same `ToolStore` instance at runtime — only the compile-time type is narrower.
- The store interfaces (`ContentStore`, `LessonStore`, etc.) are already imported in `src/ai/types.ts` via the import line at line 76. They need to be imported in `src/ai/tools.ts` instead.
