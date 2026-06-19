# Tasks: Fix UI Bugs

**Input**: Design documents from `specs/010-fix-ui-bugs/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Not requested — visual verification via browser per quickstart.md.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths in descriptions

## Path Conventions

- All changes in `src/views/` — server-rendered HTML templates with inline `<style>` and `<script>`
- `src/views/shared.ts` — global design tokens (`:root` block), shared component styles, SVG icons, JS helpers
- `src/views/mission.ts` — mission detail page with sidebar layout
- `src/views/lesson.ts` — lesson page with FAB and chat panel
- `src/views/home.ts` — dashboard layout
- `src/views/onboarding.ts` — mission creation chat
- `src/views/browse.ts` — topic browse page
- `src/views/auth.ts` — login/signup pages

---

## Phase 1: Foundational — Define Missing Design Tokens

**Purpose**: Define all CSS custom properties used across views that are currently undefined. These tokens are dependencies for US3 (FAB) and US4 (audit fixes).

**⚠️**: US1 and US2 can proceed in parallel with this phase since they don't depend on new tokens.

- [ ] T001 Define `--accent`, `--accent-hover`, `--accent-light`, `--accent-ghost` in `:root` block in `src/views/shared.ts` (values: `#4f46e5`, `#4338ca`, `#eef2ff`, `#f5f3ff` respectively)
- [ ] T002 [P] Define `--border` as alias for `var(--rule)` in `:root` block in `src/views/shared.ts`
- [ ] T003 [P] Define `--text-muted` as alias for `var(--ink-muted)`, `--text` as alias for `var(--ink)`, `--text-secondary` as alias for `var(--ink-secondary)`, `--primary-light` as alias for `var(--accent-light)` in `:root` block in `src/views/shared.ts`

**Checkpoint**: All CSS custom properties referenced across views now resolve to actual values.

---

## Phase 2: User Story 1 — Collapse and Re-open Sidebar (Priority: P1) 🎯 MVP

**Goal**: Sidebar toggle button is fully visible and functional at all viewport widths in both collapsed and expanded states.

**Independent Test**: Open any mission page, click toggle → sidebar collapses, toggle stays visible. Click again → sidebar re-opens. Repeat at 375px, 768px, 1024px, 1440px.

### Implementation for User Story 1

- [ ] T004 [US1] Move `.sidebar-toggle` button HTML from inside `<aside class="sidebar">` to a sibling element (direct child of `.layout`) in `src/views/mission.ts` — update the `missionLayout()` function
- [ ] T005 [US1] Update `.sidebar-toggle` CSS positioning in `src/views/mission.ts`: remove `position: absolute` and `right` offsets; instead position relative to `.layout` so it sits at the boundary between sidebar and main content; ensure it remains visible when sidebar is collapsed (`overflow: hidden` no longer affects it)
- [ ] T006 [US1] Update sidebar collapse media query CSS in `src/views/mission.ts`: remove the `right: -28px` mobile override since positioning is now relative to `.layout`; ensure toggle is accessible at ≤768px
- [ ] T007 [US1] Update sidebar toggle JavaScript in `src/views/mission.ts`: verify toggle click handler still correctly toggles `sidebar-collapsed` and `sidebar-open` classes after HTML restructuring
- [ ] T008 [US1] Ensure sidebar collapse state persists across htmx tab navigation — add `hx-preserve` or equivalent to sidebar state; or verify that htmx swaps on `.main` only don't reset the sidebar

**Checkpoint**: Sidebar toggle works reliably — collapse and re-open tested at 375px, 768px, 1024px, 1440px.

---

## Phase 3: User Story 2 — Chat Messages Stay Within Viewport (Priority: P2)

**Goal**: All chat message content (text, code blocks, unbroken strings) stays within the viewport without horizontal scrollbars.

**Independent Test**: Send a chat message with a 500-char unbroken string. Verify no horizontal scrollbar appears. Check mission chat and lesson chat panel at 375px width.

### Implementation for User Story 2

- [ ] T009 [US2] Add `overflow-wrap: break-word; word-break: break-word;` to `.msg` and standalone `.msg` variants in `src/views/shared.ts` (lines 213-240)
- [ ] T010 [US2] Add `min-width: 0` to `.msg-row` in `src/views/shared.ts` to prevent flex items from ignoring `max-width: 88%`
- [ ] T011 [P] [US2] Add `max-width: 100%` to `.markdown-body table`, `.markdown-body img`, `.markdown-body pre` within `.msg` context in `src/views/shared.ts` to prevent wide tables/code/images from overflowing message bubbles
- [ ] T012 [P] [US2] Add `overflow-x: auto` to `.chat-panel-messages` in `src/views/lesson.ts` as a safety net for the chat panel container
- [ ] T013 [P] [US2] Add `overflow-wrap: break-word` to `#chat-messages` in mission chat and onboarding chat styles in `src/views/mission.ts` and `src/views/onboarding.ts`

**Checkpoint**: Long unbroken strings wrap within message bubbles; no horizontal scrollbar on any page at ≥375px.

---

## Phase 4: User Story 3 — Chat FAB Has Visible Contrast (Priority: P3)

**Goal**: The lesson page floating action button shows a clearly visible icon with sufficient contrast against its background.

**Independent Test**: Open any lesson page; visually confirm the FAB in the bottom-right is a visible indigo circle with a white chat icon. Verify hover state works.

### Implementation for User Story 3

