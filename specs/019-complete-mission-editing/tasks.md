# Tasks: Complete Mission Editing Coverage

**Input**: Design documents from `/specs/019-complete-mission-editing/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included per spec requirements — this feature is ~90% test coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- Tests: `src/test/`
- AI logic: `src/ai/`
- Routes: `src/routes/`

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — project and all dependencies already exist.

**Status**: Skip — no setup tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Inject mission content into the chat conversation context so the AI always sees current goals. This is the only code change in the entire feature — all other tasks are tests that verify existing behavior against this new baseline.

**⚠️ CRITICAL**: No user story test can pass correctly until this injection is in place.

- [X] T001 Inject mission content into system prompt in `src/ai/mission-conversation.ts` — after the existing system prompt, if the mission is active and has stored `mission_content`, append the content as a `\n\nCurrent mission goals:\n<markdown>` block so the AI sees it without needing to call `read_mission_content` on every new session
- [X] T002 [P] Verify existing tests still pass after T001 — run `npx vitest run src/test/chat.test.ts` and fix any assertion mismatches (the AI now sees mission content in context, so some test expectations may need updating for the extra prompt text)

**Checkpoint**: Mission content is injected into active-mission chat context. Existing tests pass (or are updated to match).

---

## Phase 3: User Story 1 - Mission Content Is Available in Every Chat (Priority: P1) 🎯 MVP

**Goal**: A test verifies that mission content is provided to the AI in the conversation context for active mission chats.

**Independent Test**: Seed mission_content, open a chat, verify the system prompt passed to the AI includes the stored content.

### Tests for User Story 1

- [X] T003 [P] [US1] Add test in `src/test/chat.test.ts`: seed `mission_content` via `store.upsertMissionContent(missionId, "mission", "Learn Rust by building a CLI tool")`, queue a `textResponse("Let's get started with Rust!")`, POST a chat message to `/missions/:id/chat`, and assert the system prompt passed to the FakeAiClient includes the seeded mission content text
- [X] T004 [P] [US1] Add test in `src/test/chat.test.ts`: seed a mission with NO stored mission_content, queue a `textResponse("What would you like to learn?")`, POST a chat message, and assert the AI operates normally without errors (no stale/empty content injection causes a crash or garbled prompt)

### Implementation for User Story 1

(Implementation is in Phase 2 — T001. No additional implementation tasks for US1.)

**Checkpoint**: Test verifies that mission content is visible to the AI in active-mission chat. FR-006 is covered.

---

## Phase 4: User Story 2 - Mission Editing Is Scoped to the Correct User (Priority: P2)

**Goal**: A test verifies that cross-user mission content access is blocked.

**Independent Test**: Seed two users each with a mission, authenticate as user A, verify user A cannot read or write user B's mission content via the tool handlers.

### Tests for User Story 2

- [X] T005 [US2] Add test in `src/test/chat.test.ts`: seed user A with mission A, user B with mission B (each with distinct mission_content). Authenticate as user A. Create a tool-execution context for mission A's chat, then attempt to call `read_mission_content` targeting user B's mission ID. Assert the result is empty string or error — user A's session cannot read user B's content
- [X] T006 [US2] Add test in `src/test/chat.test.ts`: same two-user setup. Authenticate as user A, verify that calling `write_mission_content` on user A's own mission succeeds (scoping doesn't block legitimate writes)

### Implementation for User Story 2

(No implementation needed — scoping is enforced by the existing store methods. Tests verify it.)

**Checkpoint**: Cross-user scoping is verified. FR-008 is covered.

---

## Phase 5: User Story 3 - Remaining Sidebar Tabs All Work (Priority: P2)

**Goal**: A test verifies all five remaining sidebar tab routes return HTTP 200 for an active mission.

**Independent Test**: For each tab (Lessons, Chat, Reference, Learning Records, Resources), make an HTTP request and assert non-error status.

### Tests for User Story 3

- [X] T007 [US3] Add test in `src/test/missions.test.ts`: for an active mission, iterate over the five remaining sidebar tab URLs (`/missions/:id/lessons`, `/missions/:id/chat`, `/missions/:id/reference`, `/missions/:id/learning-records`, `/missions/:id/resources`), GET each with an authenticated session, and assert every response status is 200

### Implementation for User Story 3

(No implementation needed — these routes already exist. Test verifies no regressions.)

**Checkpoint**: All remaining sidebar tabs are confirmed working. SC-004 is covered.

---

## Phase 6: User Story 4 - Edge Cases Are Handled Gracefully (Priority: P3)

**Goal**: Tests verify all five edge cases from the original 007 spec are handled correctly.

**Independent Test**: Each edge case has its own test with a specific FakeAiClient sequence and assertion.

### Tests for User Story 4

- [X] T008 [P] [US4] Add test in `src/test/chat.test.ts` for **archived mission decline**: set mission status to `"archived"`, queue a text response where the AI declines ("This mission is archived and read-only."), POST a goal-change message, and assert the response indicates the mission cannot be edited
- [X] T009 [P] [US4] Add test in `src/test/chat.test.ts` for **tool error handling**: queue a `toolUseResponse("write_mission_content")` that returns an error string (`"Error: store unavailable"`) followed by a `textResponse("Sorry, I couldn't update the mission goals.")`), POST a goal-change message, assert the reply reports the failure and the previous mission_content is unchanged
- [X] T010 [P] [US4] Add test in `src/test/chat.test.ts` for **vague request handling**: queue a `textResponse("Could you be more specific about what you'd like to change?")`, POST a vague message like "make it better", assert the AI either asks for clarification or applies a reasonable interpretation with explicit confirmation
- [X] T011 [P] [US4] Add test in `src/test/chat.test.ts` for **fresh mission content creation**: create a mission with NO stored mission_content, queue `toolUseResponse("write_mission_content", { content_type: "mission", markdown_content: "Focus on practical Rust exercises" })` + `textResponse("I've set your mission goals.")`, POST a goal-change message, assert the store now has the new mission_content (upsert on empty works)
- [X] T012 [P] [US4] Add test in `src/test/chat.test.ts` for **contradictory change resolution**: queue a `textResponse("I'll focus on making the material more challenging.")`, POST "make it harder but also easier", assert the AI picks a coherent interpretation and confirms it (no error, no crash)

### Implementation for User Story 4

(No implementation needed — these are verification tests. Behavior is either already handled by the system prompt/store or will be covered by T001's context injection.)

**Checkpoint**: All five edge cases from 007 spec have test coverage.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation that all tests pass and nothing regressed.

- [X] T013 Run `npm test` and confirm all suites pass with zero failures
- [X] T014 Run quickstart.md validation scenarios from `specs/019-complete-mission-editing/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — project already initialized
- **Foundational (Phase 2)**: No dependencies — T001 is the only code change. BLOCKS US1 tests (T003, T004).
- **User Story 1 (Phase 3)**: Depends on Foundational (T001). Tests verify the injection.
- **User Story 2 (Phase 4)**: Independent of US1 — no dependency on T001. Tests verify existing store behavior.
- **User Story 3 (Phase 5)**: Independent of all other phases. Tests verify existing route handlers.
- **User Story 4 (Phase 6)**: Independent of all other phases. Tests verify existing AI/error handling.
- **Polish (Phase 7)**: Depends on all phases being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 (T001). No dependencies on US2-US4.
- **User Story 2 (P2)**: Independent — no dependencies on other stories.
- **User Story 3 (P2)**: Independent — no dependencies on other stories.
- **User Story 4 (P3)**: Independent — no dependencies on other stories.

