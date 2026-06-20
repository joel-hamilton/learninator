# Learninator

Multi-user AI tutoring webapp based on mattpocock/skills teach skill. Uses Claude API (or compatible) as the teacher.

## Stack
- **Runtime**: Node.js 22, TypeScript
- **Server**: Hono (lightweight web framework)
- **Frontend**: htmx (hypermedia-driven)
- **Database**: SQLite via Drizzle ORM (better-sqlite3)
- **AI**: Anthropic SDK (compatible with any OpenAI-compatible provider)
- **Auth**: Custom cookie-based session (email/password via bcrypt)
- **Test**: Vitest, in-memory SQLite, HTTP-level via `app.request()`
- **Deploy**: Docker Compose (dev and prod)

## Architecture decision records

Domain vocabulary is defined in `CONTEXT.md`. Architectural decisions are
recorded in `docs/adr/`. Before proposing an architectural change, check
whether an existing ADR already covers the territory:

- [ADR-0001](docs/adr/001-ai-client-seam.md) — AiClient interface with FakeAiClient for tests
- [ADR-0002](docs/adr/002-store-interfaces-with-typed-adapters.md) — Store interfaces with typed InMemory adapters
- [ADR-0003](docs/adr/003-polling-over-sse-for-workflow-progress.md) — Polling over SSE for workflow progress
- [ADR-0004](docs/adr/004-htmx-server-rendered-html.md) — htmx with server-rendered HTML fragments
- [ADR-0005](docs/adr/005-hono-factory-pattern-for-di.md) — Hono factory pattern for dependency injection
- [ADR-0006](docs/adr/006-mission-chat-service-orchestrator.md) — MissionChatService as single conversation orchestrator
- [ADR-0007](docs/adr/007-lesson-generator-fire-and-poll.md) — LessonGenerator as fire-and-poll background job manager

## Project structure

```
src/
  index.ts              # createApp() factory + production server startup
  types.ts              # AppVariables (user, db, ai, toolExecutor, logger, missionChatService)
  db/
    schema.ts           # Drizzle schema definitions (7 tables)
    index.ts            # DB connection singleton
    store.ts            # Store interfaces + InMemory stores
    adapters/           # Drizzle adapter classes (one per store interface)
    migrate.ts          # Migration runner
    migrations/         # SQL migrations + Drizzle snapshots
  auth/
    index.ts            # Session middleware + login/signup/logout routes
  ai/
    index.ts            # Claude SDK client wrapper (AnthropicAiClient)
    types.ts            # AiClient interface, ToolExecutor, content block types
    fake.ts             # FakeAiClient for tests (queue-based mock)
    teacher.ts          # TEACHER_SYSTEM_PROMPT + TEACHER_TOOLS definitions
    tools.ts            # Tool implementations (15 tools, DB read/write)
    conversation.ts     # conversationLoop() — multi-turn tool-use loop
    events.ts           # SSE event emitter for tool-call visibility
    errors.ts           # AIError class
    workflow-state.ts   # WorkflowStateManager — site-wide progress indicator
  services/
    mission-chat.service.ts  # createMissionChatService() — unified chat + onboarding + activation
  lessons/
    generator.ts        # LessonGenerator — background lesson/sub-lesson creation
  browse/
    explorer.ts         # TopicExplorer — AI-driven topic navigation
  routes/
    home.ts             # Dashboard (mission list, new mission form)
    missions.ts         # Mission CRUD, delegates to missionChatService
    onboarding.ts       # Guided Q&A endpoints, delegates to missionChatService
    mission-tabs.ts     # Sidebar tab routes (overview, notes, references, records)
    lessons.ts          # Lesson view, complete/incomplete/feedback, generation
    chat.ts             # AI chat for existing missions, delegates to missionChatService
    settings.ts         # Profile name + password change
    browse.ts           # Topic browse flow, delegates to TopicExplorer
  shared/
    messages.ts         # saveMessage() / loadMessages() — chat persistence
    markdown.ts         # Markdown formatting
    jobs.ts             # Generic async job tracker
  views/                # HTML rendering (template literals, no templating engine)
    base.css            # Shared CSS: design tokens, reset, buttons, forms, chat messages, modals, etc.
    home.ts, mission.ts, onboarding.ts, lesson.ts,
    auth.ts, settings.ts, browse.ts, fragments.ts, shared.ts
  test/
    helpers.ts          # createTestDb(), createTestApp(), seedUser(), login(), authedReq()
    auth.test.ts        # Signup, login, logout, session redirect
    missions.test.ts    # Mission creation, guided onboarding golden path, skip
    lessons.test.ts     # View, complete, incomplete, feedback
    chat.test.ts        # Simple reply, tool-using chat, activation
    onboarding.test.ts  # Guided onboarding HTTP-level tests
```

## Request flow

1. `src/index.ts` exports `createApp(opts?)` — the factory builds a Hono app with middleware that injects `db`, `ai`, `toolExecutor`, and `logger` into context via `c.set()`.
2. `sessionMiddleware` (in `auth/index.ts`) reads the session cookie, looks up the user from `c.get("db")`, and sets `c.set("user", user)`.
3. Route handlers read `c.get("db")` for all database access. No module-level `db` singleton is used directly by routes or auth.
4. `createApp(opts?)` accepts optional `db` and `ai` overrides for test injection. In production, `serve()` is called at module level inside a `if (!process.env.VITEST)` guard.

