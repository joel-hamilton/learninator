# Quickstart Validation: Fix Archive UI

**Feature**: 009-fix-archive-ui
**Date**: 2026-06-18

## Prerequisites

- Dev server running: `npm run dev`
- At least one active mission created
- Browser with DevTools open (Network tab)

## Validation Scenarios

### Scenario 1: Archive moves mission to archived section

1. Navigate to `http://localhost:5173/`
2. Verify both active missions and (if any) an archived section are visible
3. Click "Archive" on an active mission card
4. Confirm the dialog ("Archive this mission?")
5. **Expected**: The active card disappears AND an archived version of the card immediately appears in the "Archived" section below
6. **Expected**: No page reload occurred (check Network tab — only the POST request)

### Scenario 2: First archive creates the archived section

1. Ensure there are NO archived missions
2. Archive the only remaining active mission (or any active mission when archived is empty)
3. **Expected**: An "Archived" section appears with the archived card inside it
4. **Expected**: The "Archived" section is collapsed by default (cards hidden, only header visible)

### Scenario 3: Restore moves mission back to active

1. Click "Restore" on an archived mission card
2. **Expected**: The archived card disappears from the archived section AND appears in the active list
3. **Expected**: If this was the last archived mission, the archived section disappears entirely

### Scenario 4: Delete removes archived mission

1. Click "Delete" on an archived mission card
2. Confirm the dialog ("Permanently delete this mission?...")
3. **Expected**: The card disappears
4. **Expected**: If this was the last archived mission, the archived section disappears entirely

### Scenario 5: Expand/collapse archived section

1. On page load with archived missions, verify the archived section shows only the header (e.g., "Archived (2)" with a chevron)
2. **Expected**: No archived cards are visible
3. Click the "Archived" header
4. **Expected**: The section expands to reveal the archived cards; the chevron rotates
5. Click the header again
6. **Expected**: The section collapses, hiding the cards; the chevron rotates back

### Scenario 6: Archive when archived section is collapsed

1. Ensure archived section has at least one mission and is collapsed
2. Archive another active mission
3. **Expected**: The new archived card is added to the (hidden) archived section; the count in the header updates
4. Expand the archived section
5. **Expected**: The newly archived card is visible along with existing archived cards

### Scenario 7: Error handling

1. Using browser DevTools, manually POST to `/missions/99999/archive`
2. **Expected**: 404 response; nothing changes in the UI
3. Attempt to archive an already-archived mission (if possible via double-click race)
4. **Expected**: 400 response; card remains in place

## Automated Test Commands

```bash
# Run all tests
npm test

# Run missions-specific tests
npx vitest run src/test/missions.test.ts

# Run in watch mode during development
npm run test:watch
```

### New Test Cases Expected

- Archive returns OOB swap that populates `#archived-section`
- Archive when no archived missions exist creates section with first card
- Restore returns OOB swaps for both `#active-section` and `#archived-section`
- Restore of last archived mission returns empty `#archived-section`
- Delete returns OOB swap for updated `#archived-section`
- Delete of last archived mission returns empty `#archived-section`
- Error responses (404, 400) return text, not HTML (card stays visible)