US2, US3, and US4 can all start in parallel with US1 (and with each other) since they touch different test files or different test cases within the same file.

### Within Each User Story

- Tests are written and verified to pass (or fail for the right reason before implementation)
- For US1: T001 (implementation) must be done before T003/T004 (tests pass)
- For US2-US4: tests can be written immediately — they verify existing behavior

### Parallel Opportunities

- **Phase 2**: T001 and T002 are sequential (T002 verifies T001 didn't break anything)
- **Phase 3**: T003 and T004 can run in parallel (different test cases, same file — coordinate merge)
- **Phase 4**: T005 and T006 can run in parallel
- **Phase 5**: T007 is a single task
- **Phase 6**: T008-T012 all marked [P] — all five edge case tests can be written in parallel
- **Phase 7**: T013 must run after all other tasks; T014 can run in parallel with T013

---

## Parallel Example: User Story 4 (Edge Cases)

```bash
# All five edge case tests can be written in parallel:
Task: "T008 Add test for archived mission decline in src/test/chat.test.ts"
Task: "T009 Add test for tool error handling in src/test/chat.test.ts"
Task: "T010 Add test for vague request handling in src/test/chat.test.ts"
Task: "T011 Add test for fresh mission content creation in src/test/chat.test.ts"
Task: "T012 Add test for contradictory change resolution in src/test/chat.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001, T002) — inject mission content into chat context
2. Complete Phase 3: User Story 1 tests (T003, T004) — verify content is in context
3. **STOP and VALIDATE**: Run chat tests, confirm mission content flows to AI
4. This alone closes the CRITICAL FR-006 gap

### Incremental Delivery

1. Phase 2 → Mission content injected into chat context
2. Add US1 tests → Verify content injection → **MVP!** CRITICAL gap closed
3. Add US2 tests → Cross-user scoping verified (HIGH gap closed)
4. Add US3 tests → Sidebar tabs verified (HIGH gap closed)
5. Add US4 tests → All edge cases covered
6. Phase 7 → Full test suite pass, quickstart validation

### Single Developer Strategy

Execute sequentially: Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7. Total: ~14 tasks, most are single-test additions.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No schema changes — the `mission_content` table and store methods already exist
- No new routes — sidebar tab tests verify existing routes
- The `FakeAiClient` test helper already supports all needed response types (`textResponse`, `toolUseResponse`)
- Use existing test patterns from `src/test/chat.test.ts` and `src/test/missions.test.ts`
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
