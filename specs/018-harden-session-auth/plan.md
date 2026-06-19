# Implementation Plan: Harden Session Auth

**Branch**: `ai/018-harden-session-auth` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-harden-session-auth/spec.md`

## Summary

Replace the current raw-user-ID cookie with server-side session tokens (UUID v4), add CSRF protection for all state-changing requests, apply rate limiting to auth endpoints, set the `Secure` cookie flag conditionally on `NODE_ENV`, and add opportunistic expired-session cleanup. The auth module gains a new `sessions` database table, CSRF middleware, and IP-aware rate limiter calls, all behind the existing factory/test injection patterns.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (web framework), Drizzle ORM, better-sqlite3, bcryptjs, hono/cookie utilities

**Storage**: SQLite via Drizzle (existing composite store — `DrizzleMissionStore` implements `UserStore` and will gain `SessionStore`)

**Testing**: Vitest with in-memory SQLite, FakeAiClient (queue-based), HTTP-level via `app.request()`

**Target Platform**: Node.js server (single-process, Docker Compose)

**Project Type**: Web application (htmx-driven frontend)

**Performance Goals**: No regression — auth middleware runs on every request; session lookup must be a single indexed SQLite query

**Constraints**: All existing tests must pass. No view changes. Session token must not appear in URLs, response bodies, logs, or error messages.

**Scale/Scope**: ~5 files modified, 1 new migration, ~3 new test files, ~200 LOC net new (session store, CSRF middleware, rate limit wiring)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Factory-Based Testability | PASS | Session store injected via existing `store` pattern. Rate limiter already accepts `null` for tests. CSRF middleware reads from context. |
| II. HTTP-Level Integration Testing | PASS | All new tests use `app.request()` with in-memory SQLite. `login()` helper in test harness already extracts cookie from `Set-Cookie` header — works with new UUID token format. |
| III. Hypermedia-Driven Frontend | PASS | CSRF token stored in non-HTTP-only cookie read by htmx via `hx-headers`. No view template changes. |
| IV. Explicit Dependency Injection | PASS | Session middleware reads `store` from Hono context. CSRF middleware reads `store` from context. No module-level singletons. |
| V. Migration Snapshot Integrity | PASS | New `sessions` table added via `npm run db:generate` — migration SQL committed with schema change. CI guard catches mismatches. |

## Project Structure

### Documentation (this feature)

```text
specs/018-harden-session-auth/
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
  db/
    schema.ts            # + sessions table definition
    store.ts             # + SessionStore interface + Drizzle implementation
  auth/
    index.ts             # Rewritten: session tokens, CSRF cookie, Secure flag,
                         #   legacy migration, expired cleanup
    csrf.ts              # NEW: CSRF token generation + validation middleware
  security/
    rate-limiter.ts      # Extended: checkByKey() for IP-based limiting
  test/
    helpers.ts           # login() may need minor update for new cookie format
    auth.test.ts         # Existing tests updated for session-based auth
    security/
      csrf.test.ts       # NEW: CSRF middleware tests
      rate-limiter.test.ts  # NEW: Auth rate limiting tests
```

**Structure Decision**: Session store methods are added to the existing composite `DrizzleMissionStore` (which already implements `UserStore`) rather than creating a separate `SessionStore` class. This avoids introducing another context-injected dependency. CSRF logic gets its own file (`auth/csrf.ts`) to keep `auth/index.ts` focused on session management and route handlers. Session cleanup triggers opportunistically on login (not as a separate cron/interval) per the spec.

## Complexity Tracking

> No violations — all changes are within existing patterns.
