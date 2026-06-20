---

description: "Tasks for extracting shared CSS from views"
---

# Tasks: Extract Shared CSS from Views

**Input**: Design documents from `specs/028-extract-shared-css/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/static-file-serving.md

**Tests**: No test tasks are needed. Existing tests pass unchanged. A visual validation checklist is provided in Phase 5.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- All CSS extraction paths are under `src/views/` and `src/index.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create `base.css` and set up static file serving route

- [ ] T001 Create `src/views/base.css` by extracting the content of the inline `<style>` block from `HTMX_HEAD` in `src/views/shared.ts` (lines 52-584), writing only the pure CSS (no `<style>` tags). Preserve all CSS exactly as-is, including Design Tokens (`:root`), Reset, Scrollbar, Loading Bar, Spinner, Thinking Dots, Animations, Staggered Entrance, SVG Icon, Badges, Buttons, Forms, Chat Messages, Chat Form, Section Label, Section Header, Markdown Body, User Menu, Modal, Workflow Indicator, Chat Progress, Generation Progress, and Activation Progress sections. Keep the original CSS comments (`/* ── ... ── */`) as-is.
- [ ] T002 [P] Add static file serving route in `src/index.ts` for `/static/base.css` that reads `src/views/base.css` and serves it with `Content-Type: text/css`. Include path traversal protection (regex check `/^[\w.-]+\.css$/`). Use `fs.readFileSync` for simplicity since the file is read on every request (acceptable for a small CSS file). The route must be registered early in the middleware chain (before auth middleware) so the CSS file is accessible without authentication.
- [ ] T003 [P] Update `CLAUDE.md` to add a note under the "Project structure" section about `src/views/base.css` as the shared CSS file location, so future developers know where to add new shared styles.

---

## Phase 2: User Story 1 — Developer can load any page without inline CSS duplication (Priority: P1)

**Goal**: Every page loads shared CSS from an external `<link>` tag instead of an inline `<style>` block.

**Independent Test**: Load any page and verify via DevTools that:
1. A `<link rel="stylesheet" href="/static/base.css">` tag exists in `<head>`
2. No inline `<style>` block contains the shared foundation CSS (reset, tokens, buttons, chat messages, modals, etc.)

### Implementation for User Story 1

- [ ] T004 [US1] Modify the `HTMX_HEAD` template literal in `src/views/shared.ts`: replace the entire `<style>...</style>` block (lines 52-584) with a single `<link rel="stylesheet" href="/static/base.css">` tag. Keep the htmx `<script>` tag and the Google Fonts `<link>` tags (preconnect + stylesheet) unchanged. The resulting `HTMX_HEAD` should look like:
  ```html
  <script src="https://unpkg.com/htmx.org@2.0.10"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/base.css">
  ```
- [ ] T005 [US1] Run the dev server (`npm run dev`) and load each HTMX_HEAD-using page (home, login, signup, mission, lesson, onboarding, settings, browse). Verify via browser DevTools that:
  - The page renders with full styling (no broken layout)
  - The `<link rel="stylesheet" href="/static/base.css">` tag is present in `<head>`
  - The `/static/base.css` request returns status 200 with `Content-Type: text/css`
- [ ] T006 [US1] Run `npm test` to confirm all existing tests pass. The tests use `app.request()` which returns HTML — verify no test fails due to the missing inline CSS (the `base.css` file is not loaded by `app.request()`, but the pages should still render without errors since CSS is not critical for test assertions).

**Checkpoint**: CSS is now served from an external file. All pages render correctly. All tests pass.

---

## Phase 3: User Story 2 — Developer can edit shared styles in one place (Priority: P1)

**Goal**: CSS classes shared across multiple pages (`.header`, `.chat-messages`, etc.) are defined only in `base.css`. Page-specific overrides remain in the view file's `<style>` block.

**Independent Test**: Make a change to `.header` in `base.css` and verify all pages using that class reflect the change. Verify no `.header` definition exists in any view file's `<style>` block.

### Implementation for User Story 2

- [ ] T007 [P] [US2] Audit `src/views/auth.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only auth-page-specific styles (login/signup form positioning, auth-specific layout). Read the file, identify dupes, and edit.
- [ ] T008 [P] [US2] Audit `src/views/home.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only home/dashboard-specific styles.
- [ ] T009 [P] [US2] Audit `src/views/mission.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only mission-specific styles.
- [ ] T010 [P] [US2] Audit `src/views/lesson.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only lesson-specific styles.
- [ ] T011 [P] [US2] Audit `src/views/onboarding.ts` `<style>` blocks (3 blocks total): review each CSS rule in each block and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only onboarding-specific styles.
- [ ] T012 [P] [US2] Audit `src/views/browse.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only browse-specific styles.
- [ ] T013 [P] [US2] Audit `src/views/profile.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only profile-specific styles.
- [ ] T014 [P] [US2] Audit `src/views/settings.ts` `<style>` block: review each CSS rule and identify any that duplicate rules now in `base.css`. Remove duplicated rules. Keep only settings-specific styles.
- [ ] T015 [US2] Run `npm test` to confirm all existing tests pass after the CSS deduplication in all view files.
- [ ] T016 [US2] Load all pages in the browser and visually verify no styling regressions. Pay special attention to: `.header` appearance, `.chat-messages` layout, button styles, badge appearance, modal rendering, and markdown content styling on every page.

