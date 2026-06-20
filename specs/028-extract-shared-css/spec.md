# Feature Specification: Extract Shared CSS from Views

**Feature Branch**: `028-extract-shared-css`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description from architectural improvement candidate

## User Scenarios & Testing

### User Story 1 — Developer can load any page without inline CSS duplication (Priority: P1)

A developer loads any page in the application and the browser receives shared CSS from a single cached static file rather than repeated inline style blocks. Page-specific style overrides remain in the HTML where they belong. This is the core value of the feature: eliminating ~1800 lines of duplicated CSS across 5 view files.

**Why this priority**: This is the primary goal. Without this, none of the other improvements (cache efficiency, reduced HTML payload, single source of truth) are realized.

**Independent Test**: Load any three different pages (dashboard, mission view, lesson view) and verify that:
- The shared foundation CSS (reset, layout, buttons, modals, forms, chat bubbles, progress bars, scrollbars) is delivered once via a `<link>` tag pointing to `base.css`
- Each page's `<style>` block contains only rules specific to that page
- No page inlines rules that belong in the shared foundation
- The browser correctly caches `base.css` across page navigations

**Acceptance Scenarios**:

1. **Given** a user visits any application page, **When** the page loads, **Then** the HTML includes a `<link rel="stylesheet" href="/static/base.css">` tag instead of an inline `<style>` block containing the 490-line `HTMX_HEAD` content
2. **Given** the same user navigates to a different page, **When** the browser requests the new page, **Then** `base.css` is served from the browser cache (304 Not Modified or cache hit) rather than being re-downloaded
3. **Given** a developer inspects any view file, **When** they look at the page's `<style>` block, **Then** it contains only CSS rules unique to that page (no reset, layout, buttons, modals, forms, chat bubbles, progress bars, or scrollbar rules that belong in the shared foundation)

---

### User Story 2 — Developer can edit shared styles in one place (Priority: P1)

A developer wants to change a global style — for example, the default button appearance or the chat message layout. They open `src/views/base.css`, make the change, and restart the dev server. Every page in the application reflects the new style. No need to hunt through five view files to find duplicate definitions.

**Why this priority**: This is the developer experience motivation for the change. Duplicate CSS is a maintenance burden and a source of bugs (e.g., the conflicting `#htmx-loading-bar` definitions).

**Independent Test**: Make a change to a shared style in `base.css` (e.g., change the primary button background color) and verify the change appears on every page that uses that style.

**Acceptance Scenarios**:

1. **Given** the CSS extraction is complete, **When** a developer edits `.header` in `base.css`, **Then** all pages using the `.header` class reflect the change — no stale overrides in individual view files
2. **Given** there were previously multiple definitions of `#htmx-loading-bar`, **When** the extraction is complete, **Then** there is exactly one definition of `#htmx-loading-bar` in `base.css` with a single consistent height value

---

### User Story 3 — Developer can add page-specific style overrides without touching base.css (Priority: P2)

A developer needs to add a one-off style tweak for a new page component. They add the rule in the page's existing `<style>` block, knowing the shared foundation is already loaded from `base.css`. No need to pollute the global stylesheet with page-specific rules.

**Why this priority**: This preserves the ADR-0004 principle that styles stay co-located with their markup. The extraction touches only shared foundation CSS; page-specific overrides remain where they were.

**Independent Test**: Add a page-specific style override (e.g., a custom background color on the mission page) and verify the shared styles from `base.css` still apply correctly — the override adds to, not replaces, the foundation.

**Acceptance Scenarios**:

1. **Given** a page has its own `<style>` block with page-specific rules, **When** the page is rendered, **Then** both `base.css` and the page-specific `<style>` block are applied, with the page-specific rules correctly overriding the foundation where they conflict
2. **Given** the `HTMX_HEAD` template literal in `shared.ts`, **When** the extraction is complete, **Then** it contains a `<link>` tag pointing to the CSS file instead of inlining 490 lines of CSS

---

### Edge Cases

