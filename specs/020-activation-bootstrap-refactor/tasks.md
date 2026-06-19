---

description: "Task list for Consolidate Activation Bootstrap feature"
---

# Tasks: Consolidate Activation Bootstrap

**Input**: Design documents from `specs/020-activation-bootstrap-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No new test tasks — this is a pure structural refactoring. Existing HTTP-level tests in `missions.test.ts`, `onboarding.test.ts`, and `chat.test.ts` serve as regression guards and MUST pass without modification.

**Organization**: Two user stories (both P1) are achieved by the same set of code changes — creating the shared helper and updating all five route handlers. They are grouped into a single phase.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- All paths are relative to `/Users/joel/Sites/learninator/`

---

## Phase 1: Setup

**Purpose**: Codebase familiarization — confirm the duplicated pattern and verify the starting state.

- [ ] T001 Review the 5 duplicated `didActivate` blocks across `src/routes/missions.ts` (lines 97, 340) and `src/routes/onboarding.ts` (lines 38, 95, 143), and verify the identical 3-line block matches the research findings

**Checkpoint**: Pattern confirmed. Ready to create the shared helper.

---

## Phase 2: User Story 1 & 2 — Consolidate Activation Bootstrap (Priority: P1)

**Goal**: Extract the 5 identical `didActivate` blocks into a single shared `handleActivation()` helper in `src/shared/activate-mission.ts`, and update all route handlers to delegate to it. This achieves:
- **US1**: Identical activation behavior across all five entry points (no behavioral regression)
- **US2**: A single point of change for any future post-activation logic

**Independent Test**: `npm test` passes with zero modifications to test files. `grep -rn "result.didActivate" src/routes/` returns zero matches.

- [ ] T002 Create `handleActivation()` function in `src/shared/activate-mission.ts` per the contract in `contracts/README.md`, importing only types (`Context` from `hono`, `AppVariables` from `src/types.js`, `MissionChatService` and `MissionChatResult` from `src/services/mission-chat.service.js`)
- [ ] T003 [P] [US1] [US2] Replace both `didActivate` blocks (lines 97 and 340) in `src/routes/missions.ts` with delegate calls to `handleActivation()`, importing the function from `../shared/activate-mission.js`
- [ ] T004 [P] [US1] [US2] Replace all three `didActivate` blocks (lines 38, 95, 143) in `src/routes/onboarding.ts` with delegate calls to `handleActivation()`, importing the function from `../shared/activate-mission.js`

**Checkpoint**: All five route handlers now delegate to the shared helper. Code compilation succeeds.

---

## Phase 3: Polish & Verification

**Purpose**: Confirm the refactor is clean — no behavioral regressions, no leftover duplication.

- [ ] T005 Run `npm test` to confirm all existing activation tests pass without modification
- [ ] T006 Run `grep -rn "result.didActivate" src/routes/` to confirm zero occurrences remain in route handler files

**Checkpoint**: Refactor complete and verified.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US1 & US2 (Phase 2)**: T003, T004 depend on T002 (helper must exist before routes can import it)
- **Polish (Phase 3)**: Depends on Phase 2 completion

### Within Phase 2

- T002 (create helper) MUST complete first
- T003 (missions.ts) and T004 (onboarding.ts) can run in parallel after T002 — they modify different files

### Parallel Opportunities

- T003 and T004 modify different files and have no dependency on each other, so they can be done in parallel after T002
- T005 and T006 can run in parallel after Phase 2

---

## Parallel Example: Phase 2

```bash
# Step 1: Create the shared helper (required before route updates)
Task: "Create handleActivation() in src/shared/activate-mission.ts"

# Step 2: Update both route files in parallel (different files, no cross-dependency)
Task: "Update missions.ts activation blocks"
Task: "Update onboarding.ts activation blocks"
```

---

## Implementation Strategy

### MVP (Single Pass — All of Phase 2)

Since both user stories are P1 and achieved by the same code changes:

1. Complete Phase 1: Setup (review existing pattern)
2. Complete Phase 2: Create helper + update all 5 handlers
3. Complete Phase 3: Verify with tests and grep
4. No iterative delivery needed — this is a ~15-line refactoring with zero behavioral change

### Verification Checklist

- [ ] `npm test` passes without modifying any test files
- [ ] `grep -rn "result.didActivate" src/routes/` returns zero matches
- [ ] Each modified route handler contains at most the 2-line delegation pattern:
  ```
  const activated = handleActivation(result, missionId, missionChatService, c);
  if (activated) return activated;
  ```
- [ ] The helper body in `src/shared/activate-mission.ts` contains exactly one call to `generateTitle`

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [US1], [US2] labels map tasks to both user stories (since the same code changes satisfy both)
- No new test files needed — existing HTTP-level tests serve as the regression suite
- No database migrations, no environment changes, no frontend changes
- The helper imports only types from `hono` and `services/mission-chat.service.js` — no runtime imports from routes or services, preventing circular dependencies
