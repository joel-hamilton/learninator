# Research: Eliminate Duplicate Modules

## R1: Canonical Implementation Strategy

**Decision**: Create a new `MissionChatService` in `src/services/mission-chat.service.ts` as the canonical onboarding+chat+lesson-chat conversation service. Routes access it via Hono context injection (`c.get("missionChatService")`).

**Rationale**: The original plan proposed extending `OnboardingDeps` with optional `workflowState` and `events` fields, then wiring routes to `createOnboarding()`. During implementation, a service-layer pattern was chosen instead because:
- It consolidates ALL conversation flows (onboarding prompts, active chat, lesson-specific chat) in one place rather than splitting between `onboarding/index.ts` and inline route code
- Required deps (no optional/null checking) makes the code simpler
- Follows the existing `LessonGenerator` service-layer pattern already established in the codebase
- Aligns with Constitution Principle IV (Explicit Dependency Injection via context)

**Alternatives considered**:
- Extending OnboardingDeps with optional workflowState/events: Would work but spreads logic across two modules and requires null checks. Rejected in favor of the service pattern.
- Keeping onboarding module as the canonical implementation: Would still require a separate service for chat/lesson flows. More complexity, same result.
- Keeping all three onboarding implementations: Violates FR-013 and leaves ambiguity about which to use.

## R2: contentToText vs extractText Resolution

**Decision**: MissionChatService uses inline text extraction (same logic as `contentToText` from `src/shared/messages.ts`) in its `generateTitle` method. The old `onboarding/index.ts` `extractText` helper is dead code along with the rest of the module.

**Rationale**: The `generateTitle` method in `mission-chat.service.ts` extracts text inline for the conversation summary. The shared `contentToText` is used by route rendering code. Both implementations are equivalent — the inline version in the service avoids an extra import for a two-line helper.

**Alternatives considered**: Import `contentToText` directly — would work but adds a dependency from services/ to shared/ for a trivial helper. Inline is acceptable here.

## R3: Prompt Reconciliation Between Three Implementations

**Decision**: Keep the onboarding prompt variant "Do NOT create lessons during onboarding — wait until the mission is active" from the onboarding module. The `mission-conversation.ts` variant ("AND create the first lesson") was a bug (predates spec 007) and was discarded.

**Rationale**: Spec 007 (Chat-Based Mission Editing) intentionally separated activation from lesson creation. The corrected prompt is now in one place: `mission-chat.service.ts`'s `buildSystemPrompt()` method.

**Alternatives considered**: None — the correct variant is unambiguous per spec 007.

## R4: mission-conversation.ts Deletion

**Decision**: Delete `src/ai/mission-conversation.ts` and its test file. Its functionality (content injection into system prompt, conversation loop wrapping, title generation) is implemented in `mission-chat.service.ts`.

**Rationale**: `mission-conversation.ts` had 6 test cases but zero production usage. The `MissionChatService` covers all of its functionality plus workflow state, events, and lesson-specific chat. The HTTP-level tests in `chat.test.ts` and `missions.test.ts` already cover the production paths that `mission-conversation.test.ts` was testing at the unit level.

**Alternatives considered**:
- Merge mission-conversation into onboarding module: Would have the same problem — the module still wouldn't have workflow/event support. Rejected.
- Keep both: Violates FR-013 (exactly one must survive). Rejected.

## R5: TopicExplorer Data Contract Alignment

**Decision**: TopicExplorer's existing interface was already compatible with the route handlers. No changes needed. The browse routes were wired directly to `createTopicExplorer()` with a thin `getExplorer(c)` helper.

**Rationale**: 
- `TopicExplorer.explore()` returns `{ options, isLastQuestion }` — the route calls `optionsOnly()` with these values
- `TopicExplorer.select()` returns either `{ type: "options", ... }` or `{ type: "create_mission", ... }` — the route handles each case
- `TopicExplorer.refresh()` returns `{ options, isLastQuestion }` — the route calls `refreshOptionsFragment()`
- `createMissionAndRedirect()` stays in the routes file (HTTP concern)

**Alternatives considered**: None — the contracts aligned from the start.

## R6: FakeAiClient Response Sequencing Impact

**Decision**: The refactor does NOT change the number or order of AI calls per flow. `MissionChatService.run()` uses the same `conversationLoop()` with the same `TEACHER_TOOLS`. No test fixture updates needed.

**Rationale**: Verified by comparing the old route-inline `runConversationLoop` and the new `MissionChatService.run()` — both call `conversationLoop()` with the same parameters. Both wrap with `createStandardHooks`. Both track `mark_mission_active`. The `generateTitle` call is also identical (same prompt, same message slicing, same model: "low"). Workflow/event hooks are side effects, not AI calls.

**Alternatives considered**: N/A — no impact on sequencing.

## R7: Re-export Audit

**Decision**: `src/ai/index.ts` does NOT re-export anything from `mission-conversation.ts` or `onboarding/index.ts`. No barrel-file changes needed.

**Rationale**: Confirmed by reading `src/ai/index.ts` — it only re-exports types, `AnthropicAiClient`, `FakeAiClient`, and `AIError`. Neither `mission-conversation.ts` nor `onboarding/index.ts` were ever in the barrel file.

**Alternatives considered**: N/A — no re-exports exist.

## R8: Disposition of Dead onboarding/index.ts

**Decision**: `src/onboarding/index.ts` and `src/onboarding/index.test.ts` are dead code to be deleted. They are superseded by `src/services/mission-chat.service.ts`.

**Rationale**: The module is only imported by its own test file. All production routes use `missionChatService` from context. The unit-level test coverage (12 test cases in `index.test.ts`) covers the same flows tested at HTTP level by `missions.test.ts` and `chat.test.ts` (guided onboarding, activation, skip, mode switch). Deleting the dead module and its test removes 754 lines of dead code and eliminates confusion about which implementation to use.

**Alternatives considered**:
- Keep onboarding module and wire routes to it: Would require refactoring routes to use a different API. The `MissionChatService` API is already simpler (`run(input)` vs 5 separate methods). Rejected.
- Keep both service and module: Violates the "one implementation" principle this spec exists to enforce. Rejected.
