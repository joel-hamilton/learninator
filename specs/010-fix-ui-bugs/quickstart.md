# Quickstart: Fix UI Bugs Verification

**Feature**: Fix UI Bugs | **Date**: 2026-06-18

## Prerequisites

- Running dev server: `npm run dev`
- Modern browser (Chrome, Firefox, Safari, or Edge)

## Verification Scenarios

### 1. Sidebar Toggle (P1)

**Setup**: Open any mission page (e.g., `http://localhost:3000/missions/1`).

| Step | Action | Expected |
|------|--------|----------|
| 1a | At 1280px width, click sidebar toggle (chevron button at right edge of sidebar) | Sidebar collapses; toggle remains visible |
| 1b | Click toggle again | Sidebar re-opens; tabs visible |
| 1c | Resize to 768px or below, reload page | Sidebar starts collapsed; toggle visible and clickable |
| 1d | Click toggle at 768px | Sidebar opens; toggle moves with sidebar edge, remains clickable |
| 1e | Click toggle at 375px | Same behavior as desktop — opens/closes reliably |
| 1f | Rapid-click toggle 5 times quickly | Sidebar state matches visual display (no desync) |
| 1g | Collapse sidebar, then click "Lessons" tab | New content loads; sidebar stays collapsed |

### 2. Chat Message Overflow (P2)

**Setup**: Open mission chat (e.g., `http://localhost:3000/missions/1/chat`).

| Step | Action | Expected |
|------|--------|----------|
| 2a | Send a message that triggers a long AI response | All text wraps within message bubbles |
| 2b | Send a message with a very long URL (200+ chars) | URL breaks and wraps; no horizontal scrollbar on page |
| 2c | View at 375px width | All messages fit within viewport |
| 2d | Open lesson page, open chat panel (FAB), send message | Panel and messages stay within screen; no overflow |

**Quick test for overflow resistance**: Open browser devtools console and run:
```js
document.querySelector('.msg')?.insertAdjacentHTML('afterbegin', '<p style="max-width:100%">' + 'A'.repeat(500) + '</p>')
```
The long string should wrap, not push the page wider.

### 3. Chat FAB Visibility (P3)

**Setup**: Open any lesson page (e.g., `http://localhost:3000/missions/1/lessons/1`).

| Step | Action | Expected |
|------|--------|----------|
| 3a | Look at bottom-right corner | FAB is visible — indigo/purple circle with white chat icon |
| 3b | Hover over FAB | Background darkens slightly; button scales up 5%; cursor changes to pointer |
| 3c | Click FAB | Chat panel opens; FAB hides |
| 3d | Close chat panel | FAB reappears |

### 4. Full-Page Audit (P4)

**Setup**: Open each page at each breakpoint.

Pages to test:
- `/` (dashboard)
- `/missions/1` (mission detail)
- `/missions/1/lessons/1` (lesson)
- `/missions/1/chat` (mission chat)
- `/browse` (topic browse)
- `/settings` (settings)
- `/login` (auth)

Breakpoints: 375px, 768px, 1024px, 1440px

For each page at each breakpoint, check:
- [ ] No horizontal scrollbar
- [ ] No overlapping elements
- [ ] No clipped text or buttons
- [ ] All interactive elements visible and clickable
- [ ] No layout breakage (columns collapsing unintentionally, etc.)

## Running Tests

```bash
npm test
```

All existing tests must pass. No new automated tests are required for UI fixes (visual verification via browser is primary).

## Common Issues & Fixes Reference

| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| Toggle invisible after collapse | Button still inside `.sidebar` with `overflow:hidden` | Verify toggle is sibling of sidebar in DOM |
| FAB still white | `--accent` not defined or overridden | Check computed styles for `.fab` in devtools |
| Long URL overflows | Missing `overflow-wrap` on `.msg` | Check computed `overflow-wrap` on message element |
| Sidebar re-opens on tab switch | htmx swap resets collapse state | Verify sidebar-collapsed class persists after hx-swap |
