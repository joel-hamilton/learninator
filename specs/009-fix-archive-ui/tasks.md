# Tasks: Fix Archive UI

**Input**: Design documents from `/specs/009-fix-archive-ui/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The feature spec does not explicitly request new tests, but the project constitution requires HTTP-level integration tests. Existing tests in `src/test/missions.test.ts` should be updated to cover the new OOB swap behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- Routes: `src/routes/`
- Views: `src/views/`
- Tests: `src/test/`

---

## Phase 1: Setup

**Purpose**: Verify current state and prepare for changes

- [ ] T001 Verify existing archive/restore/delete behavior in browser and review current test coverage in `src/test/missions.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor home page rendering so both user stories can build on stable section containers

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Extract mission card render functions (`renderActiveCard`, `renderArchivedCard`) and section assembly logic into a reusable helper in `src/routes/home.ts` — export `renderMissionSections(userId, store)` that returns `{ activeSectionHtml, archivedSectionHtml }` and add persistent `id="active-section"` and `id="archived-section"` containers (always rendered, even when empty)
- [ ] T003 Add `<details>` wrapper around the archived section in `src/routes/home.ts` with a `<summary>` header showing "Archived (N)" count, closed by default (no `open` attribute)

**Checkpoint**: Home page renders with stable `#active-section` and `#archived-section` containers. Archived section is wrapped in a collapsed `<details>` element. All existing tests pass.

---

## Phase 3: User Story 1 - Archive Moves Mission Immediately (Priority: P1) 🎯 MVP

**Goal**: When a user archives, restores, or deletes a mission, the card is removed from its current section AND the opposite section is immediately updated via HTMX out-of-band swaps — no page reload needed.

**Independent Test**: Archive a mission from the dashboard and verify the card appears in the archived section without page reload. Restore a mission and verify it moves back. Delete a mission and verify the archived section updates.

### Implementation for User Story 1

- [ ] T004 [US1] Create a shared section-render helper `renderOobSections(userId, store)` in `src/routes/home.ts` that queries missions, renders both `#active-section` and `#archived-section` divs with `hx-swap-oob="innerHTML:#active-section"` and `hx-swap-oob="innerHTML:#archived-section"` attributes, handling the empty state for each
- [ ] T005 [US1] Modify archive endpoint POST `/missions/:missionId/archive` in `src/routes/missions.ts` to call `renderOobSections()` after `updateMissionStatus()` and return the OOB HTML instead of empty string
- [ ] T006 [US1] Modify restore endpoint POST `/missions/:missionId/restore` in `src/routes/missions.ts` to call `renderOobSections()` after `updateMissionStatus()` and return the OOB HTML instead of empty string
- [ ] T007 [US1] Modify delete endpoint POST `/missions/:missionId/delete` in `src/routes/missions.ts` to call `renderOobSections()` after `deleteMission()` and return the OOB HTML instead of empty string
- [ ] T008 [US1] Add/update tests in `src/test/missions.test.ts` for archive returning OOB swaps that populate `#archived-section`, restore returning OOB swaps for both sections, delete returning updated `#archived-section`, and edge cases (first archive, last restore, last delete)

**Checkpoint**: Archive, restore, and delete all update both sections immediately. All tests pass.

---

## Phase 4: User Story 2 - Collapsible Archived Section (Priority: P2)

**Goal**: The archived section is collapsed by default on page load. Users click the "Archived (N)" header to expand and see archived missions. Clicking again collapses it.

**Independent Test**: Load dashboard with archived missions, verify cards are hidden, click header to expand, click again to collapse.

### Implementation for User Story 2

- [ ] T009 [US2] Add CSS in `src/views/home.ts` for the `<details>` archived section: hide default disclosure triangle (`list-style: none`, `::-webkit-details-marker`), style the `<summary>` as a clickable header matching `.section-label` design, add chevron rotation transition on `[open]`
- [ ] T010 [US2] Verify chevron icon exists in `src/views/shared.ts` (check for `chevronDown` or similar); add if missing
- [ ] T011 [US2] Ensure the archived section count label in `<summary>` stays correct after OOB swaps — the count must reflect the actual number of archived missions after each archive/restore/delete operation
- [ ] T012 [US2] Add/update tests in `src/test/missions.test.ts` to verify the `<details>` element is present (without `open` attribute) in the home page response when archived missions exist, and absent or empty `#archived-section` when none exist

**Checkpoint**: Archived section is collapsed by default, expands/collapses on click, count stays accurate across archive/restore/delete operations.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T013 Run `quickstart.md` validation scenarios manually
- [ ] T014 [P] Run full test suite `npm test` and fix any regressions
- [ ] T015 [P] Review error handling: verify 404/400 responses from archive/restore/delete endpoints are still `c.text()` (not HTML) so HTMX doesn't swap on errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — independent of US1, can run in parallel
- **Polish (Phase 5)**: Depends on US1 and US2 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on US2
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - The `<details>` shell is in Phase 2 (T003); US2 adds the CSS styling and count verification. Independent of US1's endpoint changes.

### Within Each User Story

- US1: T004 (helper) → T005, T006, T007 (endpoints, parallelizable) → T008 (tests)
- US2: T009 (CSS) and T010 (icon check) can run in parallel → T011 (count fix) → T012 (tests)

### Parallel Opportunities

- T005, T006, T007 can be implemented in parallel (three endpoints, same pattern)
- T009 and T010 can run in parallel
- US1 and US2 can be worked on in parallel after Phase 2 completes
- T014 and T015 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After T004 (shared helper) is complete, launch all three endpoint changes together:
Task: "Modify archive endpoint in src/routes/missions.ts"
Task: "Modify restore endpoint in src/routes/missions.ts"
Task: "Modify delete endpoint in src/routes/missions.ts"

# Then run tests
Task: "Add/update tests in src/test/missions.test.ts"
```

## Parallel Example: User Story 2

```bash
# CSS and icon check can run in parallel:
Task: "Add CSS for <details> archived section in src/views/home.ts"
Task: "Verify/add chevron icon in src/views/shared.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003)
3. Complete Phase 3: User Story 1 (T004-T008)
4. **STOP and VALIDATE**: Archive, restore, and delete a mission — both sections update immediately
5. Ship the bug fix

### Incremental Delivery

1. Complete Setup + Foundational → Page has stable containers + collapsed archived section
2. Add User Story 1 → Archive/restore/delete work without page reload **(MVP!)**
3. Add User Story 2 → Polish the collapsed section styling → Full feature complete
4. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No schema changes needed — `missions.status` already supports `"archived"`
- The `hx-swap-oob` approach requires `innerHTML` swap style to preserve container `id` attributes across swaps
