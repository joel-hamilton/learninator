# ADR-0002: Store interfaces with typed InMemory adapters for tests

**Status:** Accepted
**Date:** 2026-06-16 (interfaces), 2026-06-19 (InMemory types)

## Context

Database access was originally a Drizzle singleton imported directly by routes,
auth, and tool handlers. Testing anything that touched the database required a
real SQLite file. The tool handler switch statement received `db: any` — no
compile-time guarantees about which tables a handler could touch.

The initial extraction created 8 focused store interfaces (MissionStore,
LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore,
UserStore, SessionStore) with Drizzle adapters for production.

## Decision

1. **One interface per domain aggregate** — each store interface exposes only
   the query methods relevant to that aggregate. Tool handlers receive only the
   interfaces they need, not the entire database.

2. **InMemory adapters for tests** — each interface has a corresponding
   `InMemory*Store` class backed by typed arrays (`MissionRow[]`, not `any[]`).
   These were typed with Drizzle-inferred row types on 2026-06-19.

3. **DrizzleStore composite** — bundles all 8 adapters for injection into Hono
   context via `c.set("store", store)`. Convenience over purity; individual
   adapters are also available to services that want narrower types.

**Two adapters per interface justify each seam**: Drizzle (prod) and InMemory
(tests).

## Consequences

- Tool handlers no longer receive `db: any` — they get typed store interfaces
- Tests run without filesystem dependencies
- Adding a store method requires updating 3 locations: interface, Drizzle
  adapter, InMemory adapter — the InMemory variants are the maintenance cost
  for test isolation
- The DrizzleStore composite hides the dependency graph (a route that only uses
  MissionStore still receives all 8 interfaces). This is accepted as a
  convenience trade-off for the current scale
- InMemory stores use the Drizzle-inferred row types, so tests catch type
  coercion bugs (wrong enum strings, missing required fields) at compile time
