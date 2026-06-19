# Implementation Plan: Eliminate Duplicate Modules

**Branch**: `ai/011-eliminate-duplicate-modules` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-eliminate-duplicate-modules/spec.md`

## Summary

Resolve the dead/duplicate extraction problem. The implementation on this branch has already:
- Created `src/services/mission-chat.service.ts` as the canonical service for mission chat and onboarding (replacing inline code in routes AND the deleted `mission-conversation.ts`)
- Wired all routes to `missionChatService.run()` and `missionChatService.generateTitle()`
- Wired browse routes to `TopicExplorer` via `createTopicExplorer()`
- Deleted `src/ai/mission-conversation.ts` (the third redundant implementation)

**Remaining work**: Delete the dead `src/onboarding/index.ts` module (zero production imports) and its test file. Verify all tests pass, inline code is gone, and the app boots cleanly.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (web framework), Drizzle ORM, Anthropic SDK, better-sqlite3

**Storage**: SQLite via Drizzle (MissionStore interface)

**Testing**: Vitest with in-memory SQLite, FakeAiClient (queue-based), HTTP-level via `app.request()`

**Target Platform**: Node.js server

**Project Type**: Web application (htmx-driven frontend)

**Performance Goals**: No regression — refactor only, no behavioral changes

**Constraints**: All existing tests must pass. No schema changes. No view changes. No test infrastructure changes.

**Scale/Scope**: 2 files deleted (onboarding/index.ts + test), 0 files added (mission-chat.service.ts already exists), verification-only on remaining files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Factory-Based Testability | PASS | `createMissionChatService()` factory accepts injectable deps. `createTopicExplorer()` factory pattern. App-level injection via Hono context. |
| II. HTTP-Level Integration Testing | PASS | All existing tests use `app.request()` with FakeAiClient. Routes delegate to injected services without changing HTTP behavior. |
| III. Hypermedia-Driven Frontend | PASS | No view changes. Routes continue returning htmx fragments identical to before. |
| IV. Explicit Dependency Injection | PASS | `MissionChatDeps` and `TopicExplorerDeps` are explicit parameter objects. `c.get("missionChatService")` replaces inline code — dependencies visible at injection site. |
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

### Source Code (repository root) — post-migration

```text
src/
  services/
    mission-chat.service.ts    # Canonical service for all mission chat + onboarding
  onboarding/
    index.ts                   # DELETED — dead code, zero production imports
    index.test.ts              # DELETED — coverage exists at HTTP level
  browse/
    explorer.ts                # Unchanged — already wired to browse routes
  ai/
    mission-conversation.ts    # Already deleted — merged into mission-chat.service.ts
  routes/
    missions.ts                # Clean — delegates to missionChatService
    onboarding.ts              # Clean — delegates to missionChatService
    browse.ts                  # Clean — delegates to TopicExplorer
    chat.ts                    # Clean — delegates to missionChatService
    lessons.ts                 # Clean — delegates to missionChatService
```

**Structure Decision**: `src/services/mission-chat.service.ts` is the canonical implementation. It subsumes the deleted `onboarding/index.ts`, `ai/mission-conversation.ts`, and the former inline code in routes. It is placed in `src/services/` — a new directory — to avoid circular dependencies between `src/onboarding/` and `src/ai/` and to make clear that it serves multiple route layers.

## Complexity Tracking

> No violations — all changes are within existing patterns.
