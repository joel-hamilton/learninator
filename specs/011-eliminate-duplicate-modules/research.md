# Research: Eliminate Duplicate Modules

**Date**: 2026-06-19 | **Plan**: [plan.md](./plan.md)

## R1: Current state — what's already been done

**Decision**: The implementation on this branch has already resolved most of the duplication. A new `src/services/mission-chat.service.ts` was created as the canonical service for all mission chat and onboarding. Routes delegate to `missionChatService.run()` and `missionChatService.generateTitle()`. Browse routes already use `TopicExplorer` via `createTopicExplorer()`. The original third implementation (`src/ai/mission-conversation.ts`) is already deleted.

**Rationale**: The service-layer approach is superior to wiring routes directly to `createOnboarding()` because it:
- Unifies onboarding chat AND active-mission chat in one service
- Integrates workflow state (`WorkflowStateManager`) and event bus (`EventBus`) natively
- Injects mission content and lesson context into the system prompt for active-mission chats
- Handles all AI interaction patterns (guided pause, skip, mode switch, chat, lesson generation)
- Already wired to all 5 route files (missions.ts, onboarding.ts, chat.ts, lessons.ts)

**Alternatives considered**:
- Wiring routes to `createOnboarding()` from `src/onboarding/index.ts`: Rejected because that module lacks workflow/event support, mission content injection, and lesson context — adding those would duplicate `mission-chat.service.ts`.
- Keeping both `onboarding/index.ts` and `mission-chat.service.ts`: Rejected — creates confusion. The spec requires exactly one implementation (FR-013).

## R2: Remaining dead code — `src/onboarding/index.ts`

**Decision**: Delete `src/onboarding/index.ts` and `src/onboarding/index.test.ts`. The module has zero production imports — only its own test file references `createOnboarding`. The `mission-chat.service.ts` covers the union of all onboarding scenarios plus active-mission chat, lesson context, and content injection.

**Rationale**: FR-013 requires exactly one implementation to survive. The surviving implementation is `src/services/mission-chat.service.ts`. The onboarding module (`src/onboarding/index.ts`) became dead code when routes were wired to `missionChatService` instead.

**Test coverage**: The onboarding module's test (`onboarding/index.test.ts`) has 13 test cases covering start, continueGuided, answerQuestion, skipQuestions, and switchMode. The same scenarios are exercised at the HTTP level through existing tests (`missions.test.ts`, `chat.test.ts`, `onboarding.test.ts`). Per the Constitution's Principle II (HTTP-Level Integration Testing), HTTP-level coverage is the project's preferred testing approach. No coverage is lost.

**Alternatives considered**:
- Keeping `onboarding/index.ts` as-is: Rejected — violates FR-013. Dead code.
- Porting onboarding tests to a `mission-chat.service.test.ts`: Rejected as out of scope for this refactor. HTTP-level tests already cover the service's behavior.

## R3: Browse migration — verified complete

**Decision**: No additional work needed. `src/routes/browse.ts` already uses `createTopicExplorer()` for all three routes. No inline `BROWSE_SYSTEM_PROMPT`, `parseBrowseResponse`, `FALLBACK_OPTIONS`, or `FALLBACK_NARROW_OPTIONS` remain.

**Rationale**: Confirmed via grep — constants and functions exist only in `src/browse/explorer.ts`. Route file is 121 lines, meeting SC-003.

## R4: Prompt consistency

**Decision**: The guiding prompt in `mission-chat.service.ts` says "Do NOT create lessons during onboarding — wait until the mission is active." This matches the spec's assumption that the `mission-conversation.ts` variant ("AND create the first lesson") was the buggy one and should be corrected.

**Rationale**: Spec 007 intentionally separated activation from lesson creation.

## R5: FakeAiClient response sequencing

**Decision**: No fixture changes needed. The `missionChatService.run()` method calls `conversationLoop()` with the same parameters as the inline code did. Activation still triggers `generateTitle()` (one additional `ai.chat()` call with model: "low"). The call sequence is unchanged from the inline implementation.

**Rationale**: Confirmed by comparing the service's `run()` method with the former inline `runConversationLoop()`.
