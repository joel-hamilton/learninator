# Research: Atomic Mission Content Upsert

## 1. Drizzle ORM Atomic Upsert API for SQLite

### Decision
Use Drizzle's `onConflictDoUpdate()` on the INSERT builder with a composite unique index target.

### Rationale
- Drizzle provides first-class support for `INSERT ... ON CONFLICT DO UPDATE SET ...` (the SQLite UPSERT syntax) via the `onConflictDoUpdate()` method.
- The method signature: `db.insert(table).values({...}).onConflictDoUpdate({ target: column | column[], set: {...} })`
- For a composite unique index on `(mission_id, content_type)`, the target is `[schema.missionContent.missionId, schema.missionContent.contentType]`.
- The `set` object must enumerate all columns to update. Drizzle does not auto-exclude the conflict target columns — they must be included in `set` if they should update.
- SQLite enforces at most one conflict target per UPSERT statement. A composite unique index as a single target satisfies this requirement.

### Implementation pattern
```typescript
await this.db.insert(schema.missionContent).values({
  missionId: values.missionId,
  contentType: values.contentType as any,
  markdownContent: values.markdownContent,
}).onConflictDoUpdate({
  target: [
    schema.missionContent.missionId,
    schema.missionContent.contentType,
  ],
  set: {
    markdownContent: values.markdownContent,
    updatedAt: new Date().toISOString(),
  },
});
```

### Alternatives considered
- **`INSERT OR REPLACE`** (raw SQL): Deletes the existing row and inserts a new one, which would reset `createdAt` and potentially cause issues if the row has FK references. Rejected.
- **Application-level advisory lock**: Adds complexity, limited to single-process deployments, and violates the principle of defense-in-depth (FR-001 requires a database-level constraint). Rejected.
- **Existing select-then-insert pattern**: Has the race condition that is the subject of this fix. Rejected.

---

## 2. Migration Strategy for Pre-Existing Duplicate Rows

### Decision
Add a DELETE statement to the migration SQL that deduplicates rows before creating the unique index.

### Rationale
- The `CREATE UNIQUE INDEX` statement will fail at migration time if the `mission_content` table already contains duplicate `(mission_id, content_type)` pairs.
- Some databases (dev, staging) may have accumulated duplicates from the race condition. Production databases are less likely to have duplicates due to lower concurrency, but the migration must handle all cases.
- The deduplication strategy is: **keep the row with the lowest `id`** (i.e., the first-inserted row) for each `(mission_id, content_type)` group, and delete the rest.
- This is safe because `mission_content` rows have no child-table FK references, so deleting the duplicate is a clean operation.

### Migration SQL pattern
```sql
-- Step 1: Deduplicate — keep the earliest row per (mission_id, content_type)
DELETE FROM mission_content WHERE id NOT IN (
  SELECT MIN(id) FROM mission_content GROUP BY mission_id, content_type
);
--> statement-breakpoint
-- Step 2: Create the unique index
CREATE UNIQUE INDEX `uq_mission_content` ON `mission_content` (`mission_id`, `content_type`);
```

### Alternatives considered
- **Keep the row with the highest `id`** (most recent): Less conservative — the earliest row better represents the original intent. Rejected.
- **Fail the migration explicitly and require operator intervention**: More disruptive than necessary for a safe deduplication. Rejected.
- **Skip deduplication entirely**: The migration would fail on databases with duplicates. Rejected.

---

## 3. Unique Constraint Syntax in Drizzle Schema

### Decision
Use `uniqueIndex()` in the table's third argument (table constraints) to create a composite unique index.

### Rationale
- Drizzle SQLite supports two syntaxes for uniqueness constraints:
  1. **Inline column modifier** `.unique()` — only for single-column constraints
  2. **Table-level** `uniqueIndex()` / `unique()` — supports composite constraints
- Since the constraint spans two columns (`missionId`, `contentType`), the table-level `uniqueIndex()` is required.
- The naming convention `uq_mission_content` follows the project's pattern (see `sessions_token_unique` in migration 0005).
- Drizzle will generate `CREATE UNIQUE INDEX "uq_mission_content" ON "mission_content" ("mission_id", "content_type")`.

### Implementation pattern
```typescript
export const missionContent = sqliteTable(
  "mission_content",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    missionId: integer("mission_id").notNull().references(() => missions.id),
    contentType: text("content_type", {
      enum: ["mission", "notes", "resources", "glossary"],
    }).notNull(),
    markdownContent: text("markdown_content").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    uniqueContentTypePerMission: uniqueIndex("uq_mission_content").on(table.missionId, table.contentType),
  }),
);
```

Note: The `onConflictDoUpdate()` target will reference these columns, not the index name.

### Alternatives considered
- **`unique()` constraint**: Same behavior as `uniqueIndex()` in Drizzle for SQLite; both generate a unique index. The `uniqueIndex()` form is more explicit about the underlying implementation. Both work with `onConflictDoUpdate()`.
