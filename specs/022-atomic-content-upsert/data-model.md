# Data Model: Atomic Mission Content Upsert

## Entity: mission_content

### Table

`mission_content` — stores singular documents per mission (overview, notes, resources, glossary).

### Columns

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, AUTOINCREMENT | Unchanged |
| `mission_id` | INTEGER | NOT NULL, FK -> missions.id | Unchanged |
| `content_type` | TEXT | NOT NULL, ENUM('mission', 'notes', 'resources', 'glossary') | Unchanged |
| `markdown_content` | TEXT | NOT NULL, DEFAULT '' | Unchanged |
| `created_at` | TEXT | NOT NULL | Unchanged |
| `updated_at` | TEXT | NOT NULL | Unchanged |

### New Constraint

| Constraint Name | Type | Columns | Migration |
|-----------------|------|---------|-----------|
| `uq_mission_content` | UNIQUE INDEX | `(mission_id, content_type)` | 0006 |

### Rationale

The unique index on `(mission_id, content_type)` guarantees at the database level that no two rows share the same mission and content type. This is the physical enforcement mechanism for the business invariant: "each mission has exactly one row per content type." Previously this invariant was enforced only by application-level convention (the select-then-insert pattern in `upsertMissionContent`), which was vulnerable to race conditions under concurrent access.

### Impact on Existing Queries

- **SELECT** queries that filter by `(mission_id, content_type)` may benefit from the new index, but no query changes are needed.
- **INSERT** of a duplicate `(mission_id, content_type)` pair will now fail with a constraint violation (SQLITE_CONSTRAINT_UNIQUE). This is the desired behavior.
- **UPDATE** via `onConflictDoUpdate()` handles the conflict transparently — no application code sees the constraint error.

### State Transitions

None. The mission_content table has no status field and no lifecycle transitions. The change is structural (adding a constraint) rather than behavioral.

### Validation Rules

| Rule | Enforcement |
|------|-------------|
| Each (mission_id, content_type) pair must be unique | Database unique index `uq_mission_content` |
| mission_id must reference an existing mission | FK constraint (unchanged) |
| content_type must be one of the four enum values | Drizzle `text({ enum: [...] })` + column constraint (unchanged) |