## Key patterns

- **DB access**: All routes and auth get `db` from `c.get("db")` — never from the module-level singleton. The `createApp()` factory sets this in middleware so tests can inject an in-memory SQLite.
- **Hono context**: Uses `{ Variables: AppVariables }` for typed injection. `AppVariables` includes `user`, `db`, `ai`, `toolExecutor`, and `logger`.
- **DB queries**: Drizzle `and()` for multiple where conditions, `eq()` takes typed column values.
- **AI interaction**: Function tools (`TEACHER_TOOLS`) let the AI read/write DB. Tool calls are executed server-side via `createToolExecutor(store)`. Multi-turn conversations use `conversationLoop()` from `ai/conversation.ts`.
- **Onboarding & mission chat**: `createMissionChatService()` in `services/mission-chat.service.ts` handles all AI conversation — guided Q&A mode (ask_guided_question tool with `pauseOnTools`), free-form chat mode, mission activation (triggers `generateMissionTitle()` via a low-model `ai.chat()` call), and active-mission chat with content/lesson context injection. Routes (missions, onboarding, chat, lessons) delegate to `missionChatService.run()`.
- **Browse exploration**: `TopicExplorer` in `browse/explorer.ts` drives topic navigation via `explore()`, `select()`, and `refresh()`. Browse routes delegate to it for AI calls; HTTP concerns (HX-Redirect, htmx fragments) stay in the route layer.
- **htmx**: All forms use htmx attributes (`hx-post`, `hx-target`, `hx-swap`). Server returns HTML fragments, not JSON.
- **Immediate feedback**: Any user interaction that triggers an AI call MUST show immediate visible feedback — the clicked element should dim/change instantly via CSS (`htmx-request` class), and a loading indicator should appear. Never leave the user staring at an unchanged screen while waiting for the AI.
- **Lessons**: AI-generated HTML rendered in sandboxed iframes. Lesson HTML should be self-contained with inline CSS/JS.

## Testing

Tests use `app.request()` (in-process HTTP, no port binding). The pattern:

1. `createTestDb()` creates an in-memory SQLite and runs migrations.
2. `createTestApp(fakeAi, db)` builds a Hono app with the test DB and a `FakeAiClient`.
3. `seedUser()` + `login()` set up an authenticated session.
4. `authedReq()` attaches the session cookie to requests.
5. `FakeAiClient` accepts a queue of responses consumed in order by `chat()`, `chatWithTools()`, and `continueWithToolResults()` — all three share the same `callIndex`.

**`FakeAiClient` response sequencing rules:**
- Every activation flow (mark_mission_active) consumes exactly 3 queue entries: `toolUseResponse("mark_mission_active")`, `textResponse(reply)`, `textResponse(title)` (title-gen via `ai.chat()`).
- Guided mode with `pauseOnTools: ask_guided_question` pauses immediately after tool execution — `continueWithToolResults` is NOT called. One queue entry per question.
- `FakeAiClient.toolUseResponse` uses `Date.now()` for tool IDs (fine in tests, not in workflow scripts).


## Database migrations

The Drizzle snapshot chain is repaired. `npm run db:generate` produces correct incremental SQL.

### When you need a schema change

1. Edit `src/db/schema.ts` with the TypeScript column/table definition
2. Run `npm run db:generate` — this produces a new migration SQL file and snapshot
3. Review the generated SQL to confirm it's correct (should be incremental, not destructive)
4. Run `npm run db:migrate` to apply
5. Run `npm test` to verify all tests pass with the new migration

### CI guard

A GitHub Actions workflow (`.github/workflows/schema-check.yml`) runs on PRs that touch `schema.ts` or migrations. It runs `drizzle-kit generate` and fails if the command produces output that isn't committed — preventing schema-migration drift.

### Before touching migrations

Always run these checks first:
```bash
cat src/db/migrations/meta/_journal.json   # journal entries must match actual .sql files
ls src/db/migrations/*.sql                 # no missing or extra files
```

## Running

```bash
# Dev
npm run dev

# Run tests
npm test
npm run test:watch

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

## Temporary files (screenshots, snapshots, logs)

**Never write temporary files into the repo root.** Screenshots, browser snapshots, console logs, and other verification artifacts must go to `/tmp/learninator/` (or `/tmp/` for one-offs). Create the directory first if needed. Never commit these — they're already gitignored via `*.png`, `*.jpg`, `*snapshot*`, and `*.yml` (except `compose.yml` and CI configs). The `.playwright-mcp/` directory is also gitignored — if Playwright MCP writes there, clean it up after.

<!-- SPECKIT START -->
Current plan: specs/028-extract-shared-css/plan.md
Feature: Extract Shared CSS from Views — Move the 490-line inlined HTMX_HEAD style block to a static base.css file, remove duplicated CSS from view files, and resolve conflicting loading bar height definitions.
<!-- SPECKIT END -->
