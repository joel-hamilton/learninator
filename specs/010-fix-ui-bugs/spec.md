# Feature Specification: Fix UI Bugs

**Feature Branch**: `010-fix-ui-bugs`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "There are some UI bugs (the sidebar icon to collapse it doesn't show fully and then the sidebar can't be re-opened), also some chat boxes seem too wide and flow off the screen lots of stuff like that. Let's make a specification to find and destroy all the UI bugs. Also the chat FAB is all white, the icon needs to change color, or the background does."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collapse and Re-open Sidebar (Priority: P1)

A user viewing a mission page can collapse the sidebar to gain more screen space for content, then re-open it when they need to navigate to another tab. The toggle control must be fully visible and clickable at all screen widths, and the sidebar must reliably expand and collapse on each click.

**Why this priority**: A broken sidebar toggle traps the user — they cannot access other workspace tabs (Lessons, Chat, Reference, Records, Resources) without manually reloading or navigating away. This is a core navigation element used on every mission sub-page.

**Independent Test**: Open any mission page, click the sidebar toggle. Verify the sidebar collapses. Click the toggle again. Verify the sidebar re-opens. Repeat at desktop (1280px), tablet (768px), and mobile (375px) widths. The toggle button must be visible and clickable in both collapsed and expanded states at all widths.

**Acceptance Scenarios**:

1. **Given** I am on a mission page at desktop width (≥1024px) with the sidebar visible, **When** I click the sidebar collapse toggle, **Then** the sidebar collapses smoothly and the toggle button remains fully visible (not clipped or hidden).
2. **Given** I am on a mission page at desktop width with the sidebar collapsed, **When** I click the sidebar toggle, **Then** the sidebar re-opens fully and all navigation tabs are visible and clickable.
3. **Given** I am on a mission page at tablet width (768px or below), **When** the page loads, **Then** the sidebar starts collapsed but the toggle button is visible and clickable so I can open it.
4. **Given** I am on a mission page at mobile width (375px) with the sidebar collapsed, **When** I click the toggle, **Then** the sidebar opens and the toggle remains accessible (not pushed off-screen).
5. **Given** I collapse the sidebar, navigate to a different mission tab, **When** the new content loads, **Then** the sidebar stays in its collapsed state (does not unexpectedly re-open).

---

### User Story 2 - Chat Messages Stay Within Viewport (Priority: P2)

A user chatting with the AI on a mission page or lesson page sees all messages contained within the visible area. Long messages, code blocks, or unbroken text strings do not cause horizontal scrolling at any reasonable screen width.

**Why this priority**: Content that overflows the viewport makes it impossible to read AI responses without awkward horizontal scrolling. Since the AI generates the primary value of the app (teaching content), unreadable messages directly undermine the core user experience.

**Independent Test**: On a mission chat page, type a prompt that causes the AI to respond with a long code block or a lengthy paragraph. Verify all text wraps within the chat area without horizontal scrollbars. Repeat on the lesson page chat panel at mobile width (375px). Test with a message containing a very long unbroken string (e.g., a URL or file path).

**Acceptance Scenarios**:

1. **Given** I am viewing the mission chat with existing messages, **When** a new AI response containing a long paragraph arrives, **Then** the text wraps within the message bubble and no horizontal scrollbar appears on the page.
2. **Given** I am viewing the mission chat, **When** the AI responds with a code block containing long lines, **Then** the code block scrolls horizontally within its container but the page itself does not overflow.
3. **Given** I am on a lesson page at mobile width (375px), **When** I open the chat panel and send a message, **Then** the chat panel and all message bubbles fit within the screen width with no horizontal overflow.
4. **Given** I am viewing the mission chat, **When** multiple messages of varying lengths are displayed, **Then** all messages respect a maximum width and do not overlap or extend past their container.

---

### User Story 3 - Chat FAB Has Visible Contrast (Priority: P3)

A user on a lesson page sees a clearly visible floating action button to open the chat panel. The button's icon contrasts with its background so the user can identify it as an interactive element.

**Why this priority**: A FAB that blends into the background (white icon on white background) looks broken and confuses users about whether chat is available. However, once discovered, the chat panel can still be opened, so this is less severe than broken navigation or unreadable content.

**Independent Test**: Open any lesson page. Visually inspect the FAB button in the bottom-right corner — the icon must be distinguishable from the button background. Take screenshots at both light and dark browser themes (if system-level dark mode affects rendering).

**Acceptance Scenarios**:

1. **Given** I am viewing a lesson page, **When** the page loads, **Then** the chat FAB in the bottom-right corner shows a visible icon that clearly contrasts with the button background.
2. **Given** I am viewing a lesson page with the chat FAB visible, **When** I hover over the FAB, **Then** the button shows a hover state (e.g., background or shadow change) indicating it is interactive.

---

### User Story 4 - Audit Remaining UI Issues (Priority: P4)

A maintainer systematically reviews all pages at multiple screen widths to identify any remaining visual bugs — alignment issues, overlapping elements, invisible controls, text truncation, or layout breakage. Each discovered issue is either fixed or documented for a follow-up.

