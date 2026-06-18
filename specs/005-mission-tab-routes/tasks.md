# Tasks: Mission Tab Routes

**Input**: Design documents from `specs/005-mission-tab-routes/`

**Prerequisites**: plan.md, spec.md

**Tests**: Not requested in spec — implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation of each story.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Import the missing view function.

- [x] T001 Add `missionTabContent` to the import from `../views/mission.js` in `src/routes/missions.ts`

---

## Phase 2: User Story 1 — View mission overview (Priority: P1)

**Goal**: Clicking "Mission" tab shows MISSION.md content instead of 404.

**Independent Test**: Open any active/archived mission and click the "Mission" sidebar tab — the page renders the mission content or "No mission statement yet." message without a 404 error.

- [x] T002 [US1] Add GET `/missions/:missionId/mission` route handler in `src/routes/missions.ts` that fetches mission content and renders the mission tab

---

## Phase 3: User Story 2 — Refine the mission via AI (Priority: P1)

**Goal**: Submitting the refine form updates the mission content via AI and shows confirmation.

**Independent Test**: On the Mission tab, type a refinement request (e.g., "Make this more specific") and click Refine. The page updates with a confirmation or error.

- [x] T003 [US2] Add POST `/missions/:missionId/mission/refine` route handler in `src/routes/missions.ts` that accepts a refinement message and runs a conversation loop

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **User Story 1 (Phase 2)**: Depends on Phase 1
- **User Story 2 (Phase 3)**: Depends on Phase 1

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1
- **User Story 2 (P1)**: Can start after Phase 1

### Parallel Opportunities

- T002 and T003 can be implemented in parallel (same file but different routes — no conflicts)

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1: Add import
2. Complete Phase 2: GET route
3. Verify the Mission tab no longer returns 404
4. Complete Phase 3: POST route for refine
5. Verify end-to-end flow
