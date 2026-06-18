# Implementation Plan: Security Hardening

**Branch**: `003-security-hardening` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-security-hardening/spec.md`

## Summary

Three security hardening measures: (1) remove an insecure SSE endpoint that leaks AI tool-call data across users, (2) add server-side input length validation on all user-input routes, and (3) add in-memory per-user sliding-window rate limiting on AI-backed endpoints. All features follow the `createApp()` factory pattern — the rate limiter is injected via `AppVariables` so tests can replace or disable it, and input validators are pure functions callable from route handlers.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), htmx (frontend), Vitest (testing). No new npm dependencies.

**Storage**: N/A for this feature. Rate limiter uses in-memory `Map<userId, number[]>` — no database changes.

**Testing**: Vitest with `app.request()` HTTP-level integration tests. New test file: `src/test/security.test.ts`.

**Target Platform**: Linux server (Node.js, single-process)

**Project Type**: web-service (htmx hypermedia-driven)

**Performance Goals**: <1ms overhead for validation and rate-limit checks when limits are not triggered

**Constraints**: In-memory only (data resets on restart — acceptable for a single-server dev tool). Error responses must be htmx-compatible HTML fragments. No new npm dependencies.

**Scale/Scope**: Single-server dev tool. Rate limits per user, not per IP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ PASS | RateLimiter injected via AppVariables; `createApp()` accepts optional override. Input validators are pure functions (no injection needed). |
| II. HTTP-Level Integration Testing | ✅ PASS | All tests use `app.request()` with real (in-memory) SQLite. `FakeAiClient` used for AI-dependent routes. |
| III. Hypermedia-Driven Frontend | ✅ PASS | Error responses are HTML fragments compatible with htmx swap targets. No JSON error responses. |
| IV. Explicit Dependency Injection | ✅ PASS | RateLimiter accessed via `c.get("rateLimiter")`. Input validators are explicitly called in route handlers. |
| V. Manual Migration Discipline | ✅ PASS | No database schema changes. No migration needed. |

## Project Structure

### Documentation (this feature)

```text
specs/003-security-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (error fragment contract)
```

### Source Code (repository root)

```text
src/
├── security/
│   ├── index.ts             # createSecurityMiddleware() + RateLimiter type export
│   ├── rate-limiter.ts      # SlidingWindowRateLimiter class
│   └── input-limits.ts      # Validation functions + limit constants
├── types.ts                 # Add rateLimiter to AppVariables
├── index.ts                 # Wire security middleware into createApp()
├── routes/
│   ├── missions.ts          # Remove tool-events route; add input validation + rate limiting
│   ├── lessons.ts           # Add input validation + rate limiting on generate/chat routes
│   └── chat.ts              # Add input validation + rate limiting
├── views/
│   └── fragments.ts         # Remove EventSource connection to old tool-events endpoint
└── test/
    └── security.test.ts     # Integration tests for all three features
```

**Structure Decision**: New `src/security/` module following the existing pattern from `src/observability/` — a focused module with its own `index.ts` wired through `createApp()`. No new top-level directories. Rate limiter is a class (not a middleware) so individual routes can opt into different limits.

## Complexity Tracking

No constitution violations. This section intentionally empty.

---

## Phase 0: Research

See [research.md](./research.md) — covers sliding window algorithm choice, Hono middleware vs. handler-level approach, and dead code audit results.

## Phase 1: Design

See:
- [data-model.md](./data-model.md) — RateLimiter entity and input limit constants
- [contracts/error-fragments.md](./contracts/error-fragments.md) — htmx error fragment contract
- [quickstart.md](./quickstart.md) — validation and test scenarios