**Checkpoint**: All shared CSS is in `base.css`. Each view file contains only page-specific styles. All pages render correctly.

---

## Phase 4: User Story 3 — Developer can add page-specific style overrides without touching base.css (Priority: P2)

**Goal**: The loading bar height conflict is resolved. Page-specific `<style>` blocks work correctly alongside `base.css`.

**Independent Test**: Add a page-specific override in any view file's `<style>` block and verify it takes effect while `base.css` shared styles still apply.

### Implementation for User Story 3

- [ ] T017 [US3] Fix the `#htmx-loading-bar` height conflict: In `src/views/onboarding.ts`, find the inline `style="...height:3px..."` attribute on the loading bar element and remove the `height:3px` inline style. The loading bar will then inherit the `height: 2.5px` from the shared CSS rule in `base.css`. Ensure the loading bar still appears and functions correctly on onboarding pages.
- [ ] T018 [US3] Verify the `HTMX_LOADING_BAR` constant in `src/views/shared.ts` still produces the correct HTML element: `<div id="htmx-loading-bar" class="htmx-indicator"></div>`. No changes needed here since the height is now controlled by CSS in `base.css`, not inline styles.
- [ ] T019 [US3] Run `npm test` and visually verify onboarding flow (guided questions, loading bar appearance during htmx requests) to confirm the loading bar works correctly.

**Checkpoint**: Loading bar height is consistent across all pages. Page-specific overrides work correctly alongside the shared foundation.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Caching configuration, production readiness, and final validation

- [ ] T020 [P] Implement development-mode caching in the static file serving route in `src/index.ts`: when `NODE_ENV` is not `"production"`, set `Cache-Control: no-cache, must-revalidate` on `/static/base.css` responses so developers see CSS changes immediately on page reload.
- [ ] T021 Implement production-mode caching in the static file serving route in `src/index.ts`: when `NODE_ENV` is `"production"`, set `Cache-Control: public, max-age=31536000, immutable` on `/static/base.css` responses for maximum browser caching.
- [ ] T022 Run the complete quickstart.md validation checklist:
  1. Verify `/static/base.css` loads with correct headers (Content-Type, Cache-Control per environment)
  2. Verify every page's HTML has the `<link>` tag and no inline shared CSS
  3. Verify visual appearance matches pre-extraction state (all pages)
  4. Verify loading bar is consistently `2.5px` on all pages including onboarding
  5. Verify dev-mode cache control works (CSS changes appear on reload)
  6. Verify production caching headers are correct
- [ ] T023 Run `npm test` one final time to confirm zero regressions.

**Checkpoint**: Feature complete and validated. All tests pass. CSS extraction is production-ready.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 — External CSS loading (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US2 — Deduplication (Phase 3)**: Depends on Phase 2 — cannot deduplicate until `base.css` is being served
- **US3 — Loading bar fix (Phase 4)**: Depends on Phase 2 (page styles are working) — independent of Phase 3
- **Polish (Phase 5)**: Depends on Phases 2-4 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup (Phase 1). No dependencies on other stories.
- **User Story 2 (P1)**: Can start after US1. Each view file audit task [P] can run in parallel.
- **User Story 3 (P2)**: Can start after US1. Independent of US2 — can run in parallel with US2.

### Parallel Opportunities

- All [P] tasks in Phase 1 (T002, T003) can run in parallel
- All [P] tasks in Phase 3 (T007-T014) — each view file audit is independent
- US2 and US3 can proceed in parallel once US1 is complete
- Phase 5 T020 and T021 can run in parallel

### Parallel Example

```bash
# Phase 3 — Audit all view files in parallel:
Task: "Audit auth.ts CSS: T007"
Task: "Audit home.ts CSS: T008"
Task: "Audit mission.ts CSS: T009"
Task: "Audit lesson.ts CSS: T010"
Task: "Audit onboarding.ts CSS: T011"
Task: "Audit browse.ts CSS: T012"
Task: "Audit profile.ts CSS: T013"
Task: "Audit settings.ts CSS: T014"

# US2 and US3 — run in parallel:
Task: "CSS deduplication across all views: T007-T014, T015, T016"
Task: "Loading bar fix: T017, T018, T019"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — Create `base.css` and static file route
2. Complete Phase 2: User Story 1 — Switch to `<link>` tag
3. **STOP and VALIDATE**: All pages render correctly, all tests pass
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + US1 → External CSS loads (MVP!)
2. Add US2 → No duplicated CSS (core maintenance improvement)
3. Add US3 → Consistent loading bar (bug fix)
4. Add Polish → Production caching config

### Risks and Mitigations

- **Risk**: Missing a CSS rule during extraction, causing visual regression. **Mitigation**: T016 requires manual visual verification of every page.
- **Risk**: The `base.css` file path might differ in Docker/production. **Mitigation**: Use a path relative to the project root; verify in T022.
- **Risk**: htmx-loaded content might not apply external CSS. **Mitigation**: External stylesheets apply to dynamically loaded content in htmx — no special handling needed.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical group of tasks
- Stop at any checkpoint to validate story independently
