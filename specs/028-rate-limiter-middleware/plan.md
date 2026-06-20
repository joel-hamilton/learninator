# Implementation Plan: Rate Limiter Middleware

**Branch**: `028-rate-limiter-middleware` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/028-rate-limiter-middleware/spec.md`

## Summary

Extract the duplicated rate-limit guard pattern (7 instances across 2 route files) into a reusable Hono middleware factory. Each inline block that reads `rateLimiter` from context, calls `.check()`, and conditionally returns `rateLimitedFragment()` will be replaced by a middleware declaration in the route chain. The middleware is a pure refactor — no rate limit thresholds, action names, or behavior changes.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (lightweight web framework) — the middleware factory produces standard Hono middleware compatible with `new Hono<{ Variables: AppVariables }>()` route chains.

**Storage**: N/A — rate limiter state is held in an in-memory `SlidingWindowRateLimiter` instance, not persisted. No data model changes.

**Testing**: Vitest with in-memory SQLite and `FakeAiClient`. Tests use `app.request()` for HTTP-level testing. Rate-limiter-specific tests exist in `src/test/security/auth-rate-limiter.test.ts` and `src/test/security.test.ts`.

**Target Platform**: Linux server (Docker), macOS for development

**Project Type**: Web application (Hono + htmx, server-rendered HTML)

**Performance Goals**: Rate limiting adds sub-millisecond overhead — negligible. No impact on p95 response times.

**Constraints**: Must preserve existing null-check behavior when `rateLimiter` is not configured (test mode). Must not alter any rate limit thresholds or action names.

**Scale/Scope**: 7 guard blocks in 2 route files. Auth routes using IP-based rate limiting (`checkByKey`) are explicitly out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Rationale |
|------|--------|-----------|
| I. Factory-Based Testability | PASS | Middleware reads `rateLimiter` from Hono context (`c.get("rateLimiter")`) — the same mechanism used by the existing guards. Null-rateLimiter behavior is preserved. No singletons introduced. |
| II. HTTP-Level Integration Testing | PASS | Tests can verify rate limiting via `app.request()` without changes to the test infrastructure. The existing `createTestApp()` already injects `rateLimiter: null` for test mode. |
| III. Hypermedia-Driven Frontend | PASS | Middleware returns the same HTML fragment (`rateLimitedFragment()`) as the current guards — hypermedia contract unchanged. |
| IV. Explicit Dependency Injection | PASS | Middleware reads `rateLimiter` from context, consistent with how all other dependencies are accessed. |
| V. Migration Snapshot Integrity | PASS | No schema changes. |
| No speculative features (YAGNI) | PASS | This is a consolidation of an existing pattern, not a new abstraction for hypothetical scenarios. |

**Result**: ALL GATES PASS. No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/028-rate-limiter-middleware/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

The feature changes existing files only — no new source files needed beyond the middleware module itself. The overall directory structure is unchanged:

```text
src/
├── security/              # Middleware lives here alongside existing rate limiter code
│   ├── index.ts           # Re-export new middleware
│   ├── input-limits.ts    # rateLimitedFragment() stays here
│   ├── rate-limiter.ts    # SlidingWindowRateLimiter — unchanged
│   └── rate-limit-middleware.ts  # NEW: rateLimit() middleware factory
├── routes/
│   ├── missions.ts        # 3 guard blocks replaced with middleware
│   └── lesson-generation.ts  # 4 guard blocks replaced with middleware
├── auth/
│   └── index.ts           # Auth routes — NOT modified (IP-based, out of scope)
└── index.ts               # App factory — unchanged (rateLimiter already in context)
```

**Structure Decision**: Single project (unchanged). The middleware factory is a focused module within the existing `src/security/` directory alongside the rate limiter implementation it wraps.

## Complexity Tracking

No violations — all constitution gates pass. Table omitted.

## Phase 0: Research

No research needed. The implementation path is well-understood from the spec and codebase analysis:

- **What the middleware factory looks like**: A function `rateLimit(action, max, windowMs)` that returns a Hono middleware function. The middleware reads `rateLimiter` from context, calls `rateLimiter.check(user.id, action, max, windowMs)`, and returns `c.html(rateLimitedFragment())` on limit hit, or calls `next()` to proceed.
- **Where the middleware is applied**: In route chain declarations, e.g., `missionRoutes.post("/", auth.requireAuth, rateLimit("mission_create", 5, 60_000), async (c) => { ... })`
- **What to remove from route handlers**: The inline guard block, the `rateLimiter` const, and the `rateLimitedFragment` import (if no longer used elsewhere in that file).
- **Current guard instances to convert** (7 total, not 6 as originally stated):

  | File | Line | Route | Action | Max | Window |
  |------|------|-------|--------|-----|--------|
  | missions.ts | 73-76 | POST `/` | `mission_create` | 5 | 60s |
  | missions.ts | 122-125 | POST `/new` | `mission_create` | 5 | 60s |
  | missions.ts | 295-298 | POST `/:missionId/chat` | `chat` | 20 | 60s |
  | lesson-generation.ts | 77-80 | POST `/:number/generate-next` | `lesson_gen` | 10 | 60s |
  | lesson-generation.ts | 126-129 | POST `/:number/generate-sub-lesson` | `lesson_gen` | 10 | 60s |
  | lesson-generation.ts | 157-160 | POST `/:number/regenerate` | `lesson_gen` | 10 | 60s |
  | lesson-generation.ts | 190-193 | POST `/:number/generate-bridging` | `lesson_gen` | 10 | 60s |

**Output**: `research.md` — confirming the above findings with codebase evidence.

## Phase 1: Design & Contracts

### Data model

No new data entities. The middleware is stateless — it delegates to the existing `SlidingWindowRateLimiter` which already manages its own state.

**Output**: `data-model.md` — confirming no data model changes.

### Contracts

The middleware factory is an internal API consumed by route modules:

- **Factory function**: `rateLimit(action: string, max: number, windowMs: number): MiddlewareHandler<{ Variables: AppVariables }>`
  - **Parameters**:
    - `action`: String identifier for the rate limit bucket (e.g., `"mission_create"`, `"chat"`, `"lesson_gen"`)
    - `max`: Maximum number of requests allowed within the window
    - `windowMs`: Time window in milliseconds
  - **Returns**: A standard Hono middleware that:
    - Reads `rateLimiter` from `c.get("rateLimiter")`
    - If `rateLimiter` is null/undefined: calls `next()` (pass-through)
    - Calls `rateLimiter.check(user.id, action, max, windowMs)` — returns 429 fragment if check fails
    - On pass: calls `next()` to continue the middleware chain
  - **Module**: `src/security/rate-limit-middleware.ts`
  - **Re-exported from**: `src/security/index.ts`

- **Route application contract**: Apply middleware in the Hono route chain between `auth.requireAuth` and the handler function:
  ```
  router.post("/path", auth.requireAuth, rateLimit("action", N, windowMs), handler)
  ```

**Output**: `contracts/rate-limit-middleware.md` — documenting the middleware API.

### Quickstart validation

**Output**: `quickstart.md` — documenting runnable verification scenarios:
1. Run existing tests to confirm no regression
2. Manual verification that rate-limited routes return 429 when exceeded
3. Verification that null-rateLimiter mode (test mode) still passes all requests

## Agent context update

No agent context update needed for this feature.
