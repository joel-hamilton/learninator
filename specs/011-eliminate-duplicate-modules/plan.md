# Implementation Plan: Eliminate Duplicate Modules

**Branch**: `ai/011-eliminate-duplicate-modules` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-eliminate-duplicate-modules/spec.md`

## Summary

Resolve the dead/duplicate extraction problem where `src/onboarding/index.ts` and `src/browse/explorer.ts` were extracted as clean modules but `src/routes/missions.ts` and `src/routes/browse.ts` retained full inline copies of the same logic. Implementation created `src/services/mission-chat.service.ts` as the canonical onboarding+chat service, wired browse routes to `TopicExplorer`, deleted `src/ai/mission-conversation.ts`, and left `src/onboarding/index.ts` as dead code to be cleaned up.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (web framework), Drizzle ORM, Anthropic SDK, better-sqlite3

**Storage**: SQLite via Drizzle (MissionStore interface)

**Testing**: Vitest with in-memory SQLite, FakeAiClient (queue-based), HTTP-level via `app.request()`

**Target Platform**: Node.js server

**Project Type**: Web application (htmx-driven frontend)

**Performance Goals**: No regression — refactor only, no behavioral changes

**Constraints**: All existing tests must pass. No schema changes. No view changes. No test infrastructure changes.

**Scale/Scope**: 
- Created: `src/services/mission-chat.service.ts` (231 lines — canonical onboarding/chat service)
- Already wired: `src/routes/browse.ts` → `TopicExplorer` (browse dedup complete)
- Already wired: `src/routes/missions.ts`, `src/routes/onboarding.ts`, `src/routes/chat.ts`, `src/routes/lessons.ts` → `missionChatService`
- Deleted: `src/ai/mission-conversation.ts` + its test (third onboarding implementation)
- Remaining cleanup: `src/onboarding/index.ts` + `src/onboarding/index.test.ts` (dead code, superseded by mission-chat.service.ts)

## Actual Implementation Decision

The implementation diverged from the original plan of extending `OnboardingDeps` with optional `workflowState`/`events` fields. Instead, a dedicated `MissionChatService` was created in `src/services/mission-chat.service.ts`. This service:

- Accepts required `workflowState`, `events`, `ai`, `toolExecutor`, `store`, and `logger` via `MissionChatDeps`
- Exposes `run(input)` and `generateTitle(missionId)` methods
- Handles onboarding prompt building, active-mission content injection, lesson-specific chat, workflow lifecycle, SSE events, and title generation
- Is injected into Hono context via `c.get("missionChatService")` — following Constitution Principle IV (Explicit Dependency Injection)
- Is consumed by 4 route files: `missions.ts`, `onboarding.ts`, `chat.ts`, `lessons.ts`

**Why this design over extending OnboardingModule**: The service-layer pattern avoids optional DI fields with null checks, consolidates all onboarding/chat/lesson conversation logic in one place, and aligns with the existing `LessonGenerator` service pattern already in the codebase.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Factory-Based Testability | PASS | MissionChatService uses factory pattern (`createMissionChatService(deps)`). All deps injectable. Testable with FakeAiClient. |
| II. HTTP-Level Integration Testing | PASS | All existing tests use `app.request()` with FakeAiClient. Routes call `missionChatService.run()` which uses the same `conversationLoop()` — HTTP behavior unchanged. |
| III. Hypermedia-Driven Frontend | PASS | No view changes. Routes continue returning htmx fragments identical to before. |
| IV. Explicit Dependency Injection | PASS | MissionChatService injected via `c.get("missionChatService")` in every route handler. No hidden singletons. |
| V. Migration Snapshot Integrity | PASS | No schema changes. |

## Project Structure

### Documentation (this feature)

```text
specs/011-eliminate-duplicate-modules/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── mission-chat-service.md
│   └── topic-explorer.md
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
src/
  services/
    mission-chat.service.ts    # Canonical onboarding/chat service (CREATED)
  onboarding/
    index.ts                   # SUPERSEDED — dead code, only imported by own test
    index.test.ts              # TO DELETE — coverage exists at HTTP level
  browse/
    explorer.ts                # Alive — used by browse routes via createTopicExplorer()
  ai/
    mission-conversation.ts    # DELETED — merged into mission-chat.service.ts
  routes/
    missions.ts                # Wired to missionChatService (no inline onboarding)
    onboarding.ts              # Wired to missionChatService (no inline onboarding)
    browse.ts                  # Wired to TopicExplorer (no inline browse constants)
    chat.ts                    # Wired to missionChatService
    lessons.ts                 # Wired to missionChatService
```

**Structure Decision**: The canonical onboarding/chat implementation lives in `src/services/` as `mission-chat.service.ts`, following the same service-layer pattern as `LessonGenerator`. `src/onboarding/index.ts` is dead code to be deleted — its unit tests are redundant with HTTP-level test coverage in `missions.test.ts` and `chat.test.ts`.

## Complexity Tracking

> The implementation diverged from the original plan (extending OnboardingDeps) by creating a dedicated service. This is a pattern-consistent decision — `LessonGenerator` already uses the same service-layer approach. No constitutional violations.
