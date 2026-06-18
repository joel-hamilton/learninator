# SSE Event Contracts: Agentic Workflow Visibility

**Feature**: specs/001-agentic-workflow-visibility
**Date**: 2026-06-18

## Endpoints

### `GET /workflows/events` (user-scoped)

Server-Sent Events stream delivering workflow progress for all missions
belonging to the authenticated user. Used by the site-wide indicator.

**Auth**: Required (session cookie).

**Response**: `text/event-stream`

**Event types**:

#### `workflow_start`

Emitted when a new agentic workflow begins.

```json
{
  "event": "workflow_start",
  "workflowId": "wf_abc123",
  "type": "lesson_generation",
  "label": "Creating lesson: Chord Progressions",
  "linkUrl": "/missions/5"
}
```

#### `workflow_step`

Emitted when a step starts within an active workflow.

```json
{
  "event": "workflow_step",
  "workflowId": "wf_abc123",
  "step": {
    "label": "Reviewing previous lessons...",
    "status": "active"
  }
}
```

#### `workflow_complete`

Emitted when a workflow finishes successfully.

```json
{
  "event": "workflow_complete",
  "workflowId": "wf_abc123",
  "status": "completed",
  "label": "Lesson created: Chord Progressions"
}
```

#### `workflow_error`

Emitted when a workflow fails.

```json
{
  "event": "workflow_error",
  "workflowId": "wf_abc123",
  "status": "failed",
  "label": "Lesson generation failed",
  "error": "AI service unavailable. Please try again."
}
```

### `GET /missions/:missionId/chat/tool-events` (mission-scoped, existing — extended)

Existing SSE endpoint for per-mission tool visibility. Extended to also emit
`workflow_step` events alongside the existing `tool_start`/`tool_end` events.

**Existing event shapes preserved** (backward compatible):

```json
{ "type": "tool_start", "names": ["list_lessons", "create_lesson"] }
{ "type": "tool_end",   "names": ["list_lessons", "create_lesson"] }
```

### `GET /workflows/state` (HTTP polling)

Returns current state of all active workflows for the authenticated user. Used
for catch-up after page navigation or reload.

**Auth**: Required (session cookie).

**Response**: `application/json`

```json
{
  "workflows": [
    {
      "id": "wf_abc123",
      "type": "lesson_generation",
      "label": "Creating lesson: Chord Progressions",
      "status": "running",
      "missionId": 5,
      "linkUrl": "/missions/5",
      "steps": [
        { "label": "Looking at previous lessons...", "status": "completed", "detail": null },
        { "label": "Writing lesson: Chord Progressions...", "status": "active", "detail": "Sub-lesson 1 of 4" }
      ],
      "error": null,
      "startedAt": 1718740800000
    }
  ]
}
```

## Client Usage

### Site-wide indicator

```javascript
// On every page:
var es = new EventSource("/workflows/events");
es.addEventListener("workflow_start", function(e) {
  var data = JSON.parse(e.data);
  showBanner(data);
});
es.addEventListener("workflow_complete", function(e) {
  var data = JSON.parse(e.data);
  markComplete(data.workflowId);
});
es.addEventListener("workflow_error", function(e) {
  var data = JSON.parse(e.data);
  showError(data);
});
```

### Page-local detail panel

On page load, fetch `/workflows/state` to catch up on existing workflows, then
subscribe to `/missions/:missionId/chat/tool-events` for mission-specific
step-by-step detail if the user is on a mission page.

## Reconnection

The SSE helper (`src/shared/sse-poller.ts`) handles:
- Automatic reconnection with exponential backoff (1s, 2s, 4s, max 30s)
- Re-fetching `/workflows/state` after reconnect to fill gaps
- Visible disconnection indicator when connection is lost
