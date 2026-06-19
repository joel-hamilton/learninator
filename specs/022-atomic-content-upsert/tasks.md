# Tasks: Atomic Mission Content Upsert

**Input**: Design documents from `specs/022-atomic-content-upsert/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included because the spec.md defines independent test criteria for each user story and quickstart.md provides runnable validation scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- All source changes are confined to `src/db/` — no changes to routes, views, services, or AI tool layer.
- Tests go in `src/test/` following the project convention.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch creation, context updates, and workspace preparation

- [X] T001 (skipped — working on main per user instruction)
- [X] T002 (skipped — working on main per user instruction)

**Checkpoint**: Feature branch ready and context references are up to date.

---

## Phase 2: Foundational — Schema Constraint (User Story 2) [US2]

**Goal**: Add a database-level unique index on `(missionId, contentType)` so the schema enforces data integrity independently of application code.

**Independent Test**: Attempt a raw SQL INSERT of a duplicate `(missionId, contentType)` pair and verify the database rejects it with `SQLITE_CONSTRAINT_UNIQUE`.

### Implementation for User Story 2

- [X] T003 [US2] Add `uniqueIndex("uq_mission_content")` on `(missionId, contentType)` to the `missionContent` table definition in `src/db/schema.ts`
- [X] T004 [US2] Run `npm run db:generate` to produce migration `0006_atomic_content_upsert.sql` and update the Drizzle snapshot chain in `src/db/migrations/`
- [X] T005 [US2] Add deduplication DELETE step before `CREATE UNIQUE INDEX` in the generated migration SQL at `src/db/migrations/0006_atomic_content_upsert.sql` to handle pre-existing duplicate rows gracefully (keep earliest row per group)
- [X] T006 [US2] Run `npm run db:migrate` to apply the new migration to the local database

**Checkpoint**: Database-level unique constraint is in place. A direct SQL INSERT of a duplicate pair is rejected.

---

## Phase 3: User Story 1 — Atomic Upsert (Priority: P1)

**Goal**: Replace the race-condition-prone select-then-insert in `upsertMissionContent` with an atomic Drizzle `onConflictDoUpdate()` that guarantees exactly one row exists after concurrent calls for the same `(missionId, contentType)` pair.

**Independent Test**: Fire N concurrent `store.upsertMissionContent()` calls with the same `(missionId, contentType)` pair and assert exactly one row exists after all complete.

### Tests for User Story 1

- [X] T007 [P] [US1] Create concurrent-upsert test in `src/test/content-upsert.test.ts` that fires 5 concurrent `upsertMissionContent` calls for the same `(missionId, contentType)` pair and asserts exactly one row exists
- [X] T008 [P] [US1] Create constraint-violation test in `src/test/content-upsert.test.ts` that directly inserts a duplicate `(missionId, contentType)` pair via raw SQL and asserts `SQLITE_CONSTRAINT_UNIQUE`

### Implementation for User Story 1

- [X] T009 [US1] Rewrite `DrizzleMissionStore.upsertMissionContent()` in `src/db/store.ts` to use `onConflictDoUpdate()` with composite target `[missionId, contentType]` and `set` including `markdownContent` and `updatedAt`

**Checkpoint**: Atomic upsert implemented. Concurrent calls produce exactly one row.

---

## Phase 4: Validation

**Purpose**: Verify the full change set is correct and regression-free.

- [X] T010 Run the full test suite (`npm test`) to confirm all existing tests pass without modification (FR-006)
- [X] T011 [P] Run `quickstart.md` validation scenarios (concurrent upsert, duplicate SQL insert rejection, migration handling of pre-existing duplicates)
- [X] T012 Commit all changes with a descriptive message referencing the feature spec

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational / US2 (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (US2) — the unique index must exist before `onConflictDoUpdate()` can target it
- **Validation (Phase 4)**: Depends on all prior phases

### User Story Dependencies

- **User Story 2 (P1)**: Schema constraint — can start after Setup. No dependency on other stories.
- **User Story 1 (P1)**: Atomic upsert — BLOCKED by User Story 2. The `onConflictDoUpdate()` target references the unique index created in US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation for US1
- US2: schema.ts change first, then migration generation, then migration SQL edit
- US1: implementation first, then test verification (or tests-first if following TDD)

### Parallel Opportunities

- T001 and T002 can run in parallel
- T007 and T008 (US1 tests) can run in parallel
- T010, T011 (validation) can run in parallel
- US2 tasks are sequential (each depends on the previous)
- US1 test tasks (T007, T008) can run in parallel with US1 implementation (T009), but verification requires both

---

## Parallel Example: User Story 1

```bash
# Launch both US1 test files together (they test different aspects):
Task: "Create concurrent-upsert test in src/test/content-upsert.test.ts"
Task: "Create constraint-violation test in src/test/content-upsert.test.ts"

# Implementation depends on unique constraint being in place (Phase 2 complete):
Task: "Rewrite upsertMissionContent in src/db/store.ts to use onConflictDoUpdate()"
```

---

## Implementation Strategy

### MVP (Phase 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Schema constraint (US2)
3. **STOP and VALIDATE**: The unique constraint alone prevents duplicates at the SQL level
4. Deploy/demo: The schema constraint provides defense-in-depth even without the atomic upsert

### Full Delivery

1. Complete Setup + Schema constraint (Phase 1 + 2) → Foundation ready
2. Add Atomic upsert (Phase 3, US1) → Race condition eliminated
3. Run full test suite + quickstart scenarios → Validated
4. Commit and merge

### Incremental Delivery

1. Phase 2 (schema constraint) can be deployed independently — it's a safe additive change that doesn't affect existing code paths
2. Phase 3 (atomic upsert) is the behavioral fix — it changes the store method to use the new constraint's conflict target
3. Phase 3's test tasks (T007, T008) validate both the behavior and the schema enforcement

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story can be independently tested
- Existing tests MUST pass without modification (FR-006)
- The in-memory `InMemoryContentStore` does NOT need changes — it is single-threaded and has no race condition
- No changes needed in routes, views, services, AI tools, or the `InMemoryContentStore`
- Migration naming convention: `0006_atomic_content_upsert.sql` with `--> statement-breakpoint` separator
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
