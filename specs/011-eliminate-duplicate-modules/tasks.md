# Tasks: Eliminate Duplicate Modules

**Input**: Design documents from `specs/011-eliminate-duplicate-modules/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No new tests required. Existing test suite must pass after each phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Verify current state before any changes

- [ ] T001 Run `npm test` to capture baseline — all tests must pass before refactoring begins

---

## Phase 2: Foundational (Extend Onboarding Module)

**Purpose**: Extend the extracted onboarding module to support workflow/event hooks and unify helper imports. These changes are prerequisites for US1 route migration.

**⚠️ CRITICAL**: No route migration can begin until this phase is complete

- [ ] T002 [P] Add optional `workflowState?: WorkflowStateManager` and `events?: EventBus` fields to `OnboardingDeps` interface in `src/onboarding/index.ts`. Import types at top of file.
- [ ] T003 [P] Replace local `extractText` helper with `contentToText` import from `src/shared/messages.ts` in `src/onboarding/index.ts`. Delete the local `extractText` function.
- [ ] T004 Update module's internal `runConversationLoop` in `src/onboarding/index.ts` to use `deps.workflowState` lifecycle (startWorkflow, stepUpdate, completeWorkflow, failWorkflow) and pass `deps.events?.emit` to `createStandardHooks`. Follow same pattern as inline version (missions.ts:96-133). Guard all calls with optional chaining.
- [ ] T005 Export `getOnboardingPrompt` from `src/onboarding/index.ts` so the chat route handler can use it for system prompt building. (It's already defined as an internal function — add it to the returned object.)

**Checkpoint**: Module extended — routes can now depend on extended module

---

## Phase 3: User Story 1 - Remove Inline Onboarding from Routes (Priority: P1) 🎯 MVP

**Goal**: Wire `src/routes/missions.ts` to use `createOnboarding()` factory instead of inline onboarding helpers. The ~90 duplicated lines are deleted.

**Independent Test**: Run `npm test`. All existing tests in `missions.test.ts` and `chat.test.ts` pass without modification.

### Implementation for User Story 1

- [ ] T006 [US1] Add import of `createOnboarding` from `src/onboarding/index.ts` at top of `src/routes/missions.ts`
- [ ] T007 [US1] Wire `POST /missions` (line 143) in `src/routes/missions.ts` to call `createOnboarding(deps).start(missionId, message, mode)` instead of inline `getOnboardingPrompt` + `runConversationLoop` + `generateMissionTitle`. The route still creates the mission in DB first, then delegates.
- [ ] T008 [US1] Wire `POST /:missionId/guided/start` (line 304) in `src/routes/missions.ts` to call `createOnboarding(deps).continueGuided(missionId)` and map `OnboardingResult` to HTTP response: `{ type: "redirect" }` → HX-Redirect header; `{ type: "question" }` → `guidedQuestionSection()` HTML; `{ type: "thinking" }` → `guidedThinkingSection()` HTML; `{ type: "error" }` → error HTML.
- [ ] T009 [US1] Wire `POST /:missionId/guided/answer` (line 347) in `src/routes/missions.ts` to call `createOnboarding(deps).answerQuestion(missionId, questionId, answer, otherText)` and map result same as T008.
- [ ] T010 [US1] Wire `POST /:missionId/guided/skip` (line 407) in `src/routes/missions.ts` to call `createOnboarding(deps).skipQuestions(missionId)` and handle redirect result.
- [ ] T011 [US1] Wire `POST /:missionId/mode` (line 448) in `src/routes/missions.ts` to call `createOnboarding(deps).switchMode(missionId, newMode)` instead of inline pending-question draining + mode update. Keep the redirect after switch.
- [ ] T012 [US1] Wire `POST /:missionId/chat` (line 672) in `src/routes/missions.ts` to use the module for system prompt building (for onboarding missions: `onboarding.getOnboardingPrompt(mode)`) and conversation loop execution (using the module's exported `runConversationLoop` or equivalent). For active missions, the route still builds its own prompt with mission content injection, then delegates the conversation loop to the module.
- [ ] T013 [US1] Delete inline functions `getOnboardingPrompt` (lines 42-48), `generateMissionTitle` (lines 50-73), and `runConversationLoop` (lines 75-134) from `src/routes/missions.ts`
- [ ] T014 Run `npm test` and verify all tests pass. Fix any test failures related to FakeAiClient sequencing or response format differences.

**Checkpoint**: All onboarding routes use the module. Inline helpers deleted. Tests pass.

---

## Phase 4: User Story 2 - Remove Inline Browse Logic from Routes (Priority: P1)

**Goal**: Wire `src/routes/browse.ts` to use `TopicExplorer` class instead of inline `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, and `FALLBACK_NARROW_OPTIONS`.

**Independent Test**: Run `npm test`. Browse behavior should be identical.

### Implementation for User Story 2

