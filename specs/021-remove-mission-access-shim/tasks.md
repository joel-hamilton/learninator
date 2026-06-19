# Tasks: Remove Mission Access Pass-Through

**Input**: Design documents from `specs/021-remove-mission-access-shim/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: No new tests required. All existing tests pass without modification. The quickstart.md validation scenarios confirm behavioral preservation.

**Organization**: Tasks are grouped by user story. US1 (Direct Validation Inline) and US2 (NaN Guard Preservation) are both P1 and are tightly coupled — they are combined into one phase. US3 (Reduced Codebase Surface) is P2 and depends on US1+US2 completion.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `specs/` at repository root
- Paths shown below assume the project structure from plan.md

---

## Phase 1: Setup

**Purpose**: Confirm baseline before starting the refactoring

- [X] T001 Run `npm test` to confirm all tests pass before any changes
- [X] T002 [P] Confirm the full list of call sites via `grep -rn "requireMissionAccess\|require-mission-access" src/ --include='*.ts'` to validate research findings (26 sites across 6 files)

---

## Phase 2: User Story 1+2 — Direct Validation Inline + NaN Guard Preservation (Priority: P1) -- MVP

**Goal**: Remove all calls to `requireMissionAccess(store, missionId, user.id)` in route files and replace them with inline NaN guard followed by direct `store.getMission(missionId, user.id)` call, preserving identical 404 behavior.

**Independent Test**: No file imports `requireMissionAccess` from `src/shared/`. All route files have inline guard and direct store call. Sending a request with non-numeric mission ID (e.g., `/missions/abc/lessons`) returns 404.

### Implementation for User Story 1+2

All 6 route files can be modified in parallel since they are independent files. Each file requires:
1. Remove the `import { requireMissionAccess } from "../shared/require-mission-access"` line
2. At each call site, replace `const mission = await requireMissionAccess(store, missionId, user.id)` with:
   ```ts
   if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
   const mission = await store.getMission(missionId, user.id);
   ```

- [X] T003 [P] [US1] Inline NaN guard and store.getMission at 7 call sites in `src/routes/missions.ts`
- [X] T004 [P] [US1] Inline NaN guard and store.getMission at 6 call sites in `src/routes/lessons.ts`
- [X] T005 [P] [US1] Inline NaN guard and store.getMission at 4 call sites in `src/routes/onboarding.ts`
- [X] T006 [P] [US1] Inline NaN guard and store.getMission at 4 call sites in `src/routes/mission-tabs.ts`
- [X] T007 [P] [US1] Inline NaN guard and store.getMission at 4 call sites in `src/routes/lesson-generation.ts`
- [X] T008 [P] [US1] Inline NaN guard and store.getMission at 1 call site in `src/routes/chat.ts`

**Checkpoint**: At this point US1 and US2 are complete -- all 26 call sites use inline guards and direct store calls. The module still exists but is no longer imported by any route.

---

## Phase 3: User Story 3 — Reduced Codebase Surface (Priority: P2)

**Goal**: Delete the module file and its test file, removing all traces of the pass-through from the codebase.

**Independent Test**: `src/shared/require-mission-access.ts` and `src/shared/require-mission-access.test.ts` do not exist. `grep -rn "requireMissionAccess" src/` returns zero matches.

### Implementation for User Story 3

- [X] T009 [US3] Delete `src/shared/require-mission-access.ts` module file (16 lines)
- [X] T010 [P] [US3] Delete `src/shared/require-mission-access.test.ts` test file (67 lines)
- [X] T011 [US3] Verify zero remaining imports via `grep -rn "requireMissionAccess\|require-mission-access" src/ --include='*.ts'` -- confirm no output

**Checkpoint**: The pass-through module is fully removed from the codebase.

---

## Phase 4: Validation

**Purpose**: Verify the refactoring introduced no behavioral changes and the codebase is clean.

- [X] T012 Run `npx tsc --noEmit` to confirm clean TypeScript compilation
- [X] T013 Run `npm test` to confirm all existing tests pass without modification
- [X] T014 [P] Verify net line reduction via `git diff --stat` (expected ~75 lines net removal)
- [X] T015 [P] Confirm `test ! -f src/shared/require-mission-access.ts && test ! -f src/shared/require-mission-access.test.ts`
- [X] T016 [P] Confirm NaN guard behavior: send requests with non-numeric and negative mission IDs, verify 404 response

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- can start immediately
- **User Story 1+2 (Phase 2)**: Depends on Setup completion -- no cross-story dependencies
- **User Story 3 (Phase 3)**: Depends on Phase 2 completion (cannot delete the module while imports still exist)
- **Validation (Phase 4)**: Depends on Phase 3 completion

### User Story Dependencies

- **User Story 1+2 (P1)**: Can start after Setup -- no dependencies on other stories. All 6 route file tasks are parallel.
- **User Story 3 (P2)**: Depends on US1+US2 completion -- the module cannot be deleted until no file imports it.

### Within Each Phase

- Phase 1 tasks are sequential (test first, then confirm findings)
- Phase 2 tasks are all [P] -- each modifies a different file with no shared state
- Phase 3: T010 can run in parallel with T009 (both are file deletions), but T011 requires T009 to be complete
- Phase 4: T012 and T013 are sequential (compile first, then test). T014/T015/T016 are [P].

### Parallel Opportunities

- **Phase 2**: All 6 route files can be modified simultaneously by different developers
- **Phase 3**: File deletions can happen in parallel
- **Phase 4**: Verification checks are independent

---

## Parallel Example: Phase 2 (User Story 1+2)

```bash
# All 6 route files can be edited in parallel:
Task: "Inline NaN guard at 7 sites in src/routes/missions.ts"
Task: "Inline NaN guard at 6 sites in src/routes/lessons.ts"
Task: "Inline NaN guard at 4 sites in src/routes/onboarding.ts"
Task: "Inline NaN guard at 4 sites in src/routes/mission-tabs.ts"
Task: "Inline NaN guard at 4 sites in src/routes/lesson-generation.ts"
Task: "Inline NaN guard at 1 site in src/routes/chat.ts"
```

---

## Implementation Strategy

### MVP (Phase 2 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Inline NaN guard at all 26 call sites (can parallelize by file)
3. **STOP and VALIDATE**: Confirm no file imports `requireMissionAccess`, TypeScript compiles, tests pass
4. The MVP delivers all P1 value -- routes are self-documenting about their access validation

### Full Delivery

1. Complete MVP (Phase 1 + Phase 2)
2. Add Phase 3: Delete module and test files
3. Add Phase 4: Full validation run

### Parallel Team Strategy

With multiple developers:
1. Developer A: `src/routes/missions.ts` (7 sites)
2. Developer B: `src/routes/lessons.ts` (6 sites)
3. Developer C: `src/routes/onboarding.ts` + `src/routes/chat.ts` (4 + 1 sites)
4. Developer D: `src/routes/mission-tabs.ts` + `src/routes/lesson-generation.ts` (4 + 4 sites)
5. Any developer: Phase 3 (file deletions) + Phase 4 (validation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new tests are written -- existing integration tests cover the NaN guard behavior end-to-end via `app.request()`
- The canonical inline pattern is documented in `plan.md` Phase 1 Design section
- US2 (NaN guard preservation) is inherently delivered by US1 -- the guard is part of the inline pattern at every site
- Commit after each file or logical group of files to keep changes granular
- Run `npm test` after each file change to catch regressions early
