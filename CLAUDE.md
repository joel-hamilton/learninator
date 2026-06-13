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
PORT=3000
```

`ai.chat()` and `ai.chatWithTools()` accept `model: "high" | "low"` in options. Defaults to `"high"` if not specified. Use `"low"` for simple title generation or summary tasks. Use `"high"` for teaching, lesson generation, and chat.
