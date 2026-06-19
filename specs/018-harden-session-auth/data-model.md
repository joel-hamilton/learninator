# Data Model: Harden Session Auth

## New Entity: Sessions

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `integer` | PRIMARY KEY AUTOINCREMENT | Internal row ID |
| `token` | `text` | NOT NULL, UNIQUE, INDEXED | UUID v4 session identifier (stored in `learninator_sid` cookie) |
| `csrftoken` | `text` | NOT NULL | CSRF token (stored in `learninator_csrf` cookie, non-HTTP-only) |
| `userId` | `integer` | NOT NULL, FK → users.id | Owning user |
| `expiresAt` | `text` | NOT NULL (ISO 8601) | Expiration timestamp (createdAt + 30 days) |
| `createdAt` | `text` | NOT NULL (ISO 8601) | Creation timestamp |

**Indexes**:
- `token` — UNIQUE index for fast lookup by session cookie value
- `userId` + `expiresAt` — composite index for opportunistic cleanup queries

**Relationships**:
- `userId` → `users.id` (CASCADE on delete — removing a user removes their sessions)

**State transitions**: None. Sessions have only two effective states: valid (`expiresAt > now`) or expired (`expiresAt <= now`). Expired sessions are treated as nonexistent by the middleware. There is no `status` column — expiration is determined from the timestamp.

**Validation rules**:
- `token` must be a valid UUID v4 (format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- `csrftoken` must be a cryptographically random string (at least 32 bytes, base64url-encoded)
- `expiresAt` must be after `createdAt`

## Schema Change (Drizzle)

```typescript
// Added to src/db/schema.ts
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  csrfToken: text("csrf_token").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
```

## Migration

Run `npm run db:generate` after adding the table to schema.ts. Expected migration filename: `0004_sessions.sql`. The migration is additive only (CREATE TABLE + CREATE INDEX). No data migration of existing rows — the legacy cookie detection handles existing sessions at the application layer (see research.md §4).

## Impact on Existing Entities

- **Users**: No schema changes. `deleteMission()` in `DrizzleMissionStore` does not currently cascade to users — session cleanup on user delete is handled via the FK `ON DELETE CASCADE` on `sessions.user_id`.
- **Missions, Lessons, etc.**: No impact.
