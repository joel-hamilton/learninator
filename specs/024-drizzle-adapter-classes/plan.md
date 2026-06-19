# Implementation Plan: Drizzle Adapter Classes

**Branch**: `024-drizzle-adapter-classes` | **Date**: 2026-06-19 | **Spec**: `specs/024-drizzle-adapter-classes/spec.md`

**Input**: Feature specification from `specs/024-drizzle-adapter-classes/spec.md`

## Summary

Replace the monolithic `DrizzleMissionStore` class (406 lines, implements 8 store interfaces) with 8 focused Drizzle adapter classes, one per store interface. Each adapter lives in its own file under `src/db/adapters/`. Delete the `InMemoryToolStore` delegation composite (76 lines). Wire the adapters separately in `createApp()`. No changes to store interfaces or InMemory* stores.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Drizzle ORM (better-sqlite3), Hono (web framework)

**Storage**: SQLite via better-sqlite3, Drizzle ORM with type-safe query building

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`

**Target Platform**: Linux server (Docker), macOS development

**Project Type**: Web application (Hono + htmx server-rendered)

**Performance Goals**: No performance impact expected — adapters share the same database connection. Each adapter wraps the same Drizzle query patterns used today.

**Constraints**: All adapters share a single `BetterSQLite3Database<typeof schema>` instance. Must maintain existing `c.get("store")` context variable pattern.

**Scale/Scope**: ~8 new adapter files (each 20-60 lines), delete `InMemoryToolStore`, update wire points in `src/index.ts` and `src/ai/tools.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Factory-Based Testability — PASS
The `createApp()` factory already accepts injectable `db`. Individual Drizzle adapters will be injected through the same factory pattern. No regression.

### II. HTTP-Level Integration Testing — PASS
Tests use `app.request()` with real in-memory SQLite. Drizzle adapter classes query real SQLite the same way `DrizzleMissionStore` does today. No mock objects introduced.

### III. Hypermedia-Driven Frontend — PASS (N/A)
Store layer has no frontend impact.

### IV. Explicit Dependency Injection — PASS
The refactor makes dependency injection MORE explicit by surfacing individual store interfaces at each call site rather than a single composite type.

### V. Migration Snapshot Integrity — PASS (N/A)
No schema changes in this feature.

### Additional principle: YAGNI (No speculative features) — PASS
The adapter split is directly motivated by the existing monolithic class size. Each adapter is created because the interface it implements already exists. No speculative abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/024-drizzle-adapter-classes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── store.ts         # Interfaces + InMemory stores (unchanged)
│   ├── adapters/        # NEW — Drizzle adapters
│   │   ├── drizzle-mission-adapter.ts
│   │   ├── drizzle-lesson-adapter.ts
│   │   ├── drizzle-chat-adapter.ts
│   │   ├── drizzle-content-adapter.ts
│   │   ├── drizzle-refdoc-adapter.ts
│   │   ├── drizzle-learning-record-adapter.ts
│   │   ├── drizzle-user-adapter.ts
│   │   └── drizzle-session-adapter.ts
│   └── index.ts         # DB connection (unchanged)
├── index.ts             # createApp() — wire individual adapters
├── ai/
│   └── tools.ts         # createToolExecutor — accept explicit store interfaces
├── services/
│   └── mission-chat.service.ts  # Accept explicit store interfaces
└── lessons/
    └── generator.ts     # Accept explicit store interfaces
```

**Structure Decision**: Adapter classes live in `src/db/adapters/` alongside the existing `store.ts`. This groups all Drizzle implementations together while keeping each adapter in its own file.

## Complexity Tracking

No constitutional violations. The refactor reduces complexity (one 406-line class → eight ~30-line classes).
