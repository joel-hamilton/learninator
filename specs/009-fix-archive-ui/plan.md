# Implementation Plan: Fix Archive UI

**Branch**: `009-fix-archive-ui` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-fix-archive-ui/spec.md`

## Summary

Fix two archive UI issues: (1) archiving/restoring/deleting a mission removes the card but doesn't update the other section until page reload, and (2) the archived section should be collapsed by default with a toggle to expand. The fix uses HTMX out-of-band swaps so archive/restore/delete responses insert cards into the correct section immediately, and a `<details>` element for the zero-JS collapsible section.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (server), htmx (frontend), Drizzle ORM + better-sqlite3 (storage)

**Storage**: SQLite — missions table with `status` column (`onboarding` | `active` | `archived`). No schema changes needed.

**Testing**: Vitest, in-memory SQLite, `app.request()` HTTP-level tests, `FakeAiClient` (not needed for this feature — no AI calls involved)

**Target Platform**: Web (server-rendered HTML with htmx)

**Project Type**: Web application (Hono + htmx)

**Performance Goals**: Archive/restore/delete responses must complete and update the DOM in under 1 second

**Constraints**: Must use htmx patterns (no custom JS framework); expand/collapse must work without custom JavaScript

**Scale/Scope**: Single-digit mission counts per user; 2 files to modify, 2 endpoints to add, 3 endpoints to change

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ Pass | Route handler changes use `c.get("store")` / `c.get("db")` — no new singletons. New endpoints follow same DI pattern. |
| II. HTTP-Level Integration Testing | ✅ Pass | Archive/restore/delete behavior testable via `app.request()` with in-memory SQLite. No AI calls involved. |
| III. Hypermedia-Driven Frontend | ✅ Pass | Uses htmx out-of-band swaps and `<details>` element — zero custom JavaScript. Server returns HTML fragments. |
| IV. Explicit Dependency Injection | ✅ Pass | All new handlers access `db`/`store` via Hono context. |
| V. Migration Snapshot Integrity | ✅ Pass | No schema changes. |

**Gate result**: All pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/009-fix-archive-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── home.ts          # MODIFY: add /home/archived-section endpoint, add IDs to active/archived containers
│   └── missions.ts      # MODIFY: archive/restore/delete return OOB swaps instead of empty strings
├── views/
│   ├── home.ts          # MODIFY: add <details> wrapper for archived section, CSS for collapsible behavior
│   └── shared.ts        # MODIFY: add chevron icon SVG if not already present
└── test/
    └── missions.test.ts # MODIFY: add tests for archive/restore/delete DOM updates
```

**Structure Decision**: Single web application. Changes are localized to routes and views, following existing patterns (no new files needed).

## Complexity Tracking

No violations to justify.

---

## Phase 0: Research

### Research Task: HTMX out-of-band swap patterns for cross-section DOM updates

**Decision**: Use `hx-swap-oob` on elements in the response to update the archived section, combined with section-specific endpoints that return complete section HTML.

**Rationale**: The current archive endpoint returns empty string, which removes the active card but doesn't update the archived section. HTMX supports processing multiple top-level elements in a single response — the first element replaces the target (`hx-target`), while additional elements with `hx-swap-oob` can target other parts of the DOM. This is the standard HTMX pattern for "update multiple unrelated DOM elements from one request."

For the "first archive" edge case (no archived section exists in the DOM yet), we need the OOB target to always exist. Solution: render a persistent `#archived-section` container on every home page load — it's empty when there are no archived missions but always present as a swap target.

**Alternatives considered**:
- `HX-Trigger` header + separate polling endpoint: Adds latency (need second request) and complexity. Rejected.
- Re-render entire dashboard on every archive action: Wasteful, discards scroll position. Rejected.
- Client-side JS to move the card: Violates htmx/hypermedia principle. Rejected.

### Research Task: Zero-JavaScript collapsible section

**Decision**: Use the native HTML `<details>` element with `<summary>` as the clickable header. Style with CSS to match the existing design.

**Rationale**: `<details>` provides expand/collapse behavior natively in all modern browsers with zero JavaScript. It degrades gracefully (content is visible if `<details>` isn't supported, though this is essentially never the case). The `<summary>` element provides the clickable header. The `open` attribute controls initial state — omitted by default means collapsed.

CSS can hide the default disclosure triangle and replace it with a custom chevron indicator. No custom JS event handlers needed.

**Alternatives considered**:
- CSS checkbox hack: Possible but semantically wrong and less accessible. Rejected.
- htmx-triggered lazy load: Would require a second request to fetch archived content, adding latency. Overkill for this use case. Rejected.
- Custom JS toggle: Violates principle of minimal JS. Rejected.

---

## Phase 1: Design & Contracts

### Data Model

No schema changes. The `missions.status` column already supports `"archived"`. The archive/restore flow is a state transition on existing data.

**Mission status state machine**:
```
onboarding → active → archived → active (restore)
                                  → deleted  (delete, terminal)
```

See [data-model.md](./data-model.md) for details.

### Contracts

#### Modified Endpoints

**POST /missions/:missionId/archive** (modified)

Response: HTML with out-of-band swaps.

When a mission is archived, the response contains:
1. Empty string (replaces the active `.mission-card` target, removing it)
2. A `<div hx-swap-oob="innerHTML:#archived-section">` containing the fully re-rendered archived section (all archived missions, section label, and list)

The server re-queries archived missions after the status update to produce the complete section HTML.

**POST /missions/:missionId/restore** (modified)

Response: HTML with out-of-band swaps.

When a mission is restored, the response contains:
1. Empty string (replaces the archived `.mission-card` target, removing it)
2. A `<div hx-swap-oob="innerHTML:#active-section">` containing the fully re-rendered active section
3. A `<div hx-swap-oob="innerHTML:#archived-section">` containing the updated archived section (or empty state if last archived was restored)

**POST /missions/:missionId/delete** (modified)

Response: HTML with out-of-band swaps.

When a mission is deleted, the response contains:
1. Empty string (replaces the archived `.mission-card` target, removing it)
2. A `<div hx-swap-oob="innerHTML:#archived-section">` containing the updated archived section (or empty state if last archived was deleted)

All error responses (404, 400) remain as `c.text()` — HTMX will not swap on non-2xx responses with the default configuration, so the card stays in place.

#### New Endpoint (internal, for section re-rendering)

**GET /home/sections** (new, internal)

Returns the active and archived section HTML for the current user. Used to avoid duplicating section rendering logic across three endpoints.

Response: HTML containing both `#active-section` and `#archived-section` divs with `hx-swap-oob` attributes.

See [contracts/](./contracts/) for full request/response documentation.

### Implementation Approach

1. **Refactor home page rendering**: Extract section rendering into reusable functions. Add persistent `#active-section` and `#archived-section` containers (always rendered, even when empty). Add `<details>` wrapper around the archived section.

2. **Create shared section rendering**: A helper function `renderSections(userId, store)` that queries missions and returns HTML for both sections with `hx-swap-oob` attributes. Used by archive, restore, and delete endpoints.

3. **Modify archive/restore/delete endpoints**: Instead of returning empty strings, call the shared section renderer and return OOB HTML.

4. **Add tests**: Verify that archiving removes the active card AND populates the archived section; that restoring moves the card back; that deleting removes the card and updates the section; and that the "first archive" and "last restore" edge cases work correctly.

### Quickstart Validation

See [quickstart.md](./quickstart.md) for step-by-step validation instructions.

### Agent Context Update

Update `CLAUDE.md` plan reference to point to this plan file.
