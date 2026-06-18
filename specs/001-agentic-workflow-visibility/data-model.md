# Data Model: Agentic Workflow Visibility

**Feature**: specs/001-agentic-workflow-visibility
**Date**: 2026-06-18

## Entities

### WorkflowRun

Represents a single execution of an agentic workflow. Session-scoped
(in-memory, no database persistence).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (UUID) |
| `userId` | `number` | Owning user |
| `type` | `"chat" \| "lesson_generation" \| "mission_activation"` | Workflow category |
| `label` | `string` | Human-readable summary for the site-wide indicator (e.g., "Creating lesson: Chord Progressions") |
| `status` | `"running" \| "completed" \| "failed"` | Current status |
| `missionId` | `number` | Related mission (for linking to the detail page) |
| `linkUrl` | `string` | URL to the page showing full detail for this workflow |
| `steps` | `WorkflowStep[]` | Ordered list of steps executed so far |
| `error` | `string \| null` | Error message if status is "failed" |
| `startedAt` | `number` | `Date.now()` when created |
| `updatedAt` | `number` | `Date.now()` of last state change |

### WorkflowStep

A single action within a workflow run.

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Student-friendly description (e.g., "Looking up previous lessons...") |
| `status` | `"pending" \| "active" \| "completed" \| "failed"` | Step status |
| `detail` | `string \| null` | Optional extra context (e.g., "Sub-lesson 3 of 7") |
| `startedAt` | `number \| null` | When the step became active |
| `completedAt` | `number \| null` | When the step finished |

### WorkflowEvent

Pushed over SSE to update the UI in real time. Lightweight — carries only the
changed data plus routing identifiers.

| Field | Type | Description |
|-------|------|-------------|
| `event` | `"workflow_start" \| "workflow_step" \| "workflow_complete" \| "workflow_error"` | Event type |
| `workflowId` | `string` | References WorkflowRun.id |
| `userId` | `number` | Target user (for user-scoped filtering) |
| `workflowType` | `string` | workflowRun.type at event time |
| `label` | `string` | Updated label or step description |
| `status` | `string` | Updated status |
| `linkUrl` | `string \| null` | URL for navigation |
| `error` | `string \| null` | Error detail (workflow_error only) |

## State Transitions

```
WorkflowRun lifecycle:
  running ──→ completed
    │
    └──────→ failed

WorkflowStep lifecycle (within a run):
  pending ──→ active ──→ completed
                 │
                 └──────→ failed
```

## Relationships

- **WorkflowRun** 1──* **WorkflowStep**: A run contains an ordered list of steps.
- **WorkflowRun** → **User**: Each run belongs to exactly one user (session-scoped).
- **WorkflowRun** → **Mission**: Each run optionally links to a mission (for navigation).
- **WorkflowEvent** → **WorkflowRun**: Each event references exactly one run.

## Validation Rules

- WorkflowRun.id must be unique across the session.
- A WorkflowRun cannot transition from "completed" or "failed" back to "running".
- A WorkflowStep cannot transition from "completed" or "failed" back to "active" or "pending".
- Every WorkflowRun must have at least one WorkflowStep before reaching "completed" status.
- `linkUrl` must be a relative path within the app (no external URLs).

## Storage

All entities stored in memory within `WorkflowStateManager` (a `Map<string,
WorkflowRun>` keyed by `id`, indexed by `userId`). The manager is created once
per `createApp()` call and injected via Hono context. Cleaned up on session
expiry or explicit logout.

No database tables. No migration needed.
