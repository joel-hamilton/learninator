# Implementation Plan: Extract JobStore Interface

**Branch**: `021-extract-job-store` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-extract-job-store/spec.md`

## Summary

Extract a `JobStore` interface from `LessonGenerator`'s internal `Map<string, InternalJob>`, splitting lesson generation orchestration (AI calls, prompt building, conversationLoop) from job state management (dedup, status polling, error storage). Provide `InMemoryJobStore` wrapping the current `Map` behavior, and wire it through `GeneratorDeps`. No persistent adapter is created — just the seam and the in-memory implementation. The 60-second `setTimeout` cleanup stays in `LessonGenerator`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: None new. Existing: Hono, Drizzle ORM, better-sqlite3, Anthropic SDK

**Storage**: None new. The `InMemoryJobStore` uses an in-memory `Map<string, InternalJob>` (same as current). Persistent storage is out of scope.

**Testing**: Vitest (existing test suite). All existing tests must pass without modification.

**Target Platform**: Server-side Node.js 22 (Docker Compose deployment)

**Project Type**: Web application (single-process Node.js with Hono + htmx)

**Performance Goals**: Job store operations are sub-millisecond (in-memory `Map`). The interface is designed so a persistent adapter can be swapped in later without affecting `LessonGenerator`.

**Constraints**: No new third-party dependencies. No schema changes. The `buildJobKey()` and `JobStatus` exports must remain stable.

**Scale/Scope**: Single-server process. Generation jobs are short-lived (seconds to minutes). The interface extraction is purely a code organization change — no behavioral change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| **I. Factory-Based Testability** | `JobStore` interface enables injectable job state. `InMemoryJobStore` can be swapped in tests. | PASS |
| **II. HTTP-Level Integration Testing** | Existing tests exercise full request/cycle via `app.request()`. No test changes needed. | PASS |
| **III. Hypermedia-Driven Frontend** | Not relevant (pure backend refactoring). | N/A |
| **IV. Explicit Dependency Injection** | This feature IS explicit DI — replacing `new Map()` internal state with an injected `JobStore` via `GeneratorDeps`. | PASS |
| **V. Migration Snapshot Integrity** | No schema changes. | N/A |
| **YAGNI (Dev Workflow)** | Only `InMemoryJobStore` is built. Persistent adapter is explicitly deferred. The interface is the minimum seam needed. | PASS |

**Gate result**: PASS. No violations. The Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/021-extract-job-store/
├── plan.md              # This file
├── research.md          # Phase 0 — no unknowns to research
├── data-model.md        # Phase 1 — JobStore interface + InMemoryJobStore
├── quickstart.md        # Phase 1 — validation guide
├── contracts/           # Phase 1 — JobStore contract
└── tasks.md             # Phase 2 (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/
└── lessons/
    ├── generator.ts      # LessonGenerator — now uses JobStore via deps
    ├── job-store.ts      # JobStore interface + InMemoryJobStore (NEW)
    └── index.ts          # Re-exports (if needed)
```

**Structure Decision**: Single project. The new `JobStore` interface and `InMemoryJobStore` class live in `src/lessons/job-store.ts` alongside the existing `generator.ts`. This keeps the interface co-located with its primary consumer and avoids unnecessary module relocations.
