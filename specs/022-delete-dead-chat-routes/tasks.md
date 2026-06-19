---

description: "Implementation tasks for deleting the dead chatRoutes module"

---

# Tasks: Delete Dead ChatRoutes Module

**Input**: Design documents from `specs/022-delete-dead-chat-routes/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: No new tests are required. The spec requires all existing tests to pass without modification after deletion.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- Paths shown assume single project per plan.md structure

---

## Phase 1: User Story 2 - No Unique Logic Lost (Priority: P1)

**Goal**: Verify the dead file has no unique logic before deletion, ensuring no functionality is accidentally removed.

**Independent Test**: Diff the dead file against the real handler at `src/routes/missions.ts:311-360` — confirm no code paths, error handling, or behavior in the dead file is missing from the real handler. If any unique logic exists, assess and either incorporate into the real handler or document as obsolete.

- [x] T001 [P] [US2] Confirm `src/routes/chat.ts` is not imported anywhere by running `grep -rn "chatRoutes" src/ --include='*.ts'` and `grep -rn "from.*routes/chat" src/ --include='*.ts'` — verify the only output is the definition in `src/routes/chat.ts` itself
- [x] T002 [P] [US2] Diff the dead file (`src/routes/chat.ts`) against the real handler (`src/routes/missions.ts:311-360`) to confirm no unique logic exists — reference the comparison table in `specs/022-delete-dead-chat-routes/plan.md` (Phase 0)

**Checkpoint**: US2 complete — the dead file is confirmed safe to delete with no unique functionality lost.

---

## Phase 2: User Story 1 - Dead Code Removal (Priority: P1)

**Goal**: Delete the unused `src/routes/chat.ts` file and verify the codebase remains healthy.

**Independent Test**: Run `npm test` (exit 0), `npx tsc --noEmit` (exit 0), and `grep -rn "chatRoutes" src/ --include='*.ts'` (no output after deletion).

- [x] T003 [US1] Delete `src/routes/chat.ts` — the 60-line Hono router that exports `chatRoutes` and is never imported or mounted anywhere in the codebase
- [x] T004 [P] [US1] Verify TypeScript compilation by running `npx tsc --noEmit` — must exit with code 0 and report zero errors
- [x] T005 [P] [US1] Verify test suite by running `npm test` — must exit with code 0 (all existing tests pass without modification)
- [x] T006 [US1] Confirm no remaining references by running `grep -rn "chatRoutes" src/ --include='*.ts'` — must produce no output, confirming the identifier is fully removed from the codebase

**Checkpoint**: US1 complete — the dead file is deleted, all tests pass, TypeScript compiles clean, and no references to `chatRoutes` remain.

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and final validation.

- [x] T007 Update `specs/022-delete-dead-chat-routes/spec.md` status from "Draft" to "Complete" after successful validation
- [x] T008 Run `specs/022-delete-dead-chat-routes/quickstart.md` validation steps end-to-end to confirm all success criteria are met

---

## Dependencies & Execution Order

### Phase Dependencies

- **US2 (Phase 1)**: No dependencies — can start immediately
- **US1 (Phase 2)**: Depends on US2 completion — must verify no unique logic before deletion
- **Polish (Phase 3)**: Depends on US1 completion

### User Story Dependencies

- **User Story 2 (P1)**: Verification phase — MUST complete before US1 (deletion)
- **User Story 1 (P1)**: Depends on US2 — the actual deletion and validation

### Within Each User Story

- US2 tasks T001 and T002 are parallel ([P]) — run grep and diff independently
- US1 tasks T004 and T005 are parallel ([P]) — TypeScript check and test suite can run independently after deletion
- T003 (deletion) must complete before T004, T005, T006
- T006 (final grep) should run after T004/T005 as final confirmation

### Parallel Opportunities

- T001 and T002 (US2 verification tasks) can run in parallel
- T004 and T005 (US1 validation tasks) can run in parallel after T003

---

## Parallel Example: User Story 2

```bash
# Run pre-deletion verification in parallel:
Task: "grep -rn 'chatRoutes' src/ --include='*.ts' && grep -rn 'from.*routes/chat' src/ --include='*.ts'"
Task: "Diff dead file vs real handler (reference plan.md comparison table)"
```

## Parallel Example: User Story 1

```bash
# After deletion, run validation in parallel:
Task: "npx tsc --noEmit"
Task: "npm test"
Task: "grep -rn 'chatRoutes' src/ --include='*.ts'"
```

---

## Implementation Strategy

### MVP (Full Feature — Single Sprint)

This feature is a single-file deletion with two pre-checks. The entire feature is the MVP:

1. Complete Phase 1: US2 verification (T001, T002) — confirm no unique logic lost
2. Complete Phase 2: US1 deletion (T003) + validation (T004, T005, T006)
3. Complete Phase 3: Polish (T007, T008)
4. **STOP and VALIDATE**: All success criteria from spec.md must pass

### Incremental Delivery

1. US2 verification → confirmation safe to delete
2. US1 deletion + validation → feature complete
3. Polish → documentation finalization

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No other files beyond `src/routes/chat.ts` are modified — see spec.md FR-002
- All existing tests must pass without modification — see spec.md FR-003
- The dead file's comparison table in plan.md Phase 0 confirms zero unique logic to preserve
- Commit after each logical group (US2 complete, US1 complete)
