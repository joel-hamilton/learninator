# Quickstart: Agentic Workflow Visibility

**Feature**: specs/001-agentic-workflow-visibility
**Date**: 2026-06-18

## Prerequisites

- Node.js 22, npm install complete
- `npm run db:migrate` (no new migrations needed)
- Dev server running (`npm run dev`)

## Validation Scenarios

### VS-1: Site-wide indicator appears and persists across navigation

1. Log in as any user.
2. Create or open a mission with lessons.
3. Click "Generate Next Lesson" on the mission page.
4. **Expected**: Immediately, a site-wide indicator appears (e.g., top bar or
   bottom bar) with a message like "Creating lesson: ...".
5. Navigate to the dashboard (`/`). **Expected**: The indicator remains
   visible.
6. Navigate to Settings. **Expected**: The indicator remains visible.
7. Return to the mission page. **Expected**: The indicator is still visible,
   and the page-local detail panel shows the step-by-step progress.
8. Wait for lesson generation to complete. **Expected**: The indicator shows
   completion briefly, then dismisses. The lesson list on the mission page
   updates.

### VS-2: Chat tool steps appear in real time

1. Open an active mission and go to the chat tab.
2. Send a message that triggers tool use: "Create a reference document about
   scales."
3. **Expected**: Within 1 second, the page-local detail panel shows the first
   tool step with a student-friendly label (not the raw tool name).
4. **Expected**: As each tool call completes and the next starts, the panel
   updates incrementally — no page refresh needed.
5. **Expected**: The site-wide indicator also shows a summary ("Chatting about
   scales...").
6. When the AI finishes, **Expected**: The final text response appears and the
   step display shows all completed steps.

### VS-3: Page reload preserves workflow state

1. Trigger a lesson generation (as in VS-1).
2. While generation is in progress, reload the browser page (Cmd+R / Ctrl+R).
3. **Expected**: After reload, the site-wide indicator re-appears showing the
   current generation status — not a blank state.
4. If on the mission page, **Expected**: The page-local detail panel also
   re-renders with the current step.

### VS-4: Error display

1. Simulate an AI failure (e.g., use an invalid model name or break the API
   key temporarily).
1. Trigger lesson generation.
2. **Expected**: Within 2 seconds of the failure, the indicator shows the error
   state with a description — not a frozen spinner.

### VS-5: Multiple concurrent workflows

1. Start a lesson generation.
2. While it runs, go to another mission and start a chat with tool use.
3. **Expected**: The site-wide indicator shows both workflows (e.g., "1 lesson
   generating, 1 chat active").
4. Navigate to each mission's page. **Expected**: Each page shows only its own
   workflow's detail panel.

### VS-6: Old banner is gone

1. Search the page source and rendered DOM for any element with `id="tool-banner"`.
2. **Expected**: No such element exists. The old per-page banner HTML, CSS, and
   JS have been removed and replaced by the new site-wide indicator.

### VS-7: Disconnection recovery

1. Start a lesson generation.
2. Kill the dev server (`Ctrl+C`).
3. **Expected**: Within ~3 seconds, the indicator shows a "Connection lost.
   Reconnecting..." state.
4. Restart the dev server (`npm run dev`).
5. **Expected**: The indicator reconnects and shows the current workflow state
   (the generation may have completed or failed while disconnected — the
   indicator shows whatever the current state is).

## Run Tests

```bash
npm test -- src/test/workflow-visibility.test.ts
```

Should pass all tests before merging.
