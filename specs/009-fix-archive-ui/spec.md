# Feature Specification: Fix Archive UI

**Feature Branch**: `009-fix-archive-ui`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Archive removes the lesson from the main list but it doesn't add it to the archived section until the page is reloaded. Also let's collapse the archived lessons, so they need to be expanded in order to see them."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archive Moves Mission Immediately (Priority: P1)

A user viewing their dashboard clicks "Archive" on a mission card. The mission card disappears from the active list AND immediately appears in the "Archived" section below — no page reload required. If no archived section exists yet, one appears with the newly archived mission in it.

**Why this priority**: This is the core bug — the current behavior is broken. Users click archive, the card vanishes, and they have no way to access the mission again without reloading the entire page. This is confusing and feels like data loss.

**Independent Test**: Can be fully tested by archiving a mission from the dashboard and verifying the mission card immediately appears in the archived section without any page navigation or reload.

**Acceptance Scenarios**:

1. **Given** a dashboard with active missions and an existing archived section, **When** the user clicks "Archive" on an active mission card and confirms, **Then** that card is removed from the active list and immediately appears as an archived mission card in the archived section.
2. **Given** a dashboard with active missions and NO existing archived missions, **When** the user clicks "Archive" on the last active mission (or any active mission), **Then** the card is removed from the active list and an "Archived" section appears containing the newly archived mission card.
3. **Given** a dashboard with one active mission and one archived mission, **When** the user clicks "Restore" on the archived mission card, **Then** the card is removed from the archived section and immediately appears in the active list. If this was the last archived mission, the archived section disappears entirely.

---

### User Story 2 - Collapsible Archived Section (Priority: P2)

A user viewing their dashboard sees the "Archived" section header with a count of archived missions and a toggle indicator (e.g., a chevron or arrow). The archived mission cards are hidden by default. Clicking the header expands the section to reveal the cards; clicking again collapses it.

**Why this priority**: This is a UX improvement that keeps the dashboard clean. Archived missions are rarely accessed, so hiding them by default reduces visual clutter. It depends on P1 being fixed first (the section must exist to be collapsible).

**Independent Test**: Can be fully tested by loading a dashboard with archived missions, verifying they are hidden on initial load, then clicking the section header and verifying they become visible.

**Acceptance Scenarios**:

1. **Given** a dashboard with archived missions, **When** the page first loads, **Then** the "Archived" section header is visible but the archived mission cards are hidden (collapsed).
2. **Given** a dashboard with the archived section collapsed, **When** the user clicks the "Archived" section header, **Then** the archived mission cards are revealed (expanded).
3. **Given** a dashboard with the archived section expanded, **When** the user clicks the "Archived" section header again, **Then** the archived mission cards are hidden (collapsed).
4. **Given** the archived section is collapsed and the user archives a new mission, **When** the new archived card is inserted, **Then** the section remains collapsed (the user still sees the updated count but the cards stay hidden unless they expand).

---

### Edge Cases

- What happens when the very first archived mission card is added via HTMX and no archived section container exists in the DOM? The response must include both the new section wrapper AND the card.
- What happens when the last archived mission is restored or deleted? The archived section (including the header and container) must be removed from the DOM.
- What happens when the archived section is collapsed and a new archived card is inserted out-of-band? The new card should appear inside the hidden container and not become visible until the user expands the section.
- What happens if the user clicks archive but the server returns an error (e.g., mission already archived)? The card should remain in place and a user-friendly message should appear (or the error should be surfaced).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The archive endpoint MUST return HTML that removes the active mission card AND inserts the corresponding archived mission card into the archived section, all in a single response.
- **FR-002**: When archiving the first archived mission (no archived section exists in the DOM), the response MUST create a new archived section wrapper containing the archived card.
- **FR-003**: The restore endpoint MUST return HTML that removes the archived mission card AND inserts the corresponding active mission card into the active list.
- **FR-004**: When restoring the last archived mission, the response MUST remove the entire archived section from the DOM.
- **FR-005**: The delete endpoint MUST remove the archived mission card from the DOM. When deleting the last archived mission, it MUST also remove the archived section.
- **FR-006**: The "Archived" section MUST be collapsed by default on page load, showing only the section header with a count of archived missions and an expand/collapse toggle indicator.
- **FR-007**: Clicking the "Archived" section header MUST toggle the visibility of the archived mission cards.
- **FR-008**: The expand/collapse toggle MUST work without JavaScript beyond what the frontend framework provides (i.e., a native browser progressive disclosure mechanism or CSS-only toggle that degrades gracefully if scripting is disabled).
- **FR-009**: The archive confirmation dialog MUST remain in place (the existing `confirm()` call).

### Key Entities

- **Mission**: Already exists in the system. Key attribute: `status` (one of `onboarding`, `active`, `archived`). No schema changes needed.
- **Archived Section**: A DOM container that holds archived mission cards. May or may not exist depending on whether any archived missions are present.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After clicking "Archive" and confirming, the mission card appears in the archived section in under 1 second (perceived as instant by the user).
- **SC-002**: After clicking "Restore" on an archived mission, the mission card appears in the active list in under 1 second.
- **SC-003**: The archived section on page load shows only the header; users must take an explicit action to see archived content.
- **SC-004**: Zero page reloads are required to see archive/restore/delete results reflected in the UI.

## Assumptions

- The existing `confirm()` dialog for archive is sufficient; no custom modal or undo mechanism is needed for this feature.
- The archived section uses the same card rendering as on full page load (same HTML structure from `views/home.ts`).
- The expand/collapse state does not need to persist across page loads — it resets to collapsed on each visit. If state persistence is desired, it can be added later.
- HTMX out-of-band swaps (`hx-swap-oob`) or `HX-Trigger` headers are acceptable implementation approaches within the existing htmx architecture.
- The restore and delete flows have the same fundamental problem (card disappears but doesn't update the other section) and should be fixed in the same pass.
