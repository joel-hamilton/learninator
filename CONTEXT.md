# Learninator — domain vocabulary

## Core concepts

**Mission** — a user's learning goal. Has a title, status (`onboarding` →
`active` → `archived`), and an onboarding mode (`guided` or `chat`). Contains
lessons, chat messages, reference docs, learning records, and mission content.

**Lesson** — AI-generated HTML content rendered in a sandboxed iframe.
Identified by `number` and optional `subNumber`. Has a status, slug, title, and
feedback (rating + text). Sub-lessons belong to a parent lesson via
`parentLessonId`.

**Onboarding** — the initial Q&A flow that activates a mission. Two modes:
guided (AI asks structured multiple-choice questions via `ask_guided_question`
tool, with `pauseOnTools`) and chat (free-form conversation). Ends when the AI
calls `mark_mission_active`.

**Activation** — the transition from `onboarding` to `active` status. Triggers
title generation via a low-model AI call. The post-activation bootstrap (check
`didActivate` → generate title → set HX-Redirect) was consolidated into
MissionChatService.

**Mission content** — structured markdown documents keyed by `contentType`
(`mission`, `notes`, `resources`). Written by the AI during onboarding,
displayed in sidebar tabs.

**Reference doc** — an AI-generated HTML document attached to a mission. Has a
`docType` and slug.

**Learning record** — a numbered markdown note created by the AI during
teaching. Can be superseded by a newer record.

**Guided question** — a multiple-choice question the AI asks during guided
onboarding. Has options (JSON array), answer, and status (`pending` →
`answered`).

## Interaction patterns

**Conversation loop** — the while-true tool-use loop: call AI with tools →
collect `tool_use` blocks → execute tools server-side → feed results back →
repeat until the AI returns text-only. Implemented in `conversationLoop()`.

**Tool** — a function the AI can call during conversation (17 tools). Each has a
JSON schema definition (in `teacher.ts`) and a handler implementation (in
`tools.ts`, dispatched by a `Map<string, ToolHandler>`). Tools read/write the
database.

**Fire-and-poll** — the pattern for long-running AI operations (lesson
generation, QA review). A POST starts the job, returns a job key. The client
polls a status endpoint every 5 seconds. Job state is in-memory.

**Immediate feedback** — any user interaction that triggers an AI call must show
instant visible feedback. The `htmx-request` CSS class on the clicked element
provides this automatically.

## Key modules

**MissionChatService** — the single entry point for all AI chat in missions.
Routes delegate to `run()`. Owns system prompt construction, message
persistence, conversation loop execution, workflow state, and activation
bootstrap. [ADR-0006]

**LessonGenerator** — fire-and-poll background job manager for AI lesson
creation. Four generation kinds (next, sub, regenerate, bridging) delegate to a
single template method. Includes QA review pass. [ADR-0007]

**TopicExplorer** — AI-driven topic navigation for the browse flow. Progressive
narrowing with iteration tracking. Three methods: `explore()`, `select()`,
`refresh()`.

**WorkflowStateManager** — in-memory state tracker for site-wide progress
indicators. Creates/updates/completes workflow runs with steps. Client polls
`/workflows/state` for current state. [ADR-0003]

**AiClient** — the seam between application code and the AI provider. Two
adapters: `AnthropicAiClient` (prod) and `FakeAiClient` (tests). [ADR-0001]

**Store interfaces** — 8 focused interfaces for database access, one per
aggregate. Two adapters per interface: Drizzle (prod) and InMemory (tests).
[ADR-0002]

## Architecture principles

- **The interface is the test surface** — tests hit the same seam as production
  callers. `createApp()` accepts optional overrides for `db`, `ai`, and
  `rateLimiter`.
- **Two adapters justify the seam** — every store interface has a Drizzle
  adapter and an InMemory adapter. The AiClient has Anthropic and Fake variants.
- **Server-rendered HTML** — no client-side framework. htmx attributes on forms;
  server returns HTML fragments. View functions in `src/views/` are pure: data
  in, HTML string out. [ADR-0004]
- **Hono factory pattern** — `createApp(opts?)` builds the full app with
  dependency injection. Tests use `app.request()` for in-process HTTP. [ADR-0005]

## Rejected patterns

- **SSE for progress** — built but not the active path. Polling is simpler and
  avoids persistent connection accumulation. [ADR-0003]
- **SPA client** — would duplicate routing, validation, and auth logic. htmx
  keeps these server-side.
- **JSON API** — the app returns HTML fragments, not JSON. View functions render
  on the server.
- **ORM models as domain objects** — Drizzle row types are used directly. No
  separate domain model layer.
