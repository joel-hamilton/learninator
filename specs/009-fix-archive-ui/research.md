# Research: Fix Archive UI

**Feature**: 009-fix-archive-ui
**Date**: 2026-06-18

## 1. HTMX Out-of-Band Swaps for Cross-Section DOM Updates

### Decision

Use `hx-swap-oob` on response elements to update both the card's section and the opposite section in a single HTTP response. Render persistent `#active-section` and `#archived-section` containers on the home page so OOB targets always exist.

### Rationale

The current archive/restore/delete endpoints return `c.html("")` — an empty string. HTMX swaps this into the target (the mission card), effectively removing it. But the other section (archived or active) is not updated.

HTMX supports multiple top-level elements in a single response. The first element(s) without `hx-swap-oob` replace the original `hx-target`. Additional elements with `hx-swap-oob` can target any element in the DOM via CSS selector. This lets us:
- Remove the card from its current section (via the original `hx-target`)
- Insert/update the opposite section (via `hx-swap-oob`)

For this to work with the "first archive" edge case (no archived section exists yet), we render a persistent `<div id="archived-section">` on every page load. When empty (no archived missions), it contains nothing. The OOB swap always has a target.

The server re-queries missions after the status update and renders the complete section HTML. This is a single extra query (lightweight SQLite read) and avoids complex client-side logic.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| `HX-Trigger` header + client-side event to refresh section via separate GET | Adds a second HTTP request and latency. More complex (need event listener setup). |
| Re-render entire dashboard body on every action | Discards scroll position. Wastes bandwidth for large mission lists. |
| Client-side JS to `.appendChild()` the card into the other section | Violates hypermedia-driven principle (Constitution III). Bypasses server-side rendering. |
| Use `hx-swap-oob` with `beforeend` to append single card | Fails for "first archive" (no target exists). Requires separate handling for create vs. append. |

### Implementation Details

- The render helper queries `store.listMissions(user.id)` after the update, splits into active/archived, and renders both sections with `hx-swap-oob` attributes.
- `innerHTML` swap style is used (not `outerHTML`) so the container IDs persist after swap.
- Error responses (404, 400) remain `c.text()` — HTMX does not swap on 4xx responses by default, so the card stays visible.

## 2. Zero-JavaScript Collapsible Archived Section

### Decision

Use the native HTML `<details>` element with a `<summary>` header. Hide the default disclosure triangle with CSS and use a custom chevron indicator. Load the page with `<details>` closed (no `open` attribute).

### Rationale

`<details>` provides expand/collapse in all modern browsers with zero JavaScript. It is semantically correct for "progressive disclosure" content. The `<summary>` child acts as the always-visible clickable header. Keyboard accessibility is built-in (Enter/Space to toggle). Screen readers announce the expanded/collapsed state.

CSS `list-style: none` on `<summary>` hides the default triangle. A custom chevron (already exists as `svgIcon("chevronDown")`) provides visual toggle indication. Rotate the chevron when `[open]` via CSS transform.

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| CSS checkbox hack (`<input type="checkbox">` + label) | Semantically incorrect (it's not a form control). Poor accessibility without ARIA supplementation. |
| htmx lazy-load via `hx-get` + `hx-trigger="click once"` | Adds latency (second request). Archived missions are in the DB already; no need for lazy loading. |
| Custom JavaScript toggle | Violates principle of minimal JS. Constitution III requires htmx for interactivity. |
| `aria-expanded` + JS event listener | Requires custom JS. `<details>` provides this natively. |

### CSS Strategy

```css
.archived-section summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  user-select: none;
}
.archived-section summary::-webkit-details-marker { display: none; }
.archived-section summary .chevron {
  transition: transform 0.2s;
}
.archived-section[open] summary .chevron {
  transform: rotate(180deg);
}
```

The archived mission count is displayed in the summary: "Archived (3)".
