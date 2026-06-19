# Implementation Plan: Split Monolithic MissionStore

**Branch**: `ai/013-split-monolithic-store` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-split-monolithic-store/spec.md`

## Summary

Split the monolithic `MissionStore` interface (~45 methods spanning 8 domains) into 7 focused interfaces: `MissionStore` (missions, 8 methods), `LessonStore` (lessons, 14 methods), `ChatStore` (chat + guided questions, 6 methods), `ContentStore` (mission content, 2 methods), `RefDocStore` (reference docs, 3 methods), `LearningRecordStore` (learning records, 4 methods), `UserStore` (users, 4 methods). The `DrizzleMissionStore` class remains a single composite implementing all focused interfaces via one shared `BetterSQLite3Database` connection. The monolithic `InMemoryMissionStore` is replaced with 7 independent `InMemory*` classes. All 9 compatibility aliases are removed. Callers are updated to import only the focused interfaces they actually use.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), Drizzle ORM (better-sqlite3), Anthropic SDK

**Storage**: SQLite via better-sqlite3, single shared connection

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`, `FakeAiClient` for AI

**Target Platform**: Linux server (Docker Compose)

**Project Type**: Web application (server-rendered htmx frontend)

**Performance Goals**: N/A (same database, same queries)

**Constraints**: All existing tests must pass without logic changes. Import paths and type annotations may change.

**Scale/Scope**: ~610-line store.ts split into focused interfaces in same file. 6 test files updated. ~9 production files updated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ PASS | `createApp()` still injects `db`; store is created from `db` in `index.ts`. Focused `InMemory*` stores enable finer-grained test injection if needed. |
| II. HTTP-Level Integration Testing | ✅ PASS | All existing tests use `app.request()` with real in-memory SQLite. Only store types change, not test logic. |
| III. Hypermedia-Driven Frontend | ✅ N/A | No frontend changes. |
| IV. Explicit Dependency Injection | ✅ PASS | Route handlers already use `c.get("store")`. Focused interfaces make dependencies more explicit at import level. |
| V. Migration Snapshot Integrity | ✅ N/A | No schema changes. |

**Verdict**: No violations. All gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/013-split-monolithic-store/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: decisions and rationale
├── data-model.md        # Phase 1: entity/interface contracts
├── quickstart.md        # Phase 1: validation guide
└── tasks.md             # Phase 2: implementation tasks
```

### Source Code (repository root)

```text
src/
  db/
    store.ts             # 7 focused interfaces + DrizzleMissionStore composite + InMemory* classes
    store.test.ts        # Split into per-interface test files
  types.ts               # Updated AppVariables.store type
  auth/index.ts          # Use UserStore
  ai/
    types.ts             # Updated ToolHandlerContext.store type
    tools.ts             # Use focused store union type
    conversation.ts      # Use ChatStore
    mission-conversation.ts  # Use ChatStore + MissionStore + ContentStore
  onboarding/index.ts    # Use ChatStore + MissionStore
  shared/messages.ts     # Use ChatStore
  routes/
    home.ts              # Use MissionStore
    missions.ts          # Use MissionStore (composite for multi-domain access)
    lessons.ts           # Use MissionStore + LessonStore
    chat.ts              # Use MissionStore + ContentStore
    settings.ts          # Use UserStore
    browse.ts            # Use MissionStore
  index.ts               # Instantiate DrizzleMissionStore
test/                    # Updated imports
```

**Structure Decision**: Single-file store (option FR-015). Interfaces stay in `src/db/store.ts` with the `DrizzleMissionStore` composite implementation. This minimizes diff, keeps the shared DB connection trivial, and avoids circular imports. Individual interface files (FR-016) are deferred — the spec explicitly allows single-file as the primary decision.

## Complexity Tracking

> No violations to justify.
