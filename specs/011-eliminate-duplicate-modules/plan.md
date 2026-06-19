# Implementation Plan: Eliminate Duplicate Modules

**Branch**: `ai/011-eliminate-duplicate-modules` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-eliminate-duplicate-modules/spec.md`

## Summary

Resolve the dead/duplicate extraction problem where `src/onboarding/index.ts` and `src/browse/explorer.ts` were extracted as clean modules but `src/routes/missions.ts` and `src/routes/browse.ts` retain full inline copies of the same logic. Wire routes to use the extracted modules, extend the onboarding module's dependency injection to support workflow/event hooks, delete the third redundant onboarding implementation (`src/ai/mission-conversation.ts`), and verify all dead code is removed.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (web framework), Drizzle ORM, Anthropic SDK, better-sqlite3

**Storage**: SQLite via Drizzle (MissionStore interface)

**Testing**: Vitest with in-memory SQLite, FakeAiClient (queue-based), HTTP-level via `app.request()`

**Target Platform**: Node.js server

**Project Type**: Web application (htmx-driven frontend)

**Performance Goals**: No regression — refactor only, no behavioral changes

**Constraints**: All existing tests must pass. No schema changes. No view changes. No test infrastructure changes.

**Scale/Scope**: ~5 files modified, ~200 LOC deleted (inline duplicates), ~30 LOC added (workflow hooks in module), 1 file deleted (mission-conversation.ts + its test)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Factory-Based Testability | PASS | Onboarding module already uses factory pattern. Workflow/events deps added as optional params to dep interface, preserving testability with null defaults. |
| II. HTTP-Level Integration Testing | PASS | All existing tests use `app.request()` with FakeAiClient. The refactor wires modules without changing HTTP behavior — existing test assertions remain valid. |
| III. Hypermedia-Driven Frontend | PASS | No view changes. Routes continue returning htmx fragments identical to before. |
| IV. Explicit Dependency Injection | PASS | Onboarding module already accepts `OnboardingDeps`. Extending it adds optional `workflowState` and `events` fields — no hidden singletons. |
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
└── tasks.md             # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
src/
  onboarding/
    index.ts             # Extended with workflow/event hooks, merged mission-conversation content injection
  browse/
    explorer.ts          # Unchanged (already has correct interface)
  ai/
    mission-conversation.ts      # DELETED — merged into onboarding/index.ts
    mission-conversation.test.ts # DELETED — tests migrated to onboarding test
  routes/
    missions.ts          # Inline helpers removed, wired to createOnboarding()
    browse.ts            # Inline constants/helpers removed, wired to TopicExplorer
```

**Structure Decision**: The surviving onboarding module is placed in `src/onboarding/` (domain concept). `src/ai/mission-conversation.ts` is deleted and its content-injection logic and tests are merged into the onboarding module. `src/browse/explorer.ts` is used as-is by routes.

## Complexity Tracking

> No violations — all changes are within existing patterns.
