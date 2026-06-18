# Implementation Plan: Agentic Workflow Visibility

**Branch**: `001-agentic-workflow-visibility` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-agentic-workflow-visibility/spec.md`

## Summary

Give students real-time visibility into AI workflows via a two-level display: a
site-wide status indicator (persistent across all pages) showing summaries of
all active workflows, and page-local detail panels showing step-by-step
progress for the workflow relevant to the current page. Both levels survive
page navigation and reloads within a login session. Replace the existing buggy
SSE banner with a reliable implementation.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (server), htmx (frontend), Drizzle ORM + better-sqlite3 (storage), Anthropic SDK (AI), Vitest (testing)

**Storage**: SQLite via Drizzle ORM. Workflow progress state is session-scoped (in-memory) — no new tables needed unless future cross-session persistence is required.

**Testing**: Vitest with in-memory SQLite, `app.request()` HTTP-level tests, `FakeAiClient` for AI.

**Target Platform**: Node.js server, Linux/Docker deployment

**Project Type**: Web application (Hono server + htmx frontend)

**Performance Goals**: First workflow progress update within 1s of trigger (SC-001), progress updates every 3s during lesson generation (SC-003), errors displayed within 2s of failure (SC-004).

**Constraints**: Must use existing htmx/hypermedia patterns (no SPA framework). Must integrate with existing SSE infrastructure (`ai/events.ts`). Must not add new database tables (session-scoped state). Must replace or repair the existing broken banner.

**Scale/Scope**: Multi-user (single server). 4 user stories across 3 workflow types (chat tools, lesson generation, mission activation). Touches chat route, lessons route, missions/onboarding route, and a new shared chrome element.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ PASS | `WorkflowStateManager` will be injectable via `createApp()` options. Tests inject in-memory state. |
| II. HTTP-Level Integration Testing | ✅ PASS | New endpoints tested via `app.request()` with `FakeAiClient` for AI-triggered workflows. SSE events verified via response body inspection. |
| III. Hypermedia-Driven Frontend | ✅ PASS | Site-wide indicator rendered as HTML fragment via htmx. SSE events push DOM updates. No JSON API, no SPA. Page-local panels use htmx polling for catch-up after navigation. |
| IV. Explicit Dependency Injection | ✅ PASS | Workflow state manager accessed via `c.get("workflowState")` from Hono context. No module-level singleton. |
| V. Manual Migration Discipline | ✅ PASS | No schema changes needed — workflow progress state is session-scoped in-memory. If future cross-session persistence is added, manual SQL migration required. |

**Gate result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-agentic-workflow-visibility/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── sse-events.md    # SSE event format contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── events.ts           # Existing SSE emitter — extend for workflow events
│   └── workflow-state.ts   # NEW: WorkflowStateManager (session-scoped state)
├── routes/
│   ├── chat.ts             # Modify: emit workflow events during tool loop
│   ├── lessons.ts          # Modify: emit workflow events during generation
│   └── missions.ts         # Modify: emit workflow events during activation
├── shared/
│   └── sse-poller.ts       # NEW: htmx-compatible SSE reconnection helper
├── views/
│   ├── fragments.ts        # Modify: add site-wide indicator fragment
│   ├── shared.ts           # Modify: render site-wide indicator in chrome
│   └── ...                 # Modify: add page-local progress panels
└── test/
    └── workflow-visibility.test.ts  # NEW: integration tests
```

**Structure Decision**: Single-project structure matches existing codebase. New module `src/ai/workflow-state.ts` for session-scoped state management. New shared SSE polling helper for htmx-compatible reconnection. View fragments for the site-wide indicator. No new directories needed.

## Complexity Tracking

> No constitution violations. Table omitted.
