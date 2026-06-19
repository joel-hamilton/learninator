# Tasks: EventBus Interface Split

**Input**: Design documents from `specs/025-eventbus-interface-split/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: No new test tasks needed — existing tests validate correctness. Only import/type reference updates in test files.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project at repository root: `src/`, test files in `src/test/` and `src/lessons/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review design documents and codebase to understand the full scope of changes

- [X] T001 Review spec, plan, research, and current codebase to understand all 12 files requiring changes

**Checkpoint**: Clear understanding of all modifications needed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the two new interfaces and update the factory function

**IMPORTANT**: These tasks MUST be completed before any consumer can be updated

- [X] T002 Define `ToolEventBus` and `WorkflowEventBus` interfaces in `src/ai/events.ts`, keeping the `EventBus` name as a type alias for the intersection during migration
- [X] T003 Update `createEventBus()` return type from `EventBus` to `ToolEventBus & WorkflowEventBus` in `src/ai/events.ts`

**Checkpoint**: Both new interfaces defined; factory returns intersection type. Consumers will now get TypeScript errors until updated.

---

## Phase 3: User Story 1 - Developers configure event wiring by interface contract (Priority: P1)

**Goal**: Every consumer module receives only the event bus interface it actually uses. The type system prevents passing the wrong bus to the wrong consumer.

**Independent Test**: Run `npx tsc --noEmit` — zero type errors. Each consumer only has access to the methods it needs.

### Implementation for User Story 1

- [X] T004 [P] [US1] Update `ConversationLoopParams.events` from `EventBus` to `ToolEventBus` in `src/ai/conversation.ts`
- [X] T005 [P] [US1] Update `WorkflowStateManager` constructor and `private events` field from `EventBus` to `WorkflowEventBus` in `src/ai/workflow-state.ts`
- [X] T006 [P] [US1] Update `GeneratorDeps.events` from `EventBus` to `ToolEventBus` in `src/lessons/generator.ts`
- [X] T007 [US1] Update `MissionChatDeps.events` from `EventBus` to `ToolEventBus & WorkflowEventBus` (intersection) in `src/services/mission-chat.service.ts`
- [X] T008 [US1] Update `AppVariables.events` from `EventBus` to `ToolEventBus & WorkflowEventBus` in `src/types.ts`
- [X] T009 [US1] Update barrel export in `src/ai/index.ts` to export `ToolEventBus` and `WorkflowEventBus` instead of `EventBus`

**Checkpoint**: All source consumers updated. `npx tsc --noEmit` should pass (test files may still fail).

---

## Phase 4: User Story 3 - Developers write focused mocks for each event domain (Priority: P3)

**Goal**: Test fakes implement only the sub-interface they need. No workflow methods required in tool event fakes and vice versa.

**Independent Test**: Each test fake compiles against only `ToolEventBus` or `WorkflowEventBus` without needing to implement both.

### Implementation for User Story 3

- [X] T010 [US3] Update `spyEventBus()` in `src/test/generator.test.ts` to return `ToolEventBus` instead of `EventBus`
- [X] T011 [US3] Update `FakeEventBus` class in `src/lessons/generator.test.ts` to implement `ToolEventBus` instead of `EventBus`

**Checkpoint**: All source AND test files updated. `npx tsc --noEmit` should pass with zero errors.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Clean up the old `EventBus` name, verify everything works

- [X] T012 Remove the `EventBus` type alias from `src/ai/events.ts` if no remaining references exist (verify with `grep -rn "EventBus" src/` first)
- [X] T013 Run `npx tsc --noEmit` and fix any remaining type errors
- [X] T014 Run `npm test` and verify all tests pass
- [X] T015 Run quickstart.md validation steps (consumer isolation spot-checks)

**Checkpoint**: All TypeScript and test checks pass. The `EventBus` name no longer appears in the codebase (unless retained as a deliberate alias for the intersection type).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion — new interfaces must exist before consumers can be updated
- **User Story 3 (Phase 5)**: Depends on User Story 1 (Phase 3) — sub-interface types must be propagated to consumers first
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 3 (P3)**: Can start after Phase 3 — test fakes reference the same sub-interfaces

### Within Each Phase

- Tasks marked [P] within a phase can run in parallel (different files, no cross-dependencies)
- Tasks without [P] should be done sequentially

### Parallel Opportunities

- T004, T005, T006 can run in parallel (different files, all consume the same new interfaces)
- T007, T008, T009 can run in parallel with T004-T006 (different files, no ordering constraint)
- T010, T011 can run in parallel (different test files)

---

## Parallel Example: User Story 1

```bash
# Launch all consumer updates together (Phase 3):
Task: "T004 Update conversation.ts to use ToolEventBus"
Task: "T005 Update workflow-state.ts to use WorkflowEventBus"
Task: "T006 Update generator.ts to use ToolEventBus"

# Then independently:
Task: "T007 Update mission-chat.service.ts to use intersection"
Task: "T008 Update types.ts AppVariables to use intersection"
Task: "T009 Update barrel export in ai/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Review
2. Complete Phase 2: Define new interfaces + update factory
3. Complete Phase 3: Update all consumers (User Story 1)
4. **STOP and VALIDATE**: Run `npx tsc --noEmit` — should pass
5. Complete Phase 4: Update test fakes (User Story 3)
6. Run `npm test` to confirm everything works

### Incremental Delivery

1. Phase 1-2 complete → Foundation ready
2. Phase 3 complete → All consumers wired correctly (MVP!)
3. Phase 4 complete → Tests pass with updated fakes
4. Each increment is independently testable via `npx tsc --noEmit` and `npm test`

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No new tests needed — existing tests verify correctness
- Commit after each logical group of changes
