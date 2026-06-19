# Tasks: Eliminate Duplicate Modules

**Input**: Design documents from `specs/011-eliminate-duplicate-modules/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No new tests required. Existing test suite passes after cleanup.

**Organization**: Tasks are grouped by work stream. The implementation took a different path than originally planned — `MissionChatService` was created instead of extending `OnboardingModule`.

## Implementation Note

The original tasks.md described extending `OnboardingDeps` and wiring routes to `createOnboarding()`. The actual implementation:
- Created `src/services/mission-chat.service.ts` as the canonical onboarding/chat service
- Wired all routes to `missionChatService` via Hono context injection
- Already wired `src/routes/browse.ts` to `TopicExplorer`
- Already deleted `src/ai/mission-conversation.ts` + its test
- Left `src/onboarding/index.ts` as dead code to clean up

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Verify current state before any changes

- [X] T001 Run `npm test` to capture baseline — all tests must pass before refactoring begins

---

## Phase 2: Foundational (Create MissionChatService)

**Purpose**: Create the canonical onboarding/chat service that replaces the three fragmented implementations.

**NOTE**: Phase 2 was executed differently than the original plan. Instead of extending `OnboardingDeps`, a new `MissionChatService` was created.

- [X] T002 Create `src/services/mission-chat.service.ts` with `createMissionChatService(deps)` factory. Accepts required `ai`, `toolExecutor`, `store`, `logger`, `events`, `workflowState` via `MissionChatDeps`. Exposes `run(input)` and `generateTitle(missionId)`.
- [X] T003 Implement `buildSystemPrompt()` in mission-chat.service.ts — handles onboarding (guided/chat), active-mission content injection, and lesson-specific chat prompts.
- [X] T004 Implement `run()` in mission-chat.service.ts — saves user message, builds system prompt, runs conversationLoop with workflow lifecycle (startWorkflow, stepUpdate, completeWorkflow, failWorkflow), emits SSE events via createStandardHooks.
- [X] T005 Implement `generateTitle()` in mission-chat.service.ts — loads conversation history, calls AI with low model, updates mission title in DB.

**Checkpoint**: MissionChatService created and ready for route wiring

---

## Phase 3: User Story 1 - Wire Routes to MissionChatService (Priority: P1)

**Goal**: Wire all onboarding/chat routes to use `missionChatService` from Hono context instead of inline onboarding logic.

**Independent Test**: Run `npm test`. All existing tests pass without modification.

- [X] T006 [US1] Register `missionChatService` on Hono context in `src/index.ts` via `c.set("missionChatService", missionChatService)` in middleware.
- [X] T007 [US1] Wire `POST /missions` in `src/routes/missions.ts` to call `missionChatService.run()` and `missionChatService.generateTitle()`.
- [X] T008 [US1] Wire `POST /:missionId/guided/start` in `src/routes/onboarding.ts` to call `missionChatService.run()` and map result to HTTP response.
- [X] T009 [US1] Wire `POST /:missionId/guided/answer` in `src/routes/onboarding.ts` to call `missionChatService.run()` with answer message.
- [X] T010 [US1] Wire `POST /:missionId/guided/skip` in `src/routes/onboarding.ts` to call `missionChatService.run()` with filtered tools.
- [X] T011 [US1] Wire `POST /:missionId/mode` in `src/routes/onboarding.ts` to handle mode switch (route handles pending question conversion, service not needed for mode change).
- [X] T012 [US1] Wire `POST /:missionId/chat` in `src/routes/chat.ts` to call `missionChatService.run()` for active mission chat.
- [X] T013 [US1] Wire lesson chat in `src/routes/lessons.ts` to call `missionChatService.run()` with lesson context.

**Checkpoint**: All routes use missionChatService. Test suite passes.

---

## Phase 4: User Story 2 - Wire Browse Routes to TopicExplorer (Priority: P1)

**Goal**: Wire browse routes to use `TopicExplorer` class instead of inline constants and parsing logic.

- [X] T014 [US2] Add import `{ createTopicExplorer }` and helper `getExplorer(c)` in `src/routes/browse.ts`.
- [X] T015 [US2] Wire `GET /browse/options` to call `explorer.explore(path, iteration)` and pass results to `optionsOnly()` view.
- [X] T016 [US2] Wire `POST /browse/select` to call `explorer.select(path, selection, iteration, isCustom)` and handle `{ type: "options" }` vs `{ type: "create_mission" }` results.
- [X] T017 [US2] Wire `POST /browse/refresh` to call `explorer.refresh(path, iteration)` and pass results to `refreshOptionsFragment()` view.

**Checkpoint**: All browse routes use TopicExplorer. Inline constants deleted.

---

## Phase 5: User Story 3 - Eliminate Third Onboarding Module (Priority: P2)

**Goal**: Delete `src/ai/mission-conversation.ts` and its test file. The MissionChatService already covers all its functionality.

- [X] T018 [US3] Delete `src/ai/mission-conversation.ts` — functionality is in mission-chat.service.ts.
- [X] T019 [US3] Delete `src/ai/mission-conversation.test.ts` — coverage exists in HTTP-level tests.

**Checkpoint**: Only one onboarding implementation remains (MissionChatService).

---

## Phase 6: User Story 4 - Clean Up Dead Onboarding Module (Priority: P2)

**Goal**: Delete `src/onboarding/index.ts` (superseded by MissionChatService) and its test file.

- [X] T020 [US4] Delete `src/onboarding/index.ts` — dead code, zero production imports.
- [X] T021 [US4] Delete `src/onboarding/index.test.ts` — coverage exists in HTTP-level tests (missions.test.ts, chat.test.ts).

**Checkpoint**: Dead code removed. Only canonical implementation exists.

---

## Phase 7: Verify Dead Code Removal

**Goal**: Confirm all inline code is removed, module imports exist, app compiles, tests pass.

- [X] T022 [US4] Verify no inline onboarding helpers in routes: `getOnboardingPrompt`, `generateMissionTitle`, `runConversationLoop` → 0 matches in `src/routes/*.ts`.
- [X] T023 [US4] Verify no inline browse constants in routes: `BROWSE_SYSTEM_PROMPT`, `FALLBACK_OPTIONS`, `parseBrowseResponse` → 0 matches in `src/routes/browse.ts`.
- [X] T024 [US4] Verify canonical service is wired: `missionChatService` found in 4 route files, `createTopicExplorer` found in browse routes.
- [X] T025 [US4] Verify dead modules deleted: `onboarding/index.ts` and `mission-conversation.ts` → file not found.
- [X] T026 [US4] Run `npx tsc --noEmit` → no type errors.
- [X] T027 [US4] Run `npm test` → 21 test files, 251 tests pass.

**Checkpoint**: All verification checks pass. Feature complete.

---

## Dependencies & Execution Order

All phases executed sequentially: 1 → 2 → 3 → 4 → 5 → 6 → 7.

Phases 4 (TopicExplorer) and 3 (MissionChatService) were independent and could have run in parallel.

---

## Notes

- Implementation diverged from original plan: `MissionChatService` was created instead of extending `OnboardingDeps`. This is a cleaner design — required deps (no optional/null checks), follows existing `LessonGenerator` service pattern.
- No schema changes. No view changes. No test infrastructure changes.
- `createMissionAndRedirect` stays in `src/routes/browse.ts` (HTTP concern).
- Prompt from `mission-conversation.ts` ("AND create the first lesson") was buggy — correct prompt ("Do NOT create lessons during onboarding") is in mission-chat.service.ts per spec 007.
- Deleted 754 lines of dead code (`onboarding/index.ts` 307 lines + `onboarding/index.test.ts` 447 lines).
