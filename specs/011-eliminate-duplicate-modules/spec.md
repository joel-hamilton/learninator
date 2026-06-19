# Feature Specification: Eliminate Duplicate Modules

**Feature Branch**: `011-eliminate-duplicate-modules`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Eliminate Duplicate Modules — resolve the dead/duplicate extraction problem where `src/onboarding/index.ts` and `src/browse/explorer.ts` were extracted as clean modules but `src/routes/missions.ts` and `src/routes/browse.ts` were never migrated and retain full inline copies of the same logic. There are three parallel onboarding implementations and two browse implementations. Only the route-inline versions run in production."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer: Remove Inline Onboarding from Routes and Wire to Extracted Module (Priority: P1)

A developer opens `src/routes/missions.ts` and sees that the guided onboarding logic — `getOnboardingPrompt`, `generateMissionTitle`, and `runConversationLoop` (lines 42-134) — is duplicated from `src/onboarding/index.ts`. After the migration, the routes file imports and calls `createOnboarding()` instead, and the duplicated ~90 lines are deleted. The onboarding module's dependency injection (`OnboardingDeps`) is extended to support workflow state tracking and event emission so the inline version's additional production features (workflow progress indicator, SSE tool-call events) are preserved.

**Why this priority**: The inline code in `missions.ts` is the production-tested implementation. Until the extracted module can accept the workflow/event dependencies that the route version uses, the module cannot replace the inline code. This is the central piece of the refactor — if the module lacks parity, no migration is possible.

**Independent Test**: Run the existing test suite (`npm test`). All tests in `missions.test.ts` and `chat.test.ts` must pass. Then introduce a controlled difference (e.g., remove a workflow state call) and confirm the test suite catches it via behavioral differences — or, more practically, verify the suite passes identically before and after the migration.

**Acceptance Scenarios**:

1. **Given** the current test suite passing with inline onboarding code, **When** the inline code is replaced with calls to the extracted `createOnboarding()` module, **Then** all existing tests pass without modification.
2. **Given** a guided onboarding flow, **When** the AI calls `mark_mission_active`, **Then** the workflow progress indicator shows a step update (`wfState.stepUpdate`) identically to before the migration.
3. **Given** a guided onboarding flow, **When** a tool call is executed, **Then** SSE events are emitted (`events.emit`) identically to before the migration.
4. **Given** the function `generateMissionTitle`, **When** invoked through the onboarding module, **Then** the mission title is updated in the database and the same title generation prompt is used.

---

### User Story 2 - Developer: Remove Inline Browse Logic from Routes and Wire to TopicExplorer (Priority: P1)

A developer opens `src/routes/browse.ts` and sees that `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, and `FALLBACK_NARROW_OPTIONS` (lines 15-75) are duplicated from `src/browse/explorer.ts`. After the migration, the browse routes instantiate `TopicExplorer` via `createTopicExplorer()` and call its `explore()`, `select()`, and `refresh()` methods. The route handler retains only the HTTP-specific code: parsing request parameters, handling htmx response formatting, and the `createMissionAndRedirect` helper.

**Why this priority**: The browse routes' inline code and the `TopicExplorer` class have identical AI prompting logic, JSON parsing, and fallback behavior. Eliminating the duplication means bug fixes to prompt templates or parsing logic only need to be made in one place. The routes remain responsible for HTTP concerns; the module handles AI interaction.

**Independent Test**: Start the application, navigate to the browse flow, select a few topic options, and verify the behavior is identical to the pre-migration experience. Also run `npm test` to confirm no test regression.

**Acceptance Scenarios**:

1. **Given** the browse routes currently using inline `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, and `FALLBACK_OPTIONS`, **When** the routes are migrated to use `TopicExplorer.explore()`, **Then** the initial set of broad categories presented to the user is identical in content and format.
2. **Given** a user selecting a topic at any exploration tier, **When** the route handler calls `TopicExplorer.select()`, **Then** the returned options are identical to what the inline code would have returned.
3. **Given** a user at the iteration cap (3 clicks, non-custom input), **When** `TopicExplorer.select()` returns `{ type: "create_mission" }`, **Then** the route handler creates the mission and redirects via `HX-Redirect`, identical to current behavior.
4. **Given** a user requesting refreshed options, **When** the route handler calls `TopicExplorer.refresh()`, **Then** the returned options are identical to what the inline refresh logic would have returned.

---

### User Story 3 - Developer: Eliminate Third Onboarding Module or Merge It (Priority: P2)

