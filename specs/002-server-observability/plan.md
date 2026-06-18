# Implementation Plan: Server Observability

**Branch**: `002-server-observability` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-server-observability/spec.md`

## Summary

Add structured per-request debug logging (gated by `DEBUG` env var) and an in-memory endpoint profiler with an HTML report route (gated by `PROFILE` env var). The core fix addresses the root cause of the 58s-vs-1ms timing discrepancy: the current logging middleware measures only handler execution time via `Date.now()` around `await next()`, but streaming responses (SSE) return immediately after stream setup. The new timing wraps the full request lifecycle — including response body write to the socket — so streaming duration is captured separately.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), @hono/node-server (Node.js adapter)

**Storage**: In-memory (no database changes) — a `Map<string, EndpointStats>` for profiling data. Data is ephemeral; restarts reset it.

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`. New tests in `src/test/observability.test.ts`.

**Target Platform**: Node.js server (Linux/macOS, dev + Docker Compose)

**Project Type**: Web application (htmx frontend + Hono backend)

**Performance Goals**: DEBUG logging adds <2ms overhead per request. Profile report renders in <100ms with up to 1,000 tracked endpoints. In-memory profile data bounded at ~500 unique endpoint entries.

**Constraints**: Must be injectable through `createApp()` factory (Constitution I). Must work with existing Hono middleware chain. Profile route must return HTML (Constitution III). No production overhead when both env vars are off.

**Scale/Scope**: Single server instance, developer tooling. Not a production APM solution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Factory-Based Testability | PASS | Observability middleware + profile store are created inside `createApp()` and injected via context. Tests inject fake stores. |
| II. HTTP-Level Integration Testing | PASS | New tests use `app.request()` with real in-memory SQLite. Profile route tested via HTTP. |
| III. Hypermedia-Driven Frontend | PASS | Profile report returns an HTML page (template literal in `src/views/`). No JSON API, no frontend build step. |
| IV. Explicit Dependency Injection | PASS | Profile store and debug config passed via `AppVariables` / middleware `c.set()`. No module-level singletons for observability state. |
| V. Manual Migration Discipline | N/A | No database changes. |

**Gate result**: All applicable principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-server-observability/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
  observability/
    index.ts             # createObservability() — wires debug + profile middleware
    debug.ts             # DebugMiddleware — request ID, per-phase timing, structured log lines
    profile.ts           # ProfileStore — in-memory stats accumulator + report generation
  views/
    profile.ts           # profileReport() — HTML template for /debug/profile
  test/
    observability.test.ts  # Integration tests for debug logging and profile report
```

**Structure Decision**: New `src/observability/` module following the existing pattern of `src/ai/`, `src/auth/`, `src/onboarding/` — each is a self-contained subsystem with its own `index.ts` entry point. The profile report view goes in `src/views/` alongside existing view files.

## Complexity Tracking

No constitution violations. This section intentionally empty.
