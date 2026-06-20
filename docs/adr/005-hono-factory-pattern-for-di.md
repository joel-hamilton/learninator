# ADR-0005: Hono factory pattern for dependency injection

**Status:** Accepted
**Date:** pre-reviews (foundational)

## Context

The application needs different dependency configurations for production, tests,
and potential future environments. Singletons imported directly by consumers
prevent substitution and make tests heavyweight.

## Decision

`createApp(opts?)` is the single app factory. It accepts optional `db`, `ai`,
and `rateLimiter` overrides. When omitted, production defaults are used. The
factory:

1. Instantiates all adapters, services, and middleware
2. Injects them into Hono context via `c.set()` in two middleware layers
3. Mounts all route groups

`AppVariables` defines the typed context that routes and middleware access via
`c.get()`. The type is intentionally broad — every route receives the full
dependency graph even if it only uses a subset. This is a convenience trade-off
at the current scale.

Tests call `createTestApp(fakeAi, db)` with an in-memory SQLite and a
`FakeAiClient`. No port binding — tests use `app.request()` for in-process HTTP.

## Consequences

- Production and test share the same app construction path — no divergent
  startup code
- `AppVariables` is a megatype: 8 store interfaces, 2 event buses, AI client,
  tool executor, services, logger. Adding a dependency widens every route's
  effective interface
- Route-level interface segregation would require Hono route grouping with
  scoped middleware — not pursued at current scale
- The `if (!process.env.VITEST)` guard in the module body prevents production
  server startup during test imports
