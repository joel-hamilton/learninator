# Quickstart: Decompose MissionChatService.run()

**Date**: 2026-06-20
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- Existing test suite passes (`npm test`)

## Setup

No database setup needed — tests use in-memory SQLite.

## Validation Scenarios

### 1. Existing integration tests continue to pass

```bash
npm test
```

Expected outcome: All existing tests pass. This confirms the `run(input) -> MissionChatResult` external seam is unchanged.

### 2. New unit tests pass

```bash
npm test -- --reporter verbose
```

Expected outcome: New unit tests for `prepareMessages`, `executeConversation`, `handlePostChat`, `buildSystemPrompt`, and `generateTitle` pass. These tests exercise each pipeline stage in isolation.

### 3. buildSystemPrompt branch coverage

The new tests should verify all 4 branches:
- `missionStatus === "onboarding"` + `onboardingMode === "guided"` -> prompt contains "Guided Onboarding Mode"
- `missionStatus === "onboarding"` + `onboardingMode === "chat"` -> prompt contains "Chat Onboarding Mode"
- `lesson` provided -> prompt contains lesson number and title
- Active mission with/without stored content -> prompt contains/omits "Current mission goals:"

### 4. Activation flow

```bash
npm test -- --run src/test/chat.test.ts  # Still passes
npm test -- --run src/test/missions.test.ts  # Still passes
```

Expected outcome: The activation flow (guided Q&A -> mark_mission_active -> title generation -> HX-Redirect) works end-to-end through the refactored pipeline.

## Manual Testing (if running the dev server)

1. Create a new mission with guided onboarding
2. Answer the guided questions
3. Observe the mission activates and redirects to the mission page
4. Send a chat message on an active mission
5. Verify the assistant replies normally

## Rollback

If the refactoring introduces a bug:

```bash
git checkout main -- src/services/mission-chat.service.ts src/test/
```

Then re-run `npm test` to confirm the original behavior is restored.
