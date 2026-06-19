# Tasks: Decouple Conversation Hooks

**Input**: Design documents from `specs/021-decouple-conversation-hooks/`

**Branch**: `021-decouple-conversation-hooks`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — explicitly required by spec.md Success Criterion SC-004.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch creation and initial codebase familiarization

- [ ] T001 Create feature branch `021-decouple-conversation-hooks` from `main`
- [ ] T002 [P] Review current implementation of `conversationLoop`, `createStandardHooks`, and `StandardHooksDeps` in `src/ai/conversation.ts`
- [ ] T003 [P] Review current `LessonGenerator.runConversation` event wiring in `src/lessons/generator.ts`
- [ ] T004 [P] Review current `createStandardHooks` invocation in `src/services/mission-chat.service.ts`

**Checkpoint**: Understanding of all four source locations is complete before modifying any code.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes and event emission in `conversationLoop` that unblock ALL user stories

**Note**: No database schema changes required. No new npm dependencies.

- [ ] T005 Add optional `events: EventBus` field to `ConversationLoopParams` interface in `src/ai/conversation.ts` (see data-model.md and contracts/conversation-loop.md)
- [ ] T006 Add `tool_start` event emission (before `hooks?.onBeforeToolExecution(...)`) and `tool_end` event emission (after `hooks?.onAfterToolExecution(...)`) in `conversationLoop` in `src/ai/conversation.ts` — derive display names via `TOOL_DISPLAY_NAMES` (already imported), use optional chaining for `events?.emit(...)`

**Checkpoint**: `conversationLoop` now emits events. No callers pass `events` yet, so existing behavior is unchanged.

---

## Phase 3: User Story 1 — Conversation Loop Emits Events Directly (Priority: P1) [MVP]

**Goal**: `conversationLoop` automatically emits `tool_start`/`tool_end` events during tool execution, without requiring any hooks configuration.

**Independent Test**: A test using a real `EventBus` connected to `conversationLoop` observes `tool_start` and `tool_end` events emitted for each tool execution step, without any hooks configuration.

### Tests for User Story 1

- [ ] T007 [P] [US1] Write test: given a `conversationLoop` with an `EventBus` and tool blocks, verify `tool_start` is emitted before execution and `tool_end` after execution in `src/test/conversation.test.ts`
- [ ] T008 [P] [US1] Write test: given a `conversationLoop` without an `EventBus`, verify no events are emitted (no crash, no undefined errors) in `src/test/conversation.test.ts`
- [ ] T009 [P] [US1] Write test: given a `conversationLoop` with no tool blocks in the AI response, verify no `tool_start` or `tool_end` events are emitted in `src/test/conversation.test.ts`

### Implementation for User Story 1

- [ ] T010 [US1] Wire the `EventBus` from actual callers (mission-chat, lesson-generator) — already done in Phase 2 foundational tasks. Confirm by running test T007-T009 pass.

**Checkpoint**: US1 complete — `conversationLoop` emits events, tests verify. MVP foundation is solid.

---

## Phase 4: User Story 2 — createStandardHooks Only Persists to DB (Priority: P1) [MVP]

**Goal**: `createStandardHooks` contains only DB persistence logic. Event emission removed from its callbacks.

**Independent Test**: `createStandardHooks` can be unit-tested by calling it and verifying the returned hooks object contains only the DB-saving callbacks, with no event emission logic.

### Tests for User Story 2

- [ ] T011 [P] [US2] Write test: verify `createStandardHooks` returned hooks object has no event emission side effects — only DB saves occur in `src/test/conversation.test.ts`

### Implementation for User Story 2

- [ ] T012 [US2] Remove `emit` field from `StandardHooksDeps` interface in `src/ai/conversation.ts` (data-model.md shows `emit` removed, only `missionId`, `store`, `logger?` remain)
- [ ] T013 [US2] Remove `pendingToolNames` tracking and all `emit(...)` calls from `createStandardHooks` implementation in `src/ai/conversation.ts` — `onBeforeToolExecution` keeps only `logger.debug(...)`, `onAfterToolExecution` keeps only `saveMessage(...)`
- [ ] T014 [US2] Update `mission-chat.service.ts` to remove `emit: events.emit.bind(events)` from `createStandardHooks` deps, and pass the `EventBus` instance via the `events` field on `ConversationLoopParams` in `src/services/mission-chat.service.ts`

