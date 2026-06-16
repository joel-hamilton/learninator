# Learninator

Multi-user AI tutoring webapp based on mattpocock/skills teach skill. Uses Claude API (or compatible) as the teacher.

## Stack
- **Runtime**: Node.js 22, TypeScript
- **Server**: Hono (lightweight web framework)
- **Frontend**: htmx (hypermedia-driven)
- **Database**: SQLite via Drizzle ORM
- **AI**: Anthropic SDK (compatible with any OpenAI-compatible provider)
- **Auth**: Custom cookie-based session (email/password via bcrypt)
- **Deploy**: Docker Compose (dev and prod)

## Project structure

```
src/
  index.ts          # Hono app entry point
  types.ts          # Shared types (User, AppVariables)
  db/
    schema.ts       # Drizzle schema definitions
    index.ts        # DB connection
    migrate.ts      # Migration runner
    migrations/     # Auto-generated SQL migrations
  auth/
    index.ts        # Session middleware + login/signup routes
  ai/
    index.ts        # Claude SDK client wrapper
    teacher.ts      # System prompt + tool definitions
    tools.ts        # Tool implementations (DB read/write)
  routes/
    home.ts         # Dashboard
    missions.ts     # Mission CRUD, workspace tabs, onboarding chat
    lessons.ts      # Lesson view, feedback, complete
    chat.ts         # AI chat for existing missions
```

## Key patterns

- **Hono context**: Uses `{ Variables: AppVariables }` for typed user injection via middleware
- **DB queries**: Drizzle `and()` for multiple where conditions, `eq()` takes typed column values
- **AI interaction**: Function tools (`TEACHER_TOOLS`) let the AI read/write DB. Tool calls are executed server-side via `executeTool`. Multi-turn conversations use `continueWithToolResults`.
- **htmx**: All forms use htmx attributes (`hx-post`, `hx-target`, `hx-swap`). Server returns HTML fragments, not JSON.
- **Lessons**: AI-generated HTML rendered in sandboxed iframes. Lesson HTML should be self-contained with inline CSS/JS.

## Database migrations

**CRITICAL: Never use `npm run db:generate` (drizzle-kit generate).** The drizzle snapshot chain is broken — the 0001 migration has no corresponding snapshot, so `db:generate` compares against a stale 0000 snapshot and produces wrong SQL (re-creating existing tables).

### When you need a schema change

1. Edit `src/db/schema.ts` with the TypeScript column/table definition
2. Write a manual SQL migration file in `src/db/migrations/`:
   ```sql
   -- For a new column:
   ALTER TABLE `table_name` ADD `column_name` text DEFAULT 'default_value' NOT NULL;

   -- For a new table:
   CREATE TABLE `table_name` (
     `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
     `mission_id` integer NOT NULL,
     -- ... more columns ...
     FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE no action
   );
   ```
3. Name it with the next sequence number: `0002_<descriptive_tag>.sql`
4. Add the entry to `src/db/migrations/meta/_journal.json`:
   ```json
   {
     "idx": <next_number>,
     "version": "6",
     "when": <current_unix_ms>,
     "tag": "0002_<descriptive_tag>",
     "breakpoints": true
   }
   ```
5. Run `npm run db:migrate` to apply

### Before touching migrations

Always run these checks first:
```bash
cat src/db/migrations/meta/_journal.json   # journal entries must match actual .sql files
ls src/db/migrations/*.sql                 # no missing or extra files
```

The snapshot situation should be fixed properly (run `drizzle-kit generate` on a clean DB after merging) so `db:generate` can be trusted again. Until then, manual SQL.

## Running

```bash
# Dev
npm run dev

# Generate migration after schema changes
npm run db:generate
npm run db:migrate

# Prod
docker compose up
```

## Environment

```
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL_HIGH=claude-sonnet-4-20250514
AI_MODEL_LOW=claude-haiku-4-5-20251001
DATABASE_URL=data/learninator.db
SESSION_SECRET=change-me
```

`ai.chat()` and `ai.chatWithTools()` accept `model: "high" | "low"` in options. Defaults to `"high"` if not specified. Use `"low"` for simple title generation or summary tasks. Use `"high"` for teaching, lesson generation, and chat.
