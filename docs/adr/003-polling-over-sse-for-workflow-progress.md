# ADR-0003: Polling over SSE for workflow progress

**Status:** Accepted
**Date:** 2026-06-15 (implicit in implementation)

## Context

Long-running AI operations (lesson generation, mission activation) need to show
progress to the user. Two patterns were considered: Server-Sent Events (SSE) for
push-based updates, and HTTP polling for pull-based updates.

An SSE endpoint was initially built (`GET /workflows/events`) with corresponding
`subscribeUser`/`emitUser` machinery in the event bus and client-side SSE
handlers. In practice, the client-side code exclusively used polling against
`GET /workflows/state`.

## Decision

Polling is the primary progress mechanism. The `sse-poller.ts` client script
polls `/workflows/state` every 5 seconds when workflows are active, and stops
when idle. The `WorkflowStateManager` maintains workflow state in memory (with
timed cleanup); clients discover state by polling.

The SSE endpoint, `subscribeUser`/`emitUser` event bus methods, and client-side
SSE handlers were retained as scaffolding but are not the active path.

## Consequences

- Simpler connection model: no persistent connections to manage, no
  reconnection logic
- Fewer server resources: no open connections during idle periods
- 5-second polling granularity means progress updates are not instant
- The dual-path architecture (SSE + polling) creates dead-code risk — future
  cleanup should either remove the SSE machinery or commit to SSE