**Checkpoint**: US2 complete — `createStandardHooks` is DB-only, `mission-chat.service.ts` passes events directly to `conversationLoop`. All chat/mission tests pass.

---

## Phase 5: User Story 3 — LessonGenerator Reuses Framework Event Emission (Priority: P1) [MVP]

**Goal**: `LessonGenerator.runConversation` no longer manually wires events. It relies on `conversationLoop` to emit events and only provides domain-specific `job.messages` updates.

**Independent Test**: A lesson generation job running through `conversationLoop` emits events visible to the job progress UI, and tool labels correctly appear in `job.messages`, without any event emission code inside `LessonGenerator`.

### Tests for User Story 3

- [ ] T015 [P] [US3] Write test: verify `LessonGenerator.runConversation` hook emits `job.messages.push(label)` in `onBeforeToolExecution` without event emission in `src/test/lessons.test.ts`
- [ ] T016 [P] [US3] Write test: verify lesson generation completes successfully without `EventBus` (tool labels still appear in `job.messages`) in `src/test/lessons.test.ts`

### Implementation for User Story 3

- [ ] T017 [US3] Remove `pendingToolNames` tracking array and `events?.emit(...)` calls from `LessonGenerator.runConversation` in `src/lessons/generator.ts`
- [ ] T018 [US3] Pass the `EventBus` instance via the `events` field on `ConversationLoopParams` in the `conversationLoop` invocation inside `LessonGenerator.runConversation` in `src/lessons/generator.ts`
- [ ] T019 [US3] Verify `job.messages.push(label)` logic remains in `onBeforeToolExecution` callback (this is the domain-specific behavior unique to `LessonGenerator`) in `src/lessons/generator.ts`

**Checkpoint**: US3 complete — `LessonGenerator` has no event wiring, all three P1 stories done.

---

## Phase 6: User Story 4 — New Callers Get Event Emission for Free (Priority: P2) [Post-MVP]

**Goal**: Demonstrate that a new `conversationLoop` caller gets events without any hooks wiring.

**Independent Test**: A new `conversationLoop` caller with an `EventBus` sees `tool_start`/`tool_end` events without importing or configuring any event-related code in their hook callbacks.

### Tests for User Story 4

- [ ] T020 [P] [US4] Write integration test: simulate a new caller invoking `conversationLoop` with a minimal hooks object (no event wiring in hooks) and an `EventBus`, verify events fire in `src/test/conversation.test.ts`

**Checkpoint**: US4 complete — the design is proven extensible for new callers.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification, static analysis, and documentation

- [ ] T021 Run full `npm test` suite to confirm all existing tests pass without modification (chat, missions, lessons, onboarding)
- [ ] T022 [P] Static analysis: grep for `emit` references in `createStandardHooks` body in `src/ai/conversation.ts` — only `events?.emit` calls in `conversationLoop` should remain
- [ ] T023 [P] Static analysis: grep for `events?.emit` / `events.emit` in `src/lessons/generator.ts` — no matches expected
- [ ] T024 [P] Run `npm run dev` for manual SSE smoke test per `quickstart.md` Scenario 3 — verify tool progress appears in UI identically to before
- [ ] T025 Run `quickstart.md` Scenario 4 static analysis commands to confirm no event emission in hook factories

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — adds tests verifying Phase 2 behavior
- **US2 (Phase 4)**: Depends on Phase 2 (types + event emission in loop exist) — modifies `createStandardHooks` and `mission-chat.service.ts`
- **US3 (Phase 5)**: Depends on Phase 2 (types + event emission in loop exist) — modifies `LessonGenerator.runConversation`
- **US2 (Phase 4) and US3 (Phase 5) are INDEPENDENT of each other** — they modify different files (`conversation.ts` vs `generator.ts`) and can be implemented in parallel
- **US4 (Phase 6)**: Depends on all P1 stories (Phases 3-5) being complete
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each Phase

