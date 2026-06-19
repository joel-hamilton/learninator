# Implementation Plan: Atomic Mission Content Upsert

**Branch**: `022-atomic-content-upsert` | **Date**: 2026-06-19 | **Spec**: `specs/022-atomic-content-upsert/spec.md`

**Input**: Feature specification from `specs/022-atomic-content-upsert/spec.md`

## Summary

Replace the select-then-insert race condition in `upsertMissionContent` with an atomic SQLite upsert (INSERT ... ON CONFLICT DO UPDATE) backed by a database-level unique constraint on `(missionId, contentType)`. The change is behavior-preserving for sequential access and fixes concurrent-duplicate rows without application-level locking.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)

**Primary Dependencies**: Hono (server framework), Drizzle ORM (type-safe queries), better-sqlite3 (SQLite driver)

**Storage**: SQLite via better-sqlite3. Drizzle ORM with `sqliteTable` schema definitions. Migrations are SQL files in `src/db/migrations/` using the `--> statement-breakpoint` separator convention.

**Testing**: Vitest, in-memory SQLite (`createTestDb()`), HTTP-level via `app.request()`. Use `FakeAiClient` for AI tool responses — but this change is below the tool layer, so tests can also directly call `store.upsertMissionContent()` or use raw Drizzle queries on the test DB.

**Target Platform**: Linux server via Docker Compose

**Project Type**: Web application (multi-user AI tutoring)

**Performance Goals**: Correctness-focused — eliminate data-integrity race condition. No measurable throughput regression from the atomic upsert vs. select-then-insert.

**Constraints**:
- `upsertMissionContent` method signature and return type MUST remain unchanged (FR-005)
- All existing tests MUST pass without modification (FR-006)
- The migration MUST handle pre-existing duplicate rows gracefully (FR-004)
- Must use Drizzle's `onConflictDoUpdate()` API on the INSERT builder

**Scale/Scope**: Single-user to small multi-user deployment. The `mission_content` table has at most 4 rows per mission (mission, notes, resources, glossary) — contention is low but correctness matters.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Rationale |
|---|-----------|--------|-----------|
| I | Factory-Based Testability | PASS | Change is in the store layer (injectable through `createApp()`). No new dependencies introduced. |
| II | HTTP-Level Integration Testing | PASS | Tests will use real in-memory SQLite. Concurrent-upsert test calls the store directly on the test DB instance. |
| III | Hypermedia-Driven Frontend | PASS | No frontend changes. All changes are in the DB store layer. |
| IV | Explicit Dependency Injection | PASS | Store interface (`ContentStore.upsertMissionContent`) signature unchanged. Routes continue to access DB via `c.get("db")`. |
| V | Migration Snapshot Integrity | **GATE** | Schema change requires a new Drizzle migration. Must run `db:generate`, review generated SQL, and commit the migration + snapshot with the schema change. A manual deduplication step must be added before the unique index creation to handle pre-existing duplicates. |
| Tech Standard: AI tools use MissionStore interface | PASS | `writeMissionContent` tool already calls `store.upsertMissionContent()`. No change needed in tool layer. |

## Project Structure

### Documentation (this feature)

```text
specs/022-atomic-content-upsert/
├── plan.md              # This file (speckit-plan output)
├── research.md          # Phase 0 research
├── data-model.md        # Phase 1 data model documentation
├── quickstart.md        # Phase 1 validation guide
├── contracts/           # Phase 1 interface contracts
└── tasks.md             # Phase 2 task breakdown (speckit-tasks output)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schema.ts        # Add unique() constraint on (missionId, contentType)
│   ├── store.ts         # Rewrite upsertMissionContent to use onConflictDoUpdate()
│   └── migrations/
│       ├── 0006_atomic_content_upsert.sql   # New migration: deduplicate + add unique index
│       └── meta/
│           ├── 0006_snapshot.json           # Drizzle snapshot
│           └── _journal.json                # Updated journal
```

**Structure Decision**: Single-project web application. All changes are confined to `src/db/`. No new files in routes, views, services, or test directories — though an existing test file (`src/test/chat.test.ts`) already covers the upsert path and must continue passing.

## Complexity Tracking

No constitution violations to justify. All changes are strictly additive (schema constraint + atomic upsert) and within established patterns.

## Phase 0: Research

### Research Items

1. **Drizzle ORM atomic upsert API for SQLite**
   - Drizzle provides `onConflictDoUpdate()` on the INSERT builder.
   - Requires a unique constraint/index on the target columns.
   - Syntax: `db.insert(table).values({...}).onConflictDoUpdate({ target: column | column[], set: {...} })`
   - For composite unique on (missionId, contentType), the `target` is `[table.missionId, table.contentType]`.
   - The `set` object must include all columns to update on conflict; Drizzle does not auto-exclude the target columns.
   - SQLite's `INSERT ... ON CONFLICT ... DO UPDATE SET ...` requires at most one conflict target per statement (SQLite limitation).
   - Decision: Use `onConflictDoUpdate()` with composite target.

2. **Migration strategy for pre-existing duplicate rows**
   - Before creating the unique index, a deduplication DELETE must run.
   - Strategy: `DELETE FROM mission_content WHERE id NOT IN (SELECT MIN(id) FROM mission_content GROUP BY mission_id, content_type)` — keeps the earliest row per group.
   - This must be added as a raw SQL statement in the migration file BEFORE the `CREATE UNIQUE INDEX` statement.
   - If no duplicates exist, the DELETE is a no-op.

3. **Unique constraint syntax in Drizzle schema.ts**
   - Drizzle SQLite supports `uniqueIndex()` or `unique()` on the table's third argument (table constraints).
   - Syntax: `export const missionContent = sqliteTable("mission_content", { ... }, (table) => ({ uniqueIdx: uniqueIndex("uq_mission_content").on(table.missionId, table.contentType) }))`
   - This generates `CREATE UNIQUE INDEX "uq_mission_content" ON "mission_content" ("mission_id", "content_type")`
   - Alternative: inline `.unique()` on a single column (not applicable for composite).
   - Decision: Use `uniqueIndex()` in the table's third argument for the composite constraint.

### Consolidation

- **Decision**: Use Drizzle `onConflictDoUpdate()` with a composite `uniqueIndex` on `(missionId, contentType)`, plus a manual deduplication step in the migration SQL.
- **Rationale**: Follows the project's established Drizzle patterns (see `sessions.token` unique index in migration 0005). The deduplication step is necessary because existing databases may have duplicate rows from the race condition.
- **Alternatives considered**: Application-level advisory lock (adds complexity, single-server only), raw SQL upsert (bypasses Drizzle type safety), `INSERT OR REPLACE` (deletes and re-inserts, losing `createdAt` and potentially causing FK cascade issues).

## Phase 1: Design

### Data Model

A single change to the `missionContent` table: adding a unique index on `(missionId, contentType)`. See `data-model.md` for full documentation.

### Interface Contracts

The `ContentStore` interface and `upsertMissionContent` method signature remain unchanged. See `contracts/content-store.md` for the contract documentation.

### Quickstart Validation

See `quickstart.md` for runnable validation scenarios.

### Agent Context Update

Update the SPECKIT markers in `CLAUDE.md` to reference the plan at `specs/022-atomic-content-upsert/plan.md`.
