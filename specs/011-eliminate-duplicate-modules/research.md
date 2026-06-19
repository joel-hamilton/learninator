# Research: Eliminate Duplicate Modules

## R1: Workflow/Event Hook Design for OnboardingModule

**Decision**: Add optional `workflowState` and `events` fields to `OnboardingDeps`. The module's internal `runConversationLoop` checks for their presence before calling workflow methods.

**Rationale**: The route-inline `runConversationLoop` (missions.ts:81-134) calls `wfState.startWorkflow()`, `wfState.stepUpdate()`, `wfState.completeWorkflow()`, and `wfState.failWorkflow()`, plus `events.emit()` via `createStandardHooks`. The extracted module (onboarding/index.ts) already calls `createStandardHooks` with emit support — the missing piece is the workflow lifecycle. Adding optional deps preserves backward compatibility (tests don't need workflow state).

**Alternatives considered**:
- Callback/hook pattern: Would work but adds complexity. Optional DI is simpler and follows existing patterns.
- Wrapping in the route: Would defeat the purpose of using the module — routes would still need duplicate logic.
- Requiring workflowState always: Breaks the extracted module's testability — tests would need a fake workflow manager.

## R2: contentToText vs extractText Resolution

**Decision**: Replace the extracted module's `extractText` helper with the shared `contentToText` import from `src/shared/messages.ts`.

**Rationale**: Both functions do the same thing (extract text from string or content block array). The route-inline `generateMissionTitle` already imports `contentToText` from `src/shared/messages.ts`. Using the shared version eliminates the duplicate and ensures consistent behavior.

**Alternatives considered**: None — this is a straightforward dedup.

## R3: Prompt Reconciliation Between Three Implementations

**Decision**: Keep the onboarding module's prompt variant ("Do NOT create lessons during onboarding — wait until the mission is active") and discard `mission-conversation.ts`'s variant ("AND create the first lesson").

**Rationale**: Spec 007 (Chat-Based Mission Editing) intentionally separated activation from lesson creation. The onboarding module's prompt matches this decision. `mission-conversation.ts` predates spec 007 and its prompt is incorrect.

**Alternatives considered**: None — the correct variant is unambiguous per spec 007.

## R4: mission-conversation.ts Test Migration

**Decision**: Delete `src/ai/mission-conversation.ts` and `src/ai/mission-conversation.test.ts`. Merge its content-injection logic (`buildSystemPrompt`'s mission content loading) into the onboarding module. Migrate equivalent test coverage into the existing test suite.

**Rationale**: `mission-conversation.ts` has 6 test cases but zero production usage. The onboarding module already covers the same functionality. The one unique feature (content injection for active missions) is already implemented in `missions.ts` routes (lines 695-705) — the module just needs the same capability. The test for content injection is covered by `chat.test.ts` "mission content in context (US1)" tests.

**Alternatives considered**:
- Merge onboarding into mission-conversation: Would move the module from `src/onboarding/` to `src/ai/`. The spec favors `src/onboarding/` as the domain-appropriate location.
- Keep both: Violates FR-013 (exactly one must survive).

## R5: TopicExplorer Data Contract Alignment

**Decision**: TopicExplorer's existing interface is already compatible with the route handlers. The routes will keep their HTTP-specific code (HTML rendering, `HX-Redirect`) and delegate AI logic to TopicExplorer.

**Rationale**: 
- `TopicExplorer.explore()` returns `{ options, isLastQuestion }` — the route calls `optionsOnly()` view with these values.
- `TopicExplorer.select()` returns either `{ type: "options", options, path, iteration, isLastQuestion }` or `{ type: "create_mission", topic, path }` — the route renders HTML or calls `createMissionAndRedirect()`.
- `TopicExplorer.refresh()` returns `{ options, isLastQuestion }` — the route calls `refreshOptionsFragment()`.
- The `createMissionAndRedirect()` function stays in the routes file (HTTP concern).

**Alternatives considered**: None — the contracts already align.

## R6: FakeAiClient Response Sequencing Impact

**Decision**: The refactor does NOT change the number or order of AI calls per flow. The onboarding module uses the same `conversationLoop()` with the same `TEACHER_TOOLS`. No test fixture updates needed.

**Rationale**: Verified by comparing:
- Route-inline `runConversationLoop` → calls `conversationLoop({client, toolExecutor, ...})` 
- Module's `runConversationLoop` → calls `conversationLoop({client: ai, toolExecutor, ...})`
Both pass the same parameters. Both wrap with `createStandardHooks`. Both check for `mark_mission_active`. The `generateMissionTitle` call is also identical (same prompt, same message slicing, same model: "low").

The only difference is adding workflow/event hooks — these are side effects, not AI calls.

**Alternatives considered**: N/A — no impact on sequencing.

## R7: Re-export of mission-conversation.ts

**Decision**: `src/ai/index.ts` does NOT re-export anything from `mission-conversation.ts`. No import changes needed for the deletion.

**Rationale**: Confirmed by reading `src/ai/index.ts` — it only re-exports types, `AnthropicAiClient`, `FakeAiClient`, and `AIError`. The `mission-conversation.ts` module is only imported by its own test file.

**Alternatives considered**: N/A — no re-export exists.