- Type/interface changes before implementation
- Tests before implementation (for phases with tests)
- Implementation before caller updates
- Verification before moving to next phase

### Parallel Opportunities

- T002, T003, T004 (Phase 1) can run in parallel — reviewing different files
- T007, T008, T009 (Phase 3) can run in parallel — separate test cases in the same file
- T011 (Phase 4) and T015, T016 (Phase 5) can run in parallel — testing different concerns
- T012 + T013 (Phase 4) and T017 + T018 (Phase 5) can run in parallel — modifying different files
- T022, T023, T024 (Phase 7) can run in parallel — different verification targets

---

## Parallel Example: Phases 4 and 5 (P1 Stories)

```bash
# Parallel work on US2 and US3:

# Task A: US2 — modify createStandardHooks + caller
# File: src/ai/conversation.ts, src/services/mission-chat.service.ts

# Task B: US3 — modify LessonGenerator
# File: src/lessons/generator.ts
```

---

## Implementation Strategy

### MVP Scope (All P1 Stories)

Three P1 user stories that together deliver the full refactoring:

1. **US1**: `conversationLoop` emits events directly (the enabler)
2. **US2**: `createStandardHooks` simplified to DB-only (the direct beneficiary)
3. **US3**: `LessonGenerator` reuses framework events (the main motivator)

### Incremental Delivery Steps

1. **Phase 1 (Setup)**: Branch + codebase familiarization
2. **Phase 2 (Foundational)**: Types + event emission in `conversationLoop` (core change)
3. **Phase 3 (US1)**: Tests verify the new event emission works — validates Phase 2
4. **Phase 4 (US2)**: Simplify `createStandardHooks` + update `mission-chat.service.ts` caller
5. **Phase 5 (US3)**: Simplify `LessonGenerator` — remove duplicated events
6. **VALIDATE**: `npm test` — all existing tests pass, new tests pass
7. **Phase 6 (US4, P2)**: Optional — prove extensibility with a new-caller test
8. **Phase 7 (Polish)**: Static analysis + manual smoke test

### What Each Phase Delivers

| Phase | Deliverable | Testable Alone |
|---|---|---|
| Setup | Branch, understanding | Review only |
| Foundational | Types + events in loop | New tests T007-T009 |
| US1 (P1) | Event emission verified | T007-T009 passing |
| US2 (P1) | createStandardHooks simplified | T011 passing, existing tests passing |
| US3 (P1) | LessonGenerator simplified | T015-T016 passing, existing tests passing |
| US4 (P2) | New-caller test | T020 passing |
| Polish | Verification complete | `npm test`, static analysis |

### Parallel Team Strategy

With two developers:

1. Both complete Phases 1-2 together (small, fast)
2. Developer A: Phases 3-4 (US1 + US2 — tests + createStandardHooks)
3. Developer B: Phase 5 (US3 — LessonGenerator)
4. Both complete Phases 6-7 together (US4 + Polish)

### Test Strategy

- **T007-T009**: Unit tests using real `EventBus` + `FakeAiClient`, verify event emission at the `conversationLoop` level (no HTTP, no SSE)
- **T011**: Unit test verifying `createStandardHooks` returned hooks have no event side effects
- **T015-T016**: Lesson-specific tests verifying `job.messages` still updates without event code in `LessonGenerator`
- **T020**: Integration-style test proving new callers get events for free
- **Existing tests**: Chat, missions, lessons, onboarding must all pass unchanged (SC-003)

---

## Notes

- [P] tasks = different files, no dependencies
- [US1]/[US2]/[US3]/[US4] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All existing tests MUST pass without modification (zero test file changes)
- No database schema changes, no new npm dependencies, no user-facing changes
