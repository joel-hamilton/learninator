---

description: "Task list for decomposing MissionChatService.run() into independently testable modules"

---

# Tasks: Decompose MissionChatService.run()

**Input**: Design documents from `specs/028-decompose-mission-chat-service/`

**Prerequisites**: plan.md, spec.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- All paths are relative to project root `/Users/joel/Sites/learninator/`
- Source: `src/services/mission-chat.service.ts`
- Tests: `src/test/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Read existing code and tests to understand current structure

- [ ] T001 Read `src/services/mission-chat.service.ts` to understand the full current `run()` method, its 6 interleaved responsibilities, and the `buildSystemPrompt` function
- [ ] T002 Read `src/test/chat.test.ts`, `src/test/missions.test.ts`, and `src/test/onboarding.test.ts` to understand existing test patterns and the FakeAiClient usage

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor `mission-chat.service.ts` to extract the three internal pipeline stages and export `buildSystemPrompt`

**CRITICAL**: No test tasks can begin until this phase is complete

- [ ] T003 Export `buildSystemPrompt` from `src/services/mission-chat.service.ts` by adding the `export` keyword to its function declaration, keeping its current 4-branch logic unchanged
- [ ] T004 [US1] Extract message preparation logic from `run()` into a module-scoped `prepareMessages` function in `src/services/mission-chat.service.ts` that: (a) saves the user message with context/lesson prefixing via `saveMessage`, (b) calls `buildSystemPrompt`, (c) loads prior messages via `loadMessages`. Accepts explicit parameters `(input: MissionChatInput, chatStore: ChatStore, contentStore: ContentStore)` and returns `{ systemPrompt: string, messages: ChatMessage[] }`.
- [ ] T005 [US2] Extract conversation execution logic from `run()` into a module-scoped `executeConversation` function in `src/services/mission-chat.service.ts` that: (a) starts a workflow via `workflowState.startWorkflow`, (b) runs `conversationLoop`, (c) detects `mark_mission_active`, (d) manages workflow state complete/fail. Accepts explicit parameters `(systemPrompt: string, messages: ChatMessage[], tools: AiTool[], pauseOnTools: Set<string> | undefined, deps: ExecuteDeps)` and returns `{ text: string, didActivate: boolean, pausedToolUse?: AiToolUseBlock }`.
- [ ] T006 [US3] Extract post-chat handling logic from `run()` into a module-scoped `handlePostChat` function in `src/services/mission-chat.service.ts` that: (a) maps the conversation result to `MissionChatResult`, (b) triggers `generateTitle` if `didActivate` is true. Accepts explicit parameters and returns `MissionChatResult`.
- [ ] T007 Rewrite `run()` in `src/services/mission-chat.service.ts` to compose the three extracted pipeline stages in order: `prepareMessages` -> `executeConversation` -> `handlePostChat`. Ensure the external behavior is identical.
- [ ] T008 Run `npm test` to verify all existing tests pass with the refactored `run()` method

**Checkpoint**: Foundation ready — `run()` is now a simple pipeline composition. All existing tests pass.

---

## Phase 3: User Story 1 - Developer verifies message preparation in isolation (Priority: P1)

**Goal**: PrepareMessages can be invoked and tested independently with known inputs, verifying each step of the pipeline without running the full conversation loop.

**Independent Test**: Call `prepareMessages` with known `MissionChatInput` values and assert the system prompt string and the saved messages in the store.

### Tests for User Story 1

- [ ] T009 [US1] Create `src/test/mission-chat-prepare.test.ts` and write a test that calls `prepareMessages` with an onboarding mission in guided mode and asserts the system prompt contains "Guided Onboarding Mode" and "ask_guided_question"
- [ ] T010 [US1] Write a test that calls `prepareMessages` with a lesson context object and asserts the saved message is prefixed with `[Re: Lesson` and the system prompt includes lesson-specific instructions
- [ ] T011 [US1] Write a test that calls `prepareMessages` with an active mission that has stored mission content and asserts the system prompt includes "Current mission goals:" followed by the stored content
- [ ] T012 [US1] Write a test that calls `prepareMessages` with an active mission that has NO stored mission content and asserts the system prompt does NOT contain "Current mission goals:"
- [ ] T013 [US1] Write a test that calls `prepareMessages` with a user message that has additional context (but no lesson) and asserts the user message includes the context prefix in the saved message

**Checkpoint**: US1 complete — `prepareMessages` is testable in isolation across all 5 acceptance scenarios.

---

## Phase 4: User Story 2 - Developer verifies conversation execution independently (Priority: P1)

**Goal**: Conversation execution can be tested in isolation with pre-built system prompt and messages, verifying activation detection and workflow state lifecycle.

**Independent Test**: Call `executeConversation` with a pre-built system prompt and messages array (supplied by test, not from prepareMessages), and assert the returned text and didActivate flag.

### Tests for User Story 2

- [ ] T014 [US2] Create `src/test/mission-chat-execute.test.ts` and write a test that calls `executeConversation` with a FakeAiClient that returns only text (no tool use), then asserts `didActivate` is false and the result contains the assistant text
- [ ] T015 [US2] Write a test that calls `executeConversation` with a FakeAiClient that returns `mark_mission_active` tool use, then asserts `didActivate` is true and the workflow state is completed
- [ ] T016 [US2] Write a test that calls `executeConversation` with a FakeAiClient that throws an AIError, then asserts the workflow state is marked as failed with the error message
- [ ] T017 [US2] Write a test that calls `executeConversation` with a `pauseOnTools` set containing a relevant tool, then asserts the result includes the paused tool use block

**Checkpoint**: US2 complete — `executeConversation` is testable in isolation across all 4 acceptance scenarios.

---

## Phase 5: User Story 3 - Developer verifies post-chat handling in isolation (Priority: P2)

**Goal**: Post-chat handling can be tested in isolation with mock conversation results, verifying result mapping and conditional title generation.

**Independent Test**: Call `handlePostChat` with a mock conversation result and assert the returned `MissionChatResult` structure.

### Tests for User Story 3

- [ ] T018 [US3] Create `src/test/mission-chat-post.test.ts` and write a test that calls `handlePostChat` with `didActivate = true` and asserts that title generation is triggered (via a mock ai/missionStore)
- [ ] T019 [US3] Write a test that calls `handlePostChat` with `didActivate = false` and asserts that title generation is NOT triggered
- [ ] T020 [US3] Write a test that calls `handlePostChat` with an empty text result and asserts the final text defaults to "Let us continue."

**Checkpoint**: US3 complete — `handlePostChat` is testable in isolation across all 3 acceptance scenarios.

---

## Phase 6: User Story 4 - Developer verifies buildSystemPrompt branches (Priority: P2)

**Goal**: Each of the 4 branches of `buildSystemPrompt` can be tested independently, verifying prompt strings without running the AI or conversation loop.

**Independent Test**: Call `buildSystemPrompt` with various combinations of `missionStatus`, `onboardingMode`, and `lesson` parameters and assert the returned string contains expected substrings.

### Tests for User Story 4

- [ ] T021 [US4] In `src/test/mission-chat-prepare.test.ts` (or a dedicated section), write a test that calls `buildSystemPrompt` with `missionStatus === "onboarding"` and `onboardingMode === "guided"`, then asserts the prompt contains "Guided Onboarding Mode" and "ask_guided_question"
- [ ] T022 [US4] Write a test that calls `buildSystemPrompt` with `missionStatus === "onboarding"` and `onboardingMode === "chat"`, then asserts the prompt contains "Chat Onboarding Mode"
- [ ] T023 [US4] Write a test that calls `buildSystemPrompt` with a `lesson` object containing number and title, then asserts the prompt includes the lesson number, lesson title, and lesson-specific instructions
- [ ] T024 [US4] Write a test that calls `buildSystemPrompt` with an active mission and a content store containing mission content, then asserts the prompt includes "Current mission goals:" followed by the stored content
- [ ] T025 [US4] Write a test that calls `buildSystemPrompt` with an active mission and a content store that returns NO content, then asserts the prompt does NOT contain "Current mission goals:"

**Checkpoint**: US4 complete — all 4 branches of `buildSystemPrompt` are tested with 5 acceptance scenarios.

---

## Phase 7: User Story 5 - Developer verifies generateTitle separately (Priority: P3)

**Goal**: `generateTitle` can be tested with seeded message data without invoking `run()` or the conversation loop.

**Independent Test**: Call `generateTitle` with a seeded chat store and assert the AI client receives model `"low"` and the returned title is saved to the mission store.

### Tests for User Story 5

- [ ] T026 [US5] Create `src/test/mission-chat-title.test.ts` and write a test that seeds a chat store with multiple messages, calls `generateTitle`, and asserts the AI client receives a request with model `"low"` and the returned title is saved to the mission store
- [ ] T027 [US5] Write a test that calls `generateTitle` with an empty chat store and asserts it returns `null` without calling the AI client
- [ ] T028 [US5] Write a test that calls `generateTitle` with an AI client that throws an error and asserts it returns `null` without propagating the error

**Checkpoint**: US5 complete — `generateTitle` is testable in isolation across all 3 acceptance scenarios.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [ ] T029 Run `npm test` to confirm all tests (existing integration + new unit) pass
- [ ] T030 Verify no unused imports remain in `src/services/mission-chat.service.ts`
- [ ] T031 Run `npm run typecheck` (or `npx tsc --noEmit`) to confirm no type errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (specifically T003, T004)
- **US2 (Phase 4)**: Depends on Phase 2 (specifically T003, T005)
- **US3 (Phase 5)**: Depends on Phase 2 (specifically T003, T006)
- **US4 (Phase 6)**: Depends on Phase 2 (specifically T003)
- **US5 (Phase 7)**: Depends on Phase 2 (T003 — buildSystemPrompt is not a dependency for generateTitle, but the module must be refactored)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — Independent from other stories
- **US2 (P1)**: Can start after Phase 2 — Independent from other stories
- **US3 (P2)**: Can start after Phase 2 — Independent from other stories
- **US4 (P2)**: Can start after Phase 2 — Independent from other stories (shares test file with US1)
- **US5 (P3)**: Can start after Phase 2 — Independent from other stories

### Within Each User Story

- Tests are the primary deliverable — each user story IS about testing
- Write the test, run it against the refactored source, confirm it passes

### Parallel Opportunities

- All Phase 2 tasks are sequential (same source file, each builds on the previous)
- Once Phase 2 completes, US1, US2, US3, and US5 can all proceed in parallel (different test files)
- US4 shares the test file with US1 (`mission-chat-prepare.test.ts`), so a minor ordering concern
- Polish tasks T029 and T031 can run in parallel

---

## Parallel Example: Phase 2 (Foundational Extraction)

```bash
# Execute sequentially (same file):
Task T003: Export buildSystemPrompt in src/services/mission-chat.service.ts
Task T004: Extract prepareMessages in src/services/mission-chat.service.ts
Task T005: Extract executeConversation in src/services/mission-chat.service.ts
Task T006: Extract handlePostChat in src/services/mission-chat.service.ts
Task T007: Rewrite run() as pipeline composition in src/services/mission-chat.service.ts
Task T008: npm test
```

## Parallel Example: User Stories After Phase 2

```bash
# All test files can be created in parallel:
Task T009: Create src/test/mission-chat-prepare.test.ts (US1)
Task T014: Create src/test/mission-chat-execute.test.ts (US2)
Task T018: Create src/test/mission-chat-post.test.ts (US3)
Task T026: Create src/test/mission-chat-title.test.ts (US5)

# US4 tests go into same file as US1 (minor sequential within that file)
Task T021: Add buildSystemPrompt tests to src/test/mission-chat-prepare.test.ts (US4)
```

---

## Implementation Strategy

### MVP First (Phase 2 Only)

1. Complete Phase 1: Read existing code
2. Complete Phase 2: Extract functions and refactor run()
3. **STOP and VALIDATE**: Run `npm test` — all existing tests must pass
4. The MVP is the refactored `run()` with no behavioral change

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready (Phase 2 checkpoint)
2. Add US1 tests -> verify prepareMessages isolation -> Deploy
3. Add US2 tests -> verify executeConversation isolation -> Deploy
4. Add US3 tests -> verify handlePostChat isolation -> Deploy
5. Add US4 tests -> verify buildSystemPrompt branches -> Deploy
6. Add US5 tests -> verify generateTitle isolation -> Deploy

### Parallel Team Strategy

With multiple developers:

1. One developer completes Phase 1 + Phase 2
2. Once Phase 2 is done:
   - Developer A: US1 + US4 (share test file)
   - Developer B: US2 (separate test file)
   - Developer C: US3 (separate test file)
   - Developer D: US5 (separate test file)
3. Polish phase merges all test files together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature is a pure refactoring — no new functionality, no schema changes, no new dependencies
- All extracted functions remain in the same source file; only `buildSystemPrompt` is exported
- The `run()` external API is unchanged — routes see no difference
- Commit after each phase or logical group
- At any checkpoint, `npm test` should pass