- [ ] T015 [US2] Add import of `{ createTopicExplorer }` from `src/browse/explorer.ts` at top of `src/routes/browse.ts`
- [ ] T016 [US2] Wire `GET /browse/options` (line 101) in `src/routes/browse.ts` to call `TopicExplorer.explore(path, iteration)` and pass results to existing `optionsOnly()` view. Keep HTTP-specific parsing of query params in the route handler.
- [ ] T017 [US2] Wire `POST /browse/select` (line 133) in `src/routes/browse.ts` to call `TopicExplorer.select(path, selection, iteration, isCustom)`. On `{ type: "create_mission" }`, call existing `createMissionAndRedirect()`. On `{ type: "options" }`, pass results to existing `browseOptionsFragment()` view. Keep `createMissionAndRedirect` in the routes file.
- [ ] T018 [US2] Wire `POST /browse/refresh` (line 203) in `src/routes/browse.ts` to call `TopicExplorer.refresh(path, iteration)` and pass results to existing `refreshOptionsFragment()` view. Note: TopicExplorer.refresh() THROWS on error (unlike inline which catches) — add try/catch in route handler matching the inline error handling.
- [ ] T019 [US2] Delete inline constants `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, `FALLBACK_NARROW_OPTIONS`, and `BrowseResult` interface from `src/routes/browse.ts` (lines 14-75)
- [ ] T020 Run `npm test` and verify all tests pass

**Checkpoint**: All browse routes use TopicExplorer. Inline constants deleted.

---

## Phase 5: User Story 3 - Eliminate Third Onboarding Module (Priority: P2)

**Goal**: Delete `src/ai/mission-conversation.ts` and its test file. Merge its unique content-injection logic into `src/onboarding/index.ts`.

**Independent Test**: Run `npm test`. The `mission-conversation.test.ts` tests are gone; equivalent coverage exists in `missions.test.ts` and `chat.test.ts`.

### Implementation for User Story 3

- [ ] T021 [US3] Add mission-content-injection prompt building to `src/onboarding/index.ts`: add a `buildActiveMissionPrompt` helper (or extend `getOnboardingPrompt`) that, for active missions, injects stored mission content into the TEACHER_SYSTEM_PROMPT. This mirrors the logic currently in `missions.ts` POST /:id/chat (lines 695-705) and `mission-conversation.ts` buildSystemPrompt (lines 91-117). The correct prompt variant is "Do NOT create lessons during onboarding — wait until the mission is active" (not the "AND create the first lesson" variant from mission-conversation.ts).
- [ ] T022 [US3] Delete `src/ai/mission-conversation.ts`
- [ ] T023 [US3] Delete `src/ai/mission-conversation.test.ts`
- [ ] T024 Run `npm test` and verify all tests pass. Confirm that the test suite still has coverage for: active mission chat, onboarding chat, activation, message persistence, and error handling (these are already covered by `missions.test.ts` and `chat.test.ts`).

**Checkpoint**: Only one onboarding module remains. All test coverage preserved.

---

## Phase 6: User Story 4 - Verify Dead Code Removal (Priority: P2)

**Goal**: Confirm all inline code is removed and the app boots cleanly.

**Independent Test**: grep checks return zero matches for removed functions. Type check passes.

### Implementation for User Story 4

- [ ] T025 [US4] Run grep checks to verify no inline onboarding helpers remain in routes:
  - `grep -c "function getOnboardingPrompt" src/routes/missions.ts` → 0
  - `grep -c "function generateMissionTitle" src/routes/missions.ts` → 0
  - `grep -c "function runConversationLoop" src/routes/missions.ts` → 0
- [ ] T026 [US4] Run grep checks to verify no inline browse constants remain in routes:
  - `grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts` → 0
  - `grep -c "FALLBACK_OPTIONS" src/routes/browse.ts` → 0
  - `grep -c "parseBrowseResponse" src/routes/browse.ts` → 0
- [ ] T027 [US4] Verify module imports exist:
  - `grep -r "createOnboarding" src/routes/` → at least 1 match
  - `grep -r "createTopicExplorer" src/routes/` → at least 1 match
- [ ] T028 Run `npx tsc --noEmit` to verify no type errors
- [ ] T029 Run `npm test` for final full-suite verification

**Checkpoint**: Dead code removed. App compiles. All tests pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first to capture baseline
- **Foundational (Phase 2)**: Depends on Phase 1 baseline — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion. Does NOT depend on US1 (different files).
- **User Story 3 (Phase 5)**: Depends on US1 completion (onboarding module must be stable before deleting alternatives)
- **User Story 4 (Phase 6)**: Depends on US1, US2, US3 completion

### Within Each User Story

- Import setup → route wiring → inline deletion → test verification
- Task dependencies are sequential within each story phase

### Parallel Opportunities

- US1 and US2 can be worked on in parallel after Phase 2 (they touch different route files)
- T002 and T003 in Phase 2 can be done in parallel (different parts of same file, but non-conflicting)
- T025, T026, T027 in Phase 6 can be run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline test run)
2. Complete Phase 2: Foundational (extend module)
3. Complete Phase 3: User Story 1 (onboarding migration)
4. **STOP and VALIDATE**: All tests pass, inline helpers deleted

### Incremental Delivery

1. Phases 1-2 → Foundation ready
2. Add Phase 3 (US1) → Onboarding dedup complete
3. Add Phase 4 (US2) → Browse dedup complete
4. Add Phase 5 (US3) → Third module eliminated
5. Add Phase 6 (US4) → Verified cleanup

### Sequential Execution

This is a single-developer refactoring. Execute phases in order: 1 → 2 → 3 → 4 → 5 → 6.

---

## Notes

- No new tests needed. Existing tests verify behavioral equivalence.
- No schema changes. No view changes. No test infrastructure changes.
- All changes confined to `src/routes/`, `src/onboarding/`, `src/browse/explorer.ts`, and `src/ai/mission-conversation.ts`.
- The `createMissionAndRedirect` function stays in `src/routes/browse.ts` (HTTP concern).
- The prompt from `mission-conversation.ts` ("AND create the first lesson") is a known incorrect variant — the onboarding module's prompt ("Do NOT create lessons during onboarding") is correct per spec 007.
- Run `npm test` after every phase checkpoint.