- **What happens when `base.css` fails to load?** The page should remain functional (though unstyled). No user data should be at risk. This is the same behavior as if the inline `<style>` block failed to parse.
- **How does the system handle aggressive caching during development?** Developers making CSS changes should not need to hard-refresh or clear their cache to see updates. The development server should either disable caching for `base.css` or use a cache-busting mechanism (e.g., content hash in the URL).
- **What if a view file's `<style>` block contains rules that are partially shared and partially page-specific?** The shared portions should be moved to `base.css` and only the page-specific portions should remain in the view file. Each rule must be reviewed individually.

## Requirements

### Functional Requirements

- **FR-001**: The application MUST serve a static CSS file (`base.css`) containing all shared foundation styles currently inlined in the `HTMX_HEAD` template literal
- **FR-002**: The `HTMX_HEAD` template literal in `src/views/shared.ts` MUST be changed from inline `<style>` block to a `<link rel="stylesheet">` tag referencing `base.css`
- **FR-003**: The server MUST serve `base.css` with aggressive HTTP caching headers (e.g., `Cache-Control: public, max-age=31536000, immutable`) to minimize repeated downloads
- **FR-004**: Each view file's `<style>` block MUST contain only CSS rules unique to that page — all shared foundation rules MUST be removed from page-specific `<style>` blocks
- **FR-005**: Duplicate class definitions across view files (`.header` defined 5 times, `.chat-messages` defined 4 times, etc.) MUST be consolidated into a single definition in `base.css`. Page-specific header tweaks remain in their respective view files.
- **FR-006**: The conflicting `#htmx-loading-bar` definitions MUST be resolved to a single consistent height value across the entire application (all occurrences use the same value)
- **FR-007**: The development server MUST support cache invalidation for `base.css` so developers see CSS changes without manual cache clearing (e.g., content hash, query parameter, or dev-mode `Cache-Control: no-cache`)
- **FR-008**: The CSS extraction MUST NOT change the visual appearance of any page — the rendered result must be pixel-identical to the pre-extraction state

### Key Entities

- **base.css**: The single static CSS file containing all shared foundation styles for the application. Served from a well-known path. Not a database entity — a file in the source tree.
- **HTMX_HEAD template literal**: The existing template literal in `src/views/shared.ts` that currently inlines all shared CSS. After extraction, it becomes a `<link>` tag.
- **View files**: The 5 view files (likely `src/views/shared.ts`, `src/views/home.ts`, `src/views/mission.ts`, `src/views/onboarding.ts`, `src/views/lesson.ts`, and potentially others) that contain page-specific `<style>` blocks with rules to be deduplicated.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The HTML payload of every page is reduced by at least 4,000 bytes (the approximate size of the inlined `HTMX_HEAD` CSS block) compared to the pre-extraction baseline
- **SC-002**: After the first page load, subsequent page navigations within the same session serve `base.css` from the browser cache (zero network bytes for CSS on repeat visits)
- **SC-003**: Every duplicate style definition (`.header`, `.chat-messages`, etc.) exists in exactly one place — either in `base.css` (shared) or in a single view file (page-specific) — never in multiple files
- **SC-004**: The conflicting `#htmx-loading-bar` values are resolved to a single consistent value across all pages — no page shows a different loading bar height than any other
- **SC-005**: No visual regression: all pages render identically before and after the extraction when compared side-by-side

## Assumptions

- All 5 view files with inline CSS are under `src/views/` and can be identified by examining which files import or use the `HTMX_HEAD` template
- The existing server framework supports static file serving (Hono's `serveStatic` or a custom route for `base.css`)
- The conflicting `#htmx-loading-bar` height values (2.5px vs 3px) are unintentional inconsistencies; the chosen value will be documented in the plan
- Page-specific `<style>` blocks are small relative to `HTMX_HEAD` and contain genuinely unique rules
- No external CSS preprocessor or build step is needed — `base.css` is plain CSS served directly
- The application's existing deployment pipeline (Docker Compose) will include `base.css` in the container image