A developer examines the three onboarding implementations: `src/onboarding/index.ts` (extracted module, unused by routes), `src/routes/missions.ts` (inline, production), and `src/ai/mission-conversation.ts` (separate factory, only used in its own test). After analysis, either `mission-conversation.ts` is deleted and its tests are migrated to test the onboarding module, or `mission-conversation.ts` is adopted as the canonical implementation and `onboarding/index.ts` is deleted. Only one onboarding module remains.

**Why this priority**: Three implementations of the same concept (conversation-based onboarding with AI) create confusion about which one to use. Each has slight differences in prompt text and error handling. Consolidating to one reduces maintenance burden and eliminates ambiguity. Lower priority than stories 1 and 2 because the third module is unused in production (it only has a test).

**Independent Test**: Run `npm test`. All tests in `mission-conversation.test.ts` either still pass (if merged) or are replaced by equivalent tests in the surviving module. No tests are lost.

**Acceptance Scenarios**:

1. **Given** `src/ai/mission-conversation.ts` has its own `buildSystemPrompt` with subtle differences from `src/onboarding/index.ts` (e.g., the prompt says "call mark_mission_active, AND create the first lesson" rather than "wait until the mission is active"), **When** the modules are merged, **Then** a conscious decision is documented about which prompt variant to keep, and the chosen prompt is in exactly one place.
2. **Given** `mission-conversation.ts` has independent test coverage (6 test cases across active chat, onboarding chat, activation, persistence, and error handling), **When** the module is merged or deleted, **Then** the equivalent coverage exists in the surviving module's test file.
3. **Given** both modules implement `generateMissionTitle`, **When** they are merged, **Then** there is exactly one implementation that is referenced by both onboarding flows and active-mission chat flows.

---

### Story 4 - Developer: Verify Dead Code Is Removable (Priority: P2)

A developer audits whether the old inline code can be deleted after migration and whether the extracted modules were previously the dead code. After the refactor, `grep -r` confirms that no remaining file imports the inline onboarding or browse helper functions, and the extracted modules have at least one production import.

**Why this priority**: The refactor is only complete when the linter and bundler confirm no dead branches remain. This story ensures we don't just add import lines but actually remove the old code.

**Independent Test**: After all route-level changes are made, run `npx tsx src/index.ts` and verify the application boots without module resolution errors. Then run `npm test` to confirm all tests pass.

**Acceptance Scenarios**:

1. **Given** the migration is complete, **When** searching for `function getOnboardingPrompt` in `src/routes/missions.ts`, **Then** it is not found (the function now lives only in `src/onboarding/index.ts`).
2. **Given** the migration is complete, **When** searching for `BROWSE_SYSTEM_PROMPT` in `src/routes/browse.ts`, **Then** it is not found (the constant now lives only in `src/browse/explorer.ts` or its associated module).
3. **Given** the migration is complete, **When** importing `createOnboarding` from `src/onboarding/index.ts` in `src/routes/missions.ts`, **Then** the application compiles and runs without errors.
4. **Given** the migration is complete, **When** running `grep -r "from.*onboarding/index" src/routes/`, **Then** at least one match confirms the module is now used.

---

### Edge Cases

