# Quickstart: Atomic Mission Content Upsert

## Prerequisites

- Working development environment (`npm install` completed)
- SQLite database at `DATABASE_URL` (or default `data/learninator.db`)
- Migrations up to date (`npm run db:migrate`)

## Scenario 1: Concurrent Upsert Creates No Duplicates

This is the primary validation scenario. It proves the atomic upsert eliminates the race condition.

### Steps

1. Open `src/test/chat.test.ts` (or create a standalone test file).
2. Add a test that:
   - Creates a mission in the test database.
   - Fires N concurrent (Promise.all) calls to `store.upsertMissionContent()` with the same `(missionId, contentType)` pair.
   - Asserts that exactly one row exists in `mission_content` for that pair after all calls complete.

### Expected Outcome

```typescript
await Promise.all(
  Array.from({ length: 5 }, () =>
    store.upsertMissionContent({
      missionId,
      contentType: "mission",
      markdownContent: "some content",
    }),
  ),
);

const rows = await db.select()
  .from(schema.missionContent)
  .where(and(
    eq(schema.missionContent.missionId, missionId),
    eq(schema.missionContent.contentType, "mission"),
  ));
expect(rows).toHaveLength(1);
```

Without the fix, `rows.length` would be >= 2. With the fix, `rows.length === 1`.

## Scenario 2: Existing Tests Pass Unchanged

The fix must be behavior-preserving for sequential access patterns.

### Steps

```bash
npm test
```

### Expected Outcome

All tests pass with zero modifications. Key test cases that exercise the upsert path:
- `src/test/chat.test.ts` — "fresh mission content: upsert creates content on empty mission"
- `src/test/chat.test.ts` — any test exercising `write_mission_content` AI tool

## Scenario 3: Duplicate Insert Rejected at SQL Level

The unique constraint enforcement must work independently of application code.

### Steps

```sql
-- Insert first row
INSERT INTO mission_content (mission_id, content_type, markdown_content, created_at, updated_at)
VALUES (1, 'mission', 'first', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Attempt duplicate
INSERT INTO mission_content (mission_id, content_type, markdown_content, created_at, updated_at)
VALUES (1, 'mission', 'second', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
```

### Expected Outcome

The second INSERT fails with: `SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: mission_content.mission_id, mission_content.content_type`

## Scenario 4: Migration Handles Pre-Existing Duplicates

If the database has accumulated duplicate rows from the race condition, the migration must resolve them before applying the unique index.

### Steps

1. Manually introduce duplicates in the database:
   ```sql
   INSERT INTO mission_content (mission_id, content_type, markdown_content, created_at, updated_at)
   VALUES (1, 'mission', 'original', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
   INSERT INTO mission_content (mission_id, content_type, markdown_content, created_at, updated_at)
   VALUES (1, 'mission', 'duplicate', '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
   ```
2. Run the migration:
   ```bash
   npm run db:migrate
   ```

### Expected Outcome

Migration succeeds. The duplicate rows are removed (keeping the earliest `id`). The unique index is created. The row count for `(mission_id=1, content_type='mission')` is 1.

## Migration Commands

```bash
# Generate new migration after schema change
npm run db:generate

# Review the generated SQL
cat src/db/migrations/0006_atomic_content_upsert.sql

# Add deduplication step before CREATE UNIQUE INDEX (edit the SQL file)

# Apply the migration
npm run db:migrate

# Verify
npm test
```

## Contracts

See `contracts/content-store.md` for the full `ContentStore` interface contract, including pre/post conditions and atomicity guarantees.

## Data Model

See `data-model.md` for the `mission_content` table schema, the new unique constraint, and validation rules.