**Why this priority**: The user reported "lots of stuff like that," suggesting more bugs exist beyond the three explicitly named. A systematic audit catches problems users haven't yet reported, preventing death-by-a-thousand-cuts UX degradation.

**Independent Test**: Open every page in the application (dashboard, mission tabs, lesson, browse, settings, auth pages) at 375px, 768px, 1024px, and 1440px widths. Document every visual defect found. No new bugs should remain after fixes are applied; any deferred issues must have a clear rationale.

**Acceptance Scenarios**:

1. **Given** the UI audit checklist is executed, **When** each page is reviewed at each breakpoint, **Then** no element is cut off, overlapping another element, or invisible due to color/contrast issues.
2. **Given** the audit identifies a bug, **When** the fix is applied, **Then** the page renders correctly at all supported widths without regressing other elements.

---

### Edge Cases

- What happens when the sidebar toggle is clicked rapidly multiple times? The animation or state must not desync from the actual sidebar visibility.
- What happens when a chat message contains an extremely long unbroken string (e.g., a 500-character URL or a base64-encoded image)? The message container must break or scroll the string without pushing page layout.
- What happens when the browser is resized while the sidebar is open? The sidebar must respond to the new width without leaving the toggle in an unreachable position.
- What happens when the lesson chat panel is open and the browser is resized to mobile width? The panel must remain usable and not extend past the viewport.
- What happens when the chat FAB overlaps with lesson content (e.g., very long feedback bar text)? The FAB must not obscure interactive elements.
- What happens on very narrow screens (320px, e.g., iPhone SE)? All core interactions (navigation, chat, reading) must remain possible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sidebar collapse/expand toggle MUST be fully visible (not clipped, hidden, or positioned off-screen) in both collapsed and expanded states at all viewport widths from 320px to 2560px.
- **FR-002**: The sidebar MUST expand on toggle click when collapsed, and collapse on toggle click when expanded, without exceptions or stuck states.
- **FR-003**: At viewport widths ≤768px, the sidebar MUST default to collapsed on page load but remain openable via the toggle.
- **FR-004**: All chat message containers (mission chat, lesson chat panel, onboarding chat) MUST prevent horizontal overflow of their content — text must wrap, code blocks must scroll internally, and unbroken strings must break or be contained.
- **FR-005**: The lesson page chat FAB MUST have a visible icon with sufficient contrast against its background (minimum 3:1 contrast ratio).
- **FR-006**: The lesson page chat FAB MUST show a visual hover state (cursor change plus background, shadow, or scale change) to indicate interactivity.
- **FR-007**: All application pages MUST render without visible layout defects (overlapping elements, clipped content, misaligned components) at viewport widths of 375px, 768px, 1024px, and 1440px.
- **FR-008**: The sidebar collapse state MUST persist across tab navigation within the same mission (switching between Mission, Lessons, Chat, Reference, Records, Resources tabs).
- **FR-009**: Rapid repeated clicks on the sidebar toggle MUST NOT cause the sidebar state to desync from visual display (e.g., toggle thinks it's open but sidebar is hidden).

### Key Entities

- **Viewport Breakpoints**: The application supports three effective breakpoints — mobile (320px–480px), tablet (481px–768px), and desktop (769px+). The sidebar has specific behavior at ≤768px; the lesson chat panel has responsive behavior at ≤480px.
- **Sidebar State**: Either `expanded` (250px wide, full tab labels visible) or `collapsed` (0px wide, only toggle button visible). State is managed client-side via CSS class toggling on the `.layout` element.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can collapse and re-open the sidebar in a single click, 100% of the time, at any supported viewport width.
- **SC-002**: The sidebar toggle button is visible at all viewport widths (320px–2560px) in both collapsed and expanded states — defined as having at least 50% of the button's area within the viewport and not obscured by any other element.
- **SC-003**: Zero pages exhibit horizontal overflow at viewport widths ≥375px. The browser's horizontal scrollbar never appears during normal use.
- **SC-004**: The chat FAB icon has a contrast ratio of at least 3:1 against its background, verified by visual inspection or automated contrast check.
- **SC-005**: A full-page audit at four breakpoints (375px, 768px, 1024px, 1440px) finds zero new visual defects after fixes are applied.
- **SC-006**: No user-reported UI bugs of the types described (hidden controls, overflow, invisible elements) reoccur within the same release cycle.

## Assumptions

- The application uses CSS custom properties (design tokens) defined in `src/views/shared.ts` for colors, spacing, and typography. Fixes will use these existing tokens rather than hardcoding new values, unless a new token is clearly justified.
- The sidebar collapse mechanism uses CSS classes and inline JavaScript as implemented in `src/views/mission.ts`. Fixes will work within this existing pattern (no framework migration).
- All fixes are scoped to the existing HTML/CSS/JS in the view files — no new dependencies, libraries, or build steps.
- Browser support is modern evergreen browsers (Chrome, Firefox, Safari, Edge) released within the last 2 years. IE11 and other legacy browsers are out of scope.
- The chat FAB issue refers to the floating action button in `src/views/lesson.ts` that toggles the lesson chat panel.
- "Lots of stuff like that" suggests there may be additional minor visual issues beyond the three explicitly named. The P4 audit story covers discovering these.
