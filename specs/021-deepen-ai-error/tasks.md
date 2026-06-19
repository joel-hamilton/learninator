---

description: "Task list for feature 021-deepen-ai-error — inline the format pass-through onto AIError"
---

# Tasks: Deepen AIError — inline the format pass-through

**Input**: Design documents from `specs/021-deepen-ai-error/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — test migration is explicitly required by FR-010 of the spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root — all changes are in the existing `src/` tree.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baseline and verify the starting state

- [ ] T001 Run `npm test` to confirm all existing tests pass before any changes

**Checkpoint**: Baseline confirmed — all tests pass before refactoring begins

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**No foundational tasks needed.** This feature is a pure mechanical refactoring with no new dependencies, no database changes, and no infrastructure changes. Move directly to User Story phases.

---

## Phase 3: User Story 1 — Add `toUserMessage()` to AIError (Priority: P1) MVP

**Goal**: Add a `toUserMessage(fallback?: string): string` method to the `AIError` class in `src/ai/errors.ts` so that the user-facing message logic lives on the error class itself.

**Independent Test**: A unit test can verify that `AIError.prototype.toUserMessage` exists, returns the message with the hint appended when `recoverable` is true, and returns the message alone when `recoverable` is false or undefined.

### Implementation for User Story 1

- [ ] T002 [US1] Add `toUserMessage(fallback?: string): string` method to AIError in `src/ai/errors.ts`. When `this.recoverable === true`, append `" It may help to wait a moment and retry."` to `this.message`. When `recoverable` is `false` or `undefined`, return `this.message` unchanged. The `fallback` parameter is accepted but unused (reserved for API consistency). Must never throw.

### Tests for User Story 1

- [ ] T003 [P] [US1] Create `src/ai/errors.test.ts` with tests for `AIError.prototype.toUserMessage`:
  - Non-recoverable AIError (recoverable=false or undefined) returns message only
  - Recoverable AIError (recoverable=true) returns message with appended hint
  - `fallback` parameter is accepted but does not change the return value
  - Method never throws on any AIError instance state

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. The new method exists and passes its tests, but no production code calls it yet.

---

## Phase 4: User Story 2 — Migrate existing call sites (Priority: P1)

**Goal**: All six production call sites switch from `formatAIError(err)` to the pattern `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`. Error messages remain byte-identical before and after.

**Independent Test**: All existing route tests pass without modification to test logic. Running `npm test` produces identical results.

### Implementation for User Story 2

All five migration tasks are parallelizable — each touches a different file.

- [ ] T004 [P] [US2] Migrate call site in `src/routes/browse.ts`: change import from `formatAIError` to `AIError` (from `../ai/errors.js`), replace `formatAIError(err)` with `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`
- [ ] T005 [P] [US2] Migrate call site in `src/routes/chat.ts`: change import from `formatAIError` to `AIError` (from `../ai/errors.js`), replace `formatAIError(err)` with `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`
- [ ] T006 [P] [US2] Migrate call site in `src/routes/lessons.ts`: change import from `formatAIError` to `AIError` (from `../ai/errors.js`), replace `formatAIError(err)` with `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`
- [ ] T007 [P] [US2] Migrate call site in `src/routes/missions.ts`: change import from `formatAIError` to `AIError` (from `../ai/errors.js`), replace `formatAIError(err)` with `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`
- [ ] T008 [P] [US2] Migrate both call sites in `src/routes/onboarding.ts`: change import from `formatAIError` to `AIError` (from `../ai/errors.js`), replace both `formatAIError(err)` occurrences with `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`

**Checkpoint**: At this point, User Stories 1 AND 2 should both be working. All six call sites use the new pattern. `formatAIError` still exists but is no longer called from production code. Running `npm test` passes.

---

## Phase 5: User Story 3 — Remove dead code (Priority: P2)

**Goal**: Delete the `formatAIError` function and its file (`src/shared/errors.ts`). Remove the old test file (`src/shared/errors.test.ts`) since its test cases have been migrated to `src/ai/errors.test.ts`.

**Independent Test**: A grep for `formatAIError` across all `src/` files returns zero results. The file `src/shared/errors.ts` does not exist. No imports from `../shared/errors.js` remain in `src/routes/`.

### Implementation for User Story 3

- [ ] T009 [P] [US3] Delete `src/shared/errors.ts` — remove the `formatAIError` function and its file entirely
- [ ] T010 [P] [US3] Delete `src/shared/errors.test.ts` — old tests for `formatAIError` are superseded by `src/ai/errors.test.ts`

**Checkpoint**: All three user stories are complete. `formatAIError` is gone. `src/shared/errors.ts` and `src/shared/errors.test.ts` no longer exist.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the refactoring is complete with no regression

- [ ] T011 [P] Run `npm test` to confirm full test suite passes post-refactoring
- [ ] T012 [P] Run `npx tsc --noEmit` to confirm no type errors
- [ ] T013 [P] Verify no remaining references to `formatAIError` in `src/` production code: `grep -rn 'formatAIError' src/ --include='*.ts' | grep -v '.test.ts'` returns empty
- [ ] T014 [P] Verify no imports from `../shared/errors.js` remain in `src/routes/`: `grep -rn '../shared/errors' src/routes/ --include='*.ts'` returns empty

**Checkpoint**: All validation checks pass. Feature is complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — baseline check before all work
- **Foundational (Phase 2)**: No tasks — skip
- **User Story 1 (Phase 3)**: Depends on baseline (Phase 1) being confirmed
- **User Story 2 (Phase 4)**: Depends on User Story 1 (the method must exist on AIError before call sites can reference it)
- **User Story 3 (Phase 5)**: Depends on User Story 2 (call sites must stop referencing `formatAIError` before the function can be deleted)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — can start after Phase 1
- **User Story 2 (P1)**: Depends on US1 — `toUserMessage()` must exist on AIError
- **User Story 3 (P2)**: Depends on US2 — `formatAIError` must no longer be referenced in production code

### Within Each User Story

- Tests MUST be written and pass before moving to the next phase (but call-site migration can proceed after method exists)
- For US2: all five tasks are fully parallelizable (different files, no overlap)
- For US3: file deletion tasks are independent

### Parallel Opportunities

- US1: T002 (implementation) and T003 (tests) can be done in parallel (TDD style)
- All US2 tasks (T004-T008) can run in parallel — each is a different route file
- US3 cleanup tasks (T009, T010) can run in parallel (different files)
- Polish validation tasks (T011-T014) can all run in parallel (independent checks)

---

## Parallel Example: User Story 2

```bash
# All five call-site migrations can be done in parallel:
Task: Migrate browse.ts call site in src/routes/browse.ts
Task: Migrate chat.ts call site in src/routes/chat.ts
Task: Migrate lessons.ts call site in src/routes/lessons.ts
Task: Migrate missions.ts call site in src/routes/missions.ts
Task: Migrate onboarding.ts call sites in src/routes/onboarding.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline test pass)
2. Complete Phase 3: User Story 1 (add toUserMessage + tests)
3. **STOP and VALIDATE**: Run `npx vitest run src/ai/errors.test.ts`
4. The feature is already delivering value — a developer can now read a single class to understand user-facing error messages

### Incremental Delivery

1. Phase 1 + Phase 3: Method exists, tested, but no production usage yet
2. Phase 4: All call sites migrated, old function still present but unused
3. Phase 5: Dead code removed, full cleanup
4. Phase 6: Validation — full test suite, type check, grep for lingering references

### Parallel Team Strategy

With multiple developers:

1. Developer A: Phase 3 (add toUserMessage + tests)
2. After Phase 3 completes (method exists): Developers B-F each take one call-site file from US2 (T004-T008)
3. Anyone: US3 cleanup (T009, T010) — delete the dead files
4. Anyone: Phase 6 validation tasks (T011-T014)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Zero behavioral change is required — messages must be byte-identical before and after
- This feature involves no database schema changes, no environment variables, and no new dependencies
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