- What happens if the extracted `onboarding` module was written against an older version of the tool executor, store interface, or conversation loop API that has since diverged from the route-inline version? The module might have subtle behavioral differences (e.g., the inline prompt in `missions.ts` says "Do NOT create lessons during onboarding" while the `mission-conversation.ts` prompt says "AND create the first lesson"). Each divergence must be reconciled.
- What happens to `workflowState` and `events` integration? The route-inline `runConversationLoop` calls `wfState.startWorkflow()`, `wfState.stepUpdate()`, `wfState.completeWorkflow()`, and `wfState.failWorkflow()`, plus `events.emit()`. The extracted `onboarding/index.ts` `runConversationLoop` does none of this. If the module is adopted, these features must be added to the module's interface or the caller must wrap the conversation differently.
- What happens if the `TopicExplorer` methods throw an exception differently than the inline browse logic? The inline code has per-method try/catch with fallback options; the `TopicExplorer` also has try/catch but the error messages and fallback handling could differ on the boundary between module and handler.
- What happens to `createMissionAndRedirect` in `src/routes/browse.ts` — it is a route-level HTTP helper (creates mission, saves seed message, sets `HX-Redirect` header) and is not part of `TopicExplorer`. The refactor must keep this function in the routes file or migrate it to a shared HTTP utility. It must not be left orphaned.
- What happens to the `contentToText` import discrepancy? The route-inline `generateMissionTitle` in `missions.ts` imports `contentToText` from messages, while the extracted version has its own `extractText` helper. The implementations must be unified.
- How does the refactor impact the `FakeAiClient` response sequencing in tests? The route-level tests have specific expectations about queue entry ordering (e.g., 1 toolUseResponse + 1 textResponse + 1 textResponse for activation). If the refactor changes the call pattern, the test fixtures must be updated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The route `POST /missions` (create mission with first message) MUST delegate onboarding prompt building and conversation looping to `src/onboarding/index.ts` instead of inline code, without changing the route's HTTP behavior (redirect on success, error fallback on failure).
- **FR-002**: The route `POST /missions/:missionId/guided/start` MUST delegate to the onboarding module's `continueGuided()` method instead of inline `getOnboardingPrompt` + `runConversationLoop`.
- **FR-003**: The route `POST /missions/:missionId/guided/answer` MUST delegate to the onboarding module's `answerQuestion()` method instead of inline answer persistence + conversation loop.
- **FR-004**: The route `POST /missions/:missionId/guided/skip` MUST delegate to the onboarding module's `skipQuestions()` method instead of inline skip logic.
- **FR-005**: The route `POST /missions/:missionId/mode` (toggle onboarding mode) MUST delegate to the onboarding module's `switchMode()` method instead of inline pending-question draining + mode update.
- **FR-006**: The `OnboardingDeps` interface in `src/onboarding/index.ts` MUST be extended to optionally accept workflow state and event emitter dependencies, or the onboarding factory MUST accept a callback/hook for workflow lifecycle events, so that the workflow progress indicator (site-wide) continues to function after migration.
- **FR-007**: The route `GET /browse/options` MUST delegate to `TopicExplorer.explore()` instead of inline AI chat + `parseBrowseResponse` + fallback logic.
- **FR-008**: The route `POST /browse/select` MUST delegate to `TopicExplorer.select()` for AI interaction and decision logic, keeping only the HTTP response formatting (htmx HTML fragments, `HX-Redirect` header) in the route.
- **FR-009**: The route `POST /browse/refresh` MUST delegate to `TopicExplorer.refresh()` instead of inline AI chat + parsing + fallback logic.
- **FR-010**: The `TopicExplorer` class methods MUST return the same data contracts (`TopicOptions`, `TopicResult`) that the route handlers expect, so that the htmx fragment rendering logic in `src/routes/browse.ts` remains unchanged.
- **FR-011**: After migration, `src/routes/missions.ts` MUST NOT contain inline definitions of `getOnboardingPrompt`, `generateMissionTitle`, or `runConversationLoop`. These must be imported from `src/onboarding/index.ts` (or the surviving canonical module).
- **FR-012**: After migration, `src/routes/browse.ts` MUST NOT contain inline definitions of `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, or `FALLBACK_NARROW_OPTIONS`. These must be imported from `src/browse/explorer.ts` (or the surviving canonical module).
- **FR-013**: After migration, exactly one of `src/onboarding/index.ts` or `src/ai/mission-conversation.ts` MUST survive. The other MUST be deleted. The surviving module MUST cover the union of both modules' test scenarios.
- **FR-014**: The surviving onboarding module MUST be importable by both route handlers (`src/routes/missions.ts`) and AI layer consumers (`src/ai/`). It SHOULD be placed at a layer that avoids circular dependencies.
- **FR-015**: The `FakeAiClient` queue entry count and ordering in the mission test file MUST NOT change unless the behavioral reason for the change is documented. If the refactor necessarily changes the number of AI calls, the tests MUST be updated to reflect the new call sequence, and the change MUST be justified in the commit message.

### Key Entities

- **OnboardingModule (in `src/onboarding/index.ts`)**: The factory `createOnboarding(deps)` that produces an `OnboardingModule` interface with `start()`, `continueGuided()`, `answerQuestion()`, `skipQuestions()`, and `switchMode()`. Currently has no importers in production code. Must be extended to support workflow/event hooks.
- **MissionConversationModule (in `src/ai/mission-conversation.ts`)**: The factory `createMissionConversation(deps)` that produces a single `run(input)` method. Overlaps with OnboardingModule. Only used in its own test. Candidate for deletion or merging.
- **TopicExplorer (in `src/browse/explorer.ts`)**: Class with `explore()`, `select()`, and `refresh()` methods. Currently has no importers in production code. Must be adopted by browse routes.
- **Inline onboarding helpers (in `src/routes/missions.ts`, lines 42-134)**: Duplicated copies of `getOnboardingPrompt`, `generateMissionTitle`, and `runConversationLoop`. These are the production-tested implementations. They call `c.get("workflowState")` and `c.get("events")` for the site-wide progress indicator.
- **Inline browse constants (in `src/routes/browse.ts`, lines 15-75)**: Duplicated copies of `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, and `FALLBACK_NARROW_OPTIONS`. They have identical logic to the explorer module.
- **`createMissionAndRedirect` (in `src/routes/browse.ts`, lines 77-89)**: HTTP-level helper that creates a mission from a browse selection and issues an `HX-Redirect` header. This is route-specific and belongs in the routes file, not the explorer module.
- **Workflow state**: The site-wide progress indicator (`site-wide-workflow-indicator`) that appears during AI operations. The route-inline `runConversationLoop` triggers `wfState.startWorkflow()`, `wfState.stepUpdate()`, `wfState.completeWorkflow()`, and `wfState.failWorkflow()`. The extracted `onboarding/index.ts` module has no awareness of this.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing tests pass without modification (both in `src/test/missions.test.ts` and `src/test/chat.test.ts`). Exception: if the refactor necessarily changes the FakeAiClient queue entry count, the update to those entries MUST be minimal and documented.
- **SC-002**: After the refactor, `src/routes/missions.ts` contains no more than 10 lines of onboarding-specific business logic (i.e., no inline copies of `getOnboardingPrompt`, `generateMissionTitle`, `runConversationLoop`). The file size is reduced by at least 80 lines.
- **SC-003**: After the refactor, `src/routes/browse.ts` contains no more than 10 lines of browse-specific AI interaction logic (i.e., no inline copies of `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, `FALLBACK_NARROW_OPTIONS`). The file size is reduced by at least 50 lines.
- **SC-004**: `grep -c "function getOnboardingPrompt" src/routes/missions.ts` returns 0 after migration.
- **SC-005**: `grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts` returns 0 after migration.
- **SC-006**: `grep -r "createOnboarding\|createTopicExplorer" src/routes/` returns at least 2 matches (one per routes file) after migration.
- **SC-007**: The number of onboarding implementations is reduced from 3 to 1. Either `src/onboarding/index.ts` or `src/ai/mission-conversation.ts` is deleted or merged into the other.
- **SC-008**: Manual browse flow testing (open /browse, select options, reach mission creation) produces identical topic options and decision points (when to create a mission vs. show more options) as before the migration.
- **SC-009**: Manual guided onboarding flow testing (create mission in guided mode, answer questions, reach activation) produces identical question flow and activation behavior as before the migration.

## Assumptions

- The extracted modules (`onboarding/index.ts`, `browse/explorer.ts`) are architecturally clean and were originally written as the intended destination for this logic. The migration should move toward them rather than away from them, even if both sides need adjustment.
- The workflow state and event emitter integration in the route-inline `runConversationLoop` is a recently added feature (from an earlier spec in this series) that was never backported to the extracted module. Adding it to the module is acceptable and the module's dependency injection pattern (`OnboardingDeps` interface) should be extended rather than replaced with a Hono-context-based approach.
- `src/ai/mission-conversation.ts` can be merged into `src/onboarding/index.ts` (or vice versa) since both are factories that accept dependency objects and return module interfaces. The surviving module should be in `src/onboarding/` because that directory is closer to the domain concept, but moving it to `src/ai/` is acceptable if circular dependencies require it.
- The subtle prompt difference in `mission-conversation.ts` ("AND create the first lesson") vs. `onboarding/index.ts` ("Do NOT create lessons during onboarding — wait until the mission is active") is a bug in one of the two implementations. The spec 007 (Chat-Based Mission Editing) intentionally separated activation from lesson creation. The `mission-conversation.ts` variant predates that clarification and should be corrected to match.
- The `contentToText` vs. `extractText` discrepancy is a naming difference with identical behavior. The surviving module should use the shared `contentToText` from `src/shared/messages.ts` to avoid reinventing the wheel.
- No change to the database schema, view layer (`src/views/`), or test infrastructure (`src/test/helpers.ts`) is required. All changes are confined to `src/routes/`, `src/onboarding/`, `src/ai/mission-conversation.ts`, and `src/browse/explorer.ts`.
- Manual testing of the browse and onboarding flows is sufficient for verification; no new end-to-end tests are required for this refactor.
- The `createMissionAndRedirect` function in `src/routes/browse.ts` should remain in the routes file (or move to a shared HTTP helper) — it is not a candidate for inclusion in `TopicExplorer` because it handles HTTP response construction.