- [ ] T014 [US3] Verify `.fab` CSS in `src/views/lesson.ts` — after T001 defines `--accent`, the FAB should show `background: #4f46e5` with white icon. Test that `color: #fff` on `.fab` correctly propagates to the SVG icon via `currentColor`
- [ ] T015 [US3] If SVG icon does not inherit `color: #fff` from `.fab`, add explicit `.fab .svg-icon { color: #fff; }` rule in `src/views/lesson.ts`
- [ ] T016 [US3] Verify `.fab:hover` state in `src/views/lesson.ts` — background darkens to `--accent-hover`, cursor shows pointer, button scales to 1.05

**Checkpoint**: FAB is clearly visible (indigo circle, white icon); hover state provides clear visual feedback.

---

## Phase 5: User Story 4 — Audit Remaining UI Issues (Priority: P4)

**Goal**: Systematic review of all pages at all breakpoints; fix every visual defect found.

**Independent Test**: Run through every page (dashboard, mission tabs, lesson, browse, settings, auth) at 375px, 768px, 1024px, 1440px. Zero visual defects remain.

### Implementation for User Story 4

- [ ] T017 [US4] Audit all pages at 375px viewport — check for horizontal overflow, clipped elements, overlapping components, invisible controls. Document findings and fix each in the relevant view file (`src/views/*.ts`)
- [ ] T018 [P] [US4] Audit all pages at 768px viewport — same checks as T017
- [ ] T019 [P] [US4] Audit all pages at 1024px and 1440px viewports — same checks as T017
- [ ] T020 [US4] Replace any remaining `var(--border)` with `var(--rule)` or ensure token alias (T002) resolves correctly in `src/views/lesson.ts` and `src/views/mission.ts`
- [ ] T021 [US4] Verify all `.btn-accent` and other accent-dependent styles across `src/views/shared.ts`, `src/views/lesson.ts`, `src/views/mission.ts` render correctly after T001 token definitions
- [ ] T022 [US4] Test that no CSS custom property warnings appear in browser devtools console — all `var()` references resolve to defined tokens

**Checkpoint**: Zero visual defects at any supported viewport on any page.

---

## Phase 6: Polish & Verification

**Purpose**: Final integration verification across all fixes.

- [ ] T023 Run quickstart.md verification scenarios for all four user stories
- [ ] T024 Run `npm test` to confirm no existing tests regressed
- [ ] T025 [P] Test in Chrome, Firefox, and Safari at 375px and 1440px — confirm consistent rendering

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational tokens)**: No dependencies — can start immediately. Blocks US3 verification (T014).
- **Phase 2 (US1 - Sidebar)**: No dependencies — can start immediately. Independent of Phase 1.
- **Phase 3 (US2 - Overflow)**: No dependencies — can start immediately. T013 touches files shared with US1 but only adds CSS properties (no conflicts).
- **Phase 4 (US3 - FAB)**: Depends on Phase 1 (T001 must define `--accent`). Can otherwise proceed independently.
- **Phase 5 (US4 - Audit)**: Depends on Phase 1 tokens. Best performed after Phases 2-4 to verify fixes.
- **Phase 6 (Polish)**: Depends on all prior phases.

### User Story Dependencies

- **US1 (P1)**: Independent — no dependencies on other stories
- **US2 (P2)**: Independent — no dependencies on other stories
- **US3 (P3)**: Depends on Phase 1 tokens (T001)
- **US4 (P4)**: Depends on Phase 1 tokens; benefits from US1-US3 being complete

### Within Each User Story

- Core fix first → verification second
- CSS changes are mostly additive (add properties, don't remove) to minimize regression risk

### Parallel Opportunities

- Phase 1 tokens (T001, T002, T003) can all run in parallel (different `:root` properties)
- US1 (Phase 2) and US2 (Phase 3) can run in parallel (different files: mission.ts vs shared.ts+lesson.ts)
- US1 (Phase 2) and Phase 1 can run in parallel (no dependency between sidebar fix and token definitions)
- T017, T018, T019 (audit at different breakpoints) can run in parallel
- T025 (cross-browser test) can run in parallel with T023, T024

---

## Parallel Example: Foundational + US1 + US2

```bash
# Launch foundational tokens and independent stories together:
Task: "T001 Define --accent tokens in src/views/shared.ts"
Task: "T002 Define --border token in src/views/shared.ts"
Task: "T003 Define text token aliases in src/views/shared.ts"

# US1 (sidebar) — independent of tokens:
Task: "T004 Move sidebar-toggle HTML outside .sidebar in src/views/mission.ts"
# (T005-T008 follow sequentially within US1)

# US2 (overflow) — independent of tokens and US1:
Task: "T009 Add overflow-wrap to .msg in src/views/shared.ts"
Task: "T010 Add min-width:0 to .msg-row in src/views/shared.ts"
Task: "T011 Add max-width to markdown content in messages in src/views/shared.ts"
Task: "T012 Add overflow-x to chat-panel-messages in src/views/lesson.ts"
Task: "T013 Add overflow-wrap to #chat-messages in src/views/mission.ts and src/views/onboarding.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: User Story 1 (sidebar toggle)
2. **STOP and VALIDATE**: Test toggle at all breakpoints
3. Deploy — navigation is no longer broken

### Incremental Delivery

1. Phase 2: US1 (sidebar toggle) → Test → Deploy (MVP!)
2. Phase 3: US2 (chat overflow) → Test → Deploy (readable messages)
3. Phase 1 + Phase 4: US3 (FAB contrast) → Test → Deploy (visible chat button)
4. Phase 5: US4 (audit) → Test → Deploy (complete polish)
5. Phase 6: Final verification

### Single Developer Strategy

Recommended order: US1 → US2 → Foundational + US3 → US4 → Polish

- US1 first (most critical — broken navigation)
- US2 second (content readability)
- Foundational tokens then US3 (FAB depends on tokens)
- US4 last (catches everything else)
