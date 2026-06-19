# Tasks: Remove No-Op Function

**Input**: Design documents from `specs/021-remove-noop-function/`

**Prerequisites**: plan.md (complete), spec.md (complete), research.md (complete), data-model.md (complete), contracts/ (no external interfaces)

**Tests**: Not requested by the feature specification. Existing tests must pass with zero modifications (per FR-003).

**Organization**: Tasks are grouped by user story. No Setup or Foundational phases are needed — this is a purely mechanical single-file cleanup with no project initialization, dependency changes, or blocking infrastructure.

**Note on call site count**: The spec and research.md reference 6 call sites, but the actual source file (`src/views/fragments.ts`) contains **7** call sites of `${hideBannerOnSettle()}`. The additional site is in `generationMissingBar` (line 145). All 7 must be removed.

---

## Phase 1: User Story 1 — Remove dead code (Priority: P1) [MVP]

**Goal**: Remove `hideBannerOnSettle()` function definition and all 7 call sites from `src/views/fragments.ts`. The rendered HTML output must be byte-identical to pre-change output.

**Independent Test**: `grep -r hideBannerOnSettle src/` returns zero results. `npm test` passes with zero modifications to any test file.

- [ ] T001 [US1] Remove `function hideBannerOnSettle(): string { return ""; }` (lines 125-127) from `src/views/fragments.ts`
- [ ] T002 [US1] Remove `${hideBannerOnSettle()}` from 3 call sites in `generationDoneBar` (line 132), `generationErrorBar` (line 138), and `generationMissingBar` (line 145) in `src/views/fragments.ts` — each is `id="feedback-bar"${hideBannerOnSettle()}>` and should become `id="feedback-bar">`
- [ ] T003 [US1] Remove `${hideBannerOnSettle()}` from 2 call sites in `regenerationDoneBar` (line 183) and `regenerationErrorBar` (line 189) in `src/views/fragments.ts` — each is `id="feedback-bar"${hideBannerOnSettle()}>` and should become `id="feedback-bar">`
- [ ] T004 [US1] Remove `${hideBannerOnSettle()}` from 2 call sites in `bridgingDoneBar` (line 230) and `bridgingErrorBar` (line 236) in `src/views/fragments.ts` — each is `id="feedback-bar"${hideBannerOnSettle()}>` and should become `id="feedback-bar">`
- [ ] T005 [US1] Run `npm test` to confirm the full test suite passes with zero failures and zero modifications to test files

**Checkpoint**: All traces of `hideBannerOnSettle` removed from the codebase. Full test suite passes. HTML output is byte-identical.

---

## Phase 2: User Story 2 — Verify cleanup completeness (Priority: P2)

**Goal**: Confirm all 7 affected template strings in `src/views/fragments.ts` are clean — no empty interpolation expressions remain from the removed function calls.

**Independent Test**: Review all 7 locations in `src/views/fragments.ts` where `hideBannerOnSettle()` was called and confirm the template strings are clean with no residual empty interpolations.

- [ ] T006 [US2] Run `grep -r hideBannerOnSettle src/` and confirm it returns zero results (exit code 1, no output). Visually inspect the 7 previously affected template strings (in `generationDoneBar`, `generationErrorBar`, `generationMissingBar`, `regenerationDoneBar`, `regenerationErrorBar`, `bridgingDoneBar`, `bridgingErrorBar`) to confirm no `${hideBannerOnSettle()}` expressions remain per SC-002

**Checkpoint**: Both user stories are verified and complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1, P1)**: No dependencies — single-file edit, can start immediately.
- **Phase 2 (US2, P2)**: Depends on Phase 1 completion (nothing to verify until the dead code is removed).

### Within Each Phase

All tasks within Phase 1 touch the same file (`src/views/fragments.ts`), so they MUST be executed sequentially:
1. T001 (remove function definition) — prevents accidental re-introduction
2. T002, T003, T004 (remove call sites) — can proceed in any order but must be sequential edits to the same file
3. T005 (run tests) — final validation

Phase 2 is a single verification task (T006) that depends on all of Phase 1.

### Parallel Opportunities

**None.** All edits are to `src/views/fragments.ts` — a single file. No parallelization is possible.

---

## Parallel Example: User Story 1

```bash
# Sequential execution required — all edits are in the same file:
# Step 1: Remove function definition
# Step 2: Remove 3 call sites from generationDoneBar, generationErrorBar, generationMissingBar
# Step 3: Remove 2 call sites from regenerationDoneBar, regenerationErrorBar
# Step 4: Remove 2 call sites from bridgingDoneBar, bridgingErrorBar
# Step 5: Run tests

# Each step modifies src/views/fragments.ts and must complete before the next begins.
```

---

## Implementation Strategy

### MVP (Phase 1 Only)

1. Complete T001-T004: Remove the function definition and all 7 call sites from `src/views/fragments.ts`
2. Complete T005: Run `npm test` to confirm all tests pass
3. **STOP** — MVP is delivered when `grep -r hideBannerOnSettle src/` returns zero and `npm test` passes

### Incremental Delivery

The entire feature is delivered in a single increment (Phase 1). Phase 2 is verification-only with no implementation effort.

### Single Developer Strategy

All tasks execute sequentially on the same file. No team parallelization opportunities exist for this feature.

---

## Notes

- The diff is purely deletions: 1 function definition (3 lines) + 7 occurrences of `${hideBannerOnSettle()}` (each removing a short substring from a template literal)
- No new code is introduced
- No test files are modified
- The `generationMissingBar` function (line 145) has a call site that was not captured in the original spec's 6-call-site inventory — include it in the removal
- After removing `${hideBannerOnSettle()}`, confirm that `id="feedback-bar"` attribute remains properly formed with `>` closing the opening tag
