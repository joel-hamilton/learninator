<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0
  Bump rationale: MINOR — amended Principle V (Manual Migration Discipline → Migration Snapshot Integrity)
    after repairing the Drizzle snapshot chain (feature 004-fix-migration-snapshots).
  Modified principles:
    - V. Manual Migration Discipline → V. Migration Snapshot Integrity
  Added sections: None
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no changes needed
    - .specify/templates/spec-template.md ✅ no changes needed
    - .specify/templates/tasks-template.md ✅ no changes needed
  Follow-up TODOs: None
-->

# Learninator Constitution

## Core Principles

### I. Factory-Based Testability

The `createApp()` factory pattern MUST be used to assemble the application. All
external dependencies — database, AI client, logger — MUST be injectable
through the factory's options parameter. Production code MUST NOT hardcode
singletons that tests cannot replace; use the module-level instance only inside
a `if (!process.env.VITEST)` guard in the entry point.

**Rationale**: Enables in-process HTTP testing with in-memory SQLite and fake AI
clients. Every route and middleware is testable without network calls or port
binding.

### II. HTTP-Level Integration Testing

Tests MUST exercise the full request/response cycle via `app.request()`.
Database calls MUST use a real (in-memory) SQLite instance — never mock Drizzle
or the store layer. AI calls MUST use `FakeAiClient` (a queue-based fake, not a
mock library). Test files live in `src/test/` and follow the naming convention
`<domain>.test.ts`.

**Rationale**: Mocking the database or ORM produces tests that pass against
stale method signatures but fail in production. Real SQLite catches schema
mismatches, constraint violations, and migration gaps immediately.

### III. Hypermedia-Driven Frontend

The frontend MUST use htmx for interactivity. Server endpoints MUST return HTML
fragments, not JSON. View rendering MUST use template literals in `src/views/`
— no templating engine (no JSX, no Handlebars, no EJS). Lesson content is
AI-generated HTML rendered in sandboxed iframes with self-contained inline
CSS/JS.

**Rationale**: Keeps the entire application in one language and one runtime.
htmx attributes (`hx-post`, `hx-target`, `hx-swap`) make server-rendered pages
interactive without a frontend build step or SPA framework.

### IV. Explicit Dependency Injection

Route handlers and middleware MUST access the database, AI client, and logger
through Hono context (`c.get("db")`, `c.get("ai")`, `c.get("user")`). Module-level
imports of the database singleton are forbidden in routes and auth code. The
`AppVariables` type in `src/types.ts` defines the injectable context shape.

**Rationale**: Prevents accidental production-only code paths and makes
dependency wiring visible at every call site. A handler that reads `db` from
context is testable; one that imports a singleton is not.

### V. Migration Snapshot Integrity

Schema changes MUST follow the standard Drizzle workflow: edit `schema.ts`, run
`npm run db:generate`, review the generated SQL for correctness, and run
`npm run db:migrate` to apply. The generated migration SQL and snapshot files
MUST be committed together with the schema change. A CI check
(`.github/workflows/schema-check.yml`) enforces that `db:generate` output is
always committed — PRs that change `schema.ts` without matching migration
output will fail CI.

**Rationale**: The snapshot chain has been repaired (see
specs/004-fix-migration-snapshots). `drizzle-kit generate` now produces correct
incremental SQL. The CI guard prevents regression back to snapshot drift.

## Technical Standards

- **Language**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)
- **Server framework**: Hono — lightweight, typed context, no decorators
- **Database**: SQLite via better-sqlite3, Drizzle ORM for type-safe queries. Use `and()` for multiple WHERE conditions; use `eq()` with typed column references.
- **AI**: Anthropic SDK, model selection via `"high"` / `"low"` option (Sonnet for teaching/chat, Haiku for title generation and summarization)
- **Auth**: Custom cookie-based sessions with bcrypt password hashing. `SESSION_SECRET` MUST be set in environment; never hardcode secrets.
- **AI tools**: Server-side tool execution only. Tool schemas defined in `src/ai/teacher.ts`. Tool implementations in `src/ai/tools.ts` use the `MissionStore` interface for DB access — never raw SQL or direct table access.
- **Security**: No secrets in the repository. Environment variables for all credentials. Sandboxed iframes for AI-generated content.

## Development Workflow

- **Tests MUST pass** before committing. Run `npm test` (Vitest).
- **Immediate UI feedback**: Any user interaction that triggers an AI call MUST show visible feedback — the clicked element dims/changes via the `htmx-request` CSS class, and a loading indicator appears. Users MUST never stare at an unchanged screen waiting for the AI.
- **No emoji** in code, comments, or committed files unless the user explicitly requests them.
- **Temporary files** (screenshots, snapshots, logs) go to `/tmp/learninator/`, never the repo root.
- **No speculative features**: Do not add abstractions, error handling, or configuration for scenarios that do not yet exist. YAGNI.
- **Comments only when the WHY is non-obvious**: Do not document what well-named identifiers already say. Do not reference PR numbers or task trackers.

## Governance

This constitution supersedes all other development practices for this project.
All code reviews and implementation plans MUST verify compliance with the Core
Principles. Any deviation MUST be documented with a rationale in the plan's
Complexity Tracking table.

Amendments to this constitution require:
1. A documented proposal describing the change and its motivation.
2. Review against all dependent templates (plan, spec, tasks) for consistency.
3. A version bump following semantic versioning (MAJOR for principle
   removal/redefinition, MINOR for new principles or sections, PATCH for
   clarifications and wording).
4. Updated Sync Impact Report at the top of this file.

Use `CLAUDE.md` for runtime development guidance (stack details, patterns,
commands). The constitution defines non-negotiable rules; CLAUDE.md describes
how work gets done day-to-day.

**Version**: 1.1.0 | **Ratified**: 2026-06-18 | **Last Amended**: 2026-06-18
