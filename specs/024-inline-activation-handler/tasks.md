# Tasks: Inline Activation Handler

**Input**: Design documents from `specs/024-inline-activation-handler/`

**Prerequisites**: plan.md (required), spec.md (required)

**Organization**: Single-story implementation — one phase of sequential code changes plus cleanup.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Phase 1: Implementation

**Purpose**: Inline `handleActivation()` at all 5 call sites, remove imports, delete the module.

**Note**: All tasks in this phase are sequential — each inline replacement touches a different file, but they must be done before cleanup tasks can proceed.

### Inline call sites in `src/routes/missions.ts`

- [ ] T001 [US1] Replace `handleActivation()` call at line 97 in `src/routes/missions.ts` with inline code:
  - Replace `const activated = await handleActivation(result, missionId, missionChatService, c); if (activated) return activated;` with:
    ```typescript
    if (result.didActivate) {
      await missionChatService.generateTitle(missionId);
      c.header("HX-Redirect", `/missions/${missionId}`);
      return c.body(null);
    }
    ```

- [ ] T002 [US1] Replace `handleActivation()` call at line 343 in `src/routes/missions.ts` with the same inline code pattern

- [ ] T003 [US1] Remove `import { handleActivation } from "../shared/activate-mission.js";` from line 15 of `src/routes/missions.ts`

### Inline call sites in `src/routes/onboarding.ts`

- [ ] T004 [US1] Replace `handleActivation()` call at line 39 in `src/routes/onboarding.ts` with inline code (same pattern as T001)

- [ ] T005 [US1] Replace `handleActivation()` call at line 94 in `src/routes/onboarding.ts` with inline code (same pattern as T001)

- [ ] T006 [US1] Replace `handleActivation()` call at line 140 in `src/routes/onboarding.ts` with inline code (same pattern as T001)

- [ ] T007 [US1] Remove `import { handleActivation } from "../shared/activate-mission.js";` from line 7 of `src/routes/onboarding.ts`

### Delete module and verify

- [ ] T008 Delete `src/shared/activate-mission.ts`

- [ ] T009 [P] Verify no remaining references to `handleActivation` or `activate-mission` across the codebase:
  ```bash
  grep -r "activate-mission" src/ --include='*.ts' || echo "No references found - clean"
  grep -r "handleActivation" src/ --include='*.ts' || echo "No references found - clean"
  ```

- [ ] T010 Run full test suite: `npm test` — all tests must pass without modification

---

## Dependencies & Execution Order

### Task Dependencies

- **T002** depends on T001 (same file, avoid merge conflicts if done by single implementer)
- **T003** depends on T002 (same file)
- **T005** depends on T004 (same file)
- **T006** depends on T005 (same file)
- **T007** depends on T006 (same file)
- **T008** depends on T003, T007 (must remove imports before deleting the file)
- **T009** depends on T008 (final check)
- **T010** depends on T009 (only test after everything else is done)

### Parallel Opportunities

- T001 and T004 can be done in parallel (different files)
- T002 and T005 can be done in parallel (different files)
- T003 and T007 can be done in parallel (different files)
- T009 is inherently parallelizable (two greps)

---

## Implementation Strategy

### Single Pass

1. Open `src/routes/missions.ts`: inline T001, T002, remove import T003
2. Open `src/routes/onboarding.ts`: inline T004, T005, T006, remove import T007
3. Delete the module (T008)
4. Verify (T009) and test (T010)

This is a straightforward mechanical refactoring with no branching logic or decision points.

---

## Notes

- The inline code at each of the 5 sites is identical — no customization needed.
- No new files, imports, or dependencies are created.
- The `handleActivation` function is only used at these 5 sites; no other files import it.
- After inlining, `missionChatService` remains in scope at every call site (already referenced directly above or below each call).
- `c` (Hono Context) is available at every site as a method parameter.
- `missionId` is already a local variable at every site.
