# Research: Fix UI Bugs

**Feature**: Fix UI Bugs | **Date**: 2026-06-18

## Root Cause Analysis

### 1. Sidebar Toggle Not Visible / Can't Re-open

**Decision**: Move the `.sidebar-toggle` button outside `.sidebar` to be a direct child of `.layout`.

**Rationale**:
- The toggle button is currently a child of `<aside class="sidebar">` and positioned via `position: absolute; right: -12px`.
- When the sidebar is collapsed, `.layout.sidebar-collapsed .sidebar` applies `overflow: hidden; padding: 0;`, which clips the absolutely-positioned toggle button that extends beyond the sidebar's right edge.
- At mobile widths (≤768px), the button moves to `right: -28px`, making it even more hidden.
- Moving it outside `.sidebar` as a sibling element isolates it from the `overflow: hidden` that hides sidebar content. The button can then be positioned relative to `.layout` instead.

**Alternatives considered**:
- `overflow: clip` instead of `overflow: hidden` — rejected because `overflow: clip` prevents scrolling but doesn't clip absolutely-positioned children, which would still show sidebar content peeking through.
- CSS `clip-path` on sidebar content only — rejected as overly complex.
- Making `.sidebar` use `visibility: hidden` + `position: absolute` when collapsed — rejected because it breaks the CSS grid animation.

### 2. Chat FAB Invisible (White on White)

**Decision**: Define `--accent`, `--accent-hover`, `--accent-light`, and `--accent-ghost` in the `:root` design token block in `src/views/shared.ts`.

**Rationale**:
- The FAB button uses `background: var(--accent); color: #fff;`. Since `--accent` is never defined, the declaration is invalid at computed-value time and falls back to `initial` → `transparent`. The white icon on a transparent background is invisible against the light `var(--paper)` page background.
- The existing box-shadow on `.fab` uses `rgba(79,70,229,0.25)` — the indigo/purple shade `#4f46e5` is the intended accent color. We'll derive the token values from this.
- Multiple views use `--accent` and its variants: `--accent-hover`, `--accent-light`, `--accent-ghost`. All must be defined.

**Token values** (derived from existing usage in box-shadows and hover states):
- `--accent: #4f46e5` — indigo (matches existing `rgba(79,70,229,0.25)` box-shadow)
- `--accent-hover: #4338ca` — darker indigo for hover
- `--accent-light: #eef2ff` — very light indigo for subtle backgrounds
- `--accent-ghost: #f5f3ff` — near-white indigo for ghost backgrounds

**Alternatives considered**:
- Only fix the FAB by inlining `background: #4f46e5` — rejected because `--accent` is used in multiple places (lesson.ts, mission.ts, home.ts) and all would benefit from a centralized token.
- Use a different accent color — the indigo is already established by existing box-shadow usage.

### 3. Chat Messages Overflow Viewport

**Decision**: Add `overflow-wrap: break-word; word-break: break-word;` to `.msg`, `.msg-row .msg`, and standalone `.msg` variants. Add `min-width: 0` to `.msg-row` to prevent flex items from ignoring their `max-width`.

**Rationale**:
- `.msg-row` has `max-width: 88%` but flex/grid items default to `min-width: auto`, which can cause them to exceed `max-width` when content demands space.
- `.msg` bubbles have no `overflow-wrap` or `word-break` — long unbroken strings (URLs, base64, file paths) will overflow the bubble and push the page width.
- `.markdown-body pre` already has `overflow-x: auto` for code blocks, but tables and inline code within messages lack overflow containment.
- Adding `min-width: 0` to flex children + `overflow-wrap` to text content is the standard CSS pattern for preventing overflow in flex layouts.

**Alternatives considered**:
- Only add `overflow: hidden` — rejected because it clips content rather than making it readable.
- Add `overflow-x: auto` to message bubbles — rejected because horizontal scrollbars on individual messages are worse UX than wrapping text.

### 4. Undefined Design Tokens (Additional Findings)

**Decision**: Define all missing CSS custom properties in `:root` that are referenced across view files. Map them to existing tokens or sensible values.

**Rationale**:
- `--border` (used 4+ places in lesson.ts, mission.ts) — maps to `--rule` (#e0dbd2)
- `--text-muted` (used in lesson.ts) — maps to `--ink-muted` (#9c9589)
- `--text` (used in lesson.ts) — maps to `--ink` (#1e1b18)
- `--text-secondary` (used in lesson.ts) — maps to `--ink-secondary` (#5c5650)
- `--primary-light` (used in lesson.ts) — maps to `--accent-light`

While these undefined tokens may not cause visible breakage (CSS falls back to inherited values), they represent incomplete theming and could cause subtle visual inconsistencies between views.

**Alternatives considered**:
- Replace all `var(--border)` with `var(--rule)` inline — rejected because it spreads across multiple files and creates token inconsistency.
- Do nothing — rejected because the P4 audit story covers finding and fixing all issues.
