# Research: Agentic Workflow Visibility

**Feature**: specs/001-agentic-workflow-visibility
**Date**: 2026-06-18

## Decision: User-scoped event bus alongside existing mission-scoped bus

**Rationale**: The existing `EventBus` in `ai/events.ts` is mission-scoped
(subscribe/emit keyed by `missionId`). The site-wide indicator needs to see
events for all missions belonging to a user. Rather than changing the existing
bus (which would break mission-scoped page-local panels and the existing
LessonGenerator), add a parallel user-scoped channel.

**Alternatives considered**:
- Change existing bus to broadcast all events to all subscribers → would flood
  mission-specific page-local panels with irrelevant events, breaking SC-002
  (100% of tool calls must show a visible step — too many events would make the
  panel noise).
- Use a single bus with filtering at subscriber → same complexity as two
  channels but with extra filtering logic.
- Polling HTTP endpoint instead of SSE events → adds latency and server load;
  violates SC-001 (first update within 1s).

## Decision: Session-scoped in-memory WorkflowStateManager

**Rationale**: The spec mandates same-session persistence only (navigation,
reloads, tab-restores within one login session — no cross-session survival).
In-memory storage avoids database migrations, matches the existing
`LessonGenerator` pattern (Map-based job storage), and keeps workflow state
fast (no DB round-trips for status checks). The `createApp()` factory injects
the manager; tests use a fresh instance per test.

**Alternatives considered**:
- SQLite table for workflow runs → adds migration complexity (Constitution
  Principle V), unnecessary for session-scoped data, and adds latency to every
  status update.
- Attach state to user session object → sessions are cookie-based and
  serialized; workflow state is too volatile and high-churn for session
  serialization.

## Decision: SSE for real-time updates, polling endpoint for catch-up

**Rationale**: SSE already works in the app (`streamSSE` from Hono,
`EventSource` in the browser). For real-time step updates during a workflow,
SSE pushes events with minimal latency. However, when a user navigates to a new
page, the new page needs the *current state* of all running workflows
immediately. A lightweight HTTP endpoint returns the full state snapshot
(active workflows for the user), then the page subscribes to SSE for ongoing
updates.

**Alternatives considered**:
- SSE + Last-Event-ID for replay → Hono's `streamSSE` doesn't support event
  replay natively; building a replay buffer adds complexity.
- Polling-only (no SSE) → latency for real-time updates (SC-001) would suffer.
- WebSockets → adds dependency (the project uses htmx, not a SPA framework with
  WebSocket support); SSE is simpler and uni-directional, matching the need.

## Decision: Site-wide indicator as shared chrome element

**Rationale**: The site-wide indicator must be visible on every page. Rather
than duplicating it in each page template (as the current `tool-banner` is),
render it once in the shared layout (`views/shared.ts`) and update it via SSE
events. Each page may additionally render a page-local detail panel for its
specific workflow. The existing per-page `tool-banner` divs and their
duplicated CSS/JS are replaced.

**Alternatives considered**:
- Keep per-page banners and sync via localStorage → fragile, doesn't handle
  concurrent workflows across pages, adds browser storage dependency.
- iframe-based banner → breaks htmx patterns and styling.

## Decision: Extend existing ToolEvent format rather than replacing it

**Rationale**: The current `ToolEvent` type (`type: "tool_start" | "tool_end"`,
`names: string[]`) is consumed by the existing banner. Add a new event shape
that includes workflow metadata (workflow ID, type, step description, status)
while keeping the existing `ToolEvent` for backward compatibility. The SSE
endpoint streams both shapes; the site-wide indicator reads workflow events;
the page-local panel reads both tool and workflow events.

**Alternatives considered**:
- Replace ToolEvent entirely → breaks existing LessonGenerator event emission
  and the mission-scoped SSE endpoint used by some views.
- Create separate SSE endpoints → more HTTP connections, more server overhead.
