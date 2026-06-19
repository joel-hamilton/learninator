---

description: "Tasks for Deduplicate Guided-Question JavaScript"
---

# Tasks: Deduplicate Guided-Question JavaScript

**Input**: Design documents from `specs/023-deduplicate-guided-js/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not requested by the spec. Behavioral equivalence is verified by the existing 290+ test suite (SC-003: `npm test` passes unmodified). No new tests are required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Read Current Code)

**Purpose**: Understand the current duplication before making changes

- [ ] T001 Read and understand the inline guided-question function definitions (lines ~636-676) inside the `HTMX_HEAD` template literal in `src/views/shared.ts`
- [ ] T002 Read and understand the `GUIDED_QUESTION_SCRIPT` constant (lines ~731-773) in `src/views/shared.ts` -- note it wraps functions in `<script>` tags
- [ ] T003 Read and understand how `GUIDED_QUESTION_SCRIPT` is used in `src/views/onboarding.ts` (line 184) -- it is rendered inside `<body>` and relies on the `<script>` wrapper

**Checkpoint**: Understand the two locations where guided-question JS is defined and how GUIDED_QUESTION_SCRIPT is consumed

---

## Phase 2: User Story 1 - Developers maintain guided-question behavior from one location (Priority: P1)  MVP

**Goal**: Refactor so that `HTMX_HEAD`'s inline `<script>` tag uses `GUIDED_QUESTION_SCRIPT` instead of duplicating the function bodies. `addFollowupMessage()` and `cleanupThinking()` must remain in the inline script (they are NOT part of `GUIDED_QUESTION_SCRIPT`).

**Independent Test**: After this phase, inspecting `src/views/shared.ts` should show each guided-question function name (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`) exactly once -- inside `GUIDED_QUESTION_SCRIPT`, not duplicated in the inline script.

### Implementation for User Story 1

- [ ] T004 [US1] Refactor `GUIDED_QUESTION_SCRIPT` in `src/views/shared.ts` to export raw JavaScript (strip the outer `<script>` and `</script>` wrapper), so it can be interpolated inside an existing `<script>` tag without producing nested script tags

- [ ] T005 [US1] Update `src/views/shared.ts` -- remove the inline duplicated guided-question function definitions (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`) from lines ~636-676 in `HTMX_HEAD`'s inline `<script>` and replace them with an interpolation of `GUIDED_QUESTION_SCRIPT` (the raw JS variant), keeping `addFollowupMessage()` and `cleanupThinking()` in place

- [ ] T006 [US1] Update `src/views/onboarding.ts` line 184 to wrap the raw `GUIDED_QUESTION_SCRIPT` JS in `<script>` tags when rendering in the `<body>` context, so the behavior is preserved

**Checkpoint**: At this point, `GUIDED_QUESTION_SCRIPT` is the single source of truth. The inline script in `HTMX_HEAD` references it, and `onboarding.ts` wraps it appropriately.

---

## Phase 3: User Story 2 - No behavioral regression on existing guided-question flows (Priority: P1)

**Goal**: Verify that the refactoring introduced zero behavioral changes. All guided-question interactions work identically.

**Independent Test**: `npm test` passes with the same number of passing tests as before the refactoring.

### Verification for User Story 2

- [ ] T007 [US2] Run `npm test` and confirm all 290+ tests pass with zero failures
- [ ] T008 [US2] Manual verification -- visually confirm in `src/views/shared.ts` that each guided-question function name appears only once (inside `GUIDED_QUESTION_SCRIPT`, not in the inline script)

**Checkpoint**: Both the automated test suite and manual inspection confirm zero regressions.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and commit

- [ ] T009 Run the quickstart.md validation scenarios to confirm no duplicate function definitions and behavioral equivalence
- [ ] T010 Run `npm test` one final time to ensure everything is green before committing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies -- can start immediately
- **User Story 1 (Phase 2)**: Depends on Setup (Phase 1) completion
- **User Story 2 (Phase 3)**: Depends on User Story 1 (Phase 2) completion -- verification of the refactoring
- **Polish (Phase 4)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: The actual refactoring -- must complete before verification
- **User Story 2 (P1)**: Pure verification -- runs after US1

### Within Each User Story

- Implementation before verification
- US1 tasks have a strict order: strip script tags from the constant, then update the inline script, then fix the caller

### Parallel Opportunities

- T001, T002, T003 (Setup) can be run in parallel (pure code reading)
- T007 and T008 (US2 verification) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Tasks within US1 are strictly sequential (single-file scoped):
# T004: Refactor GUIDED_QUESTION_SCRIPT to raw JS
# T005: Update inline script in HTMX_HEAD to interpolate raw JS
# T006: Update onboarding.ts to wrap raw JS in script tags
```

## Parallel Example: User Story 2

```bash
# Verification tasks can run in parallel:
Task: "Run npm test -- all 290+ tests pass"
Task: "Inspect src/views/shared.ts for duplicate function definitions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (read current code)
2. Complete Phase 2: User Story 1 (the refactoring)
3. **STOP and VALIDATE**: Run `npm test` and inspect the file
4. Commit

### Incremental Delivery

1. Phase 1 + Phase 2 (US1) -- the refactoring is done and tested at the file level
2. Phase 3 (US2) -- regression verification adds confidence via the full test suite
3. Phase 4 -- final polish commit

### Notes

- The entire feature modifies only 2 files: `src/views/shared.ts` and `src/views/onboarding.ts`
- The inline script also contains `addFollowupMessage()` and `cleanupThinking()` (lines ~677-693) which are NOT in `GUIDED_QUESTION_SCRIPT` -- they must remain in the inline script after refactoring
- No new dependencies, no schema changes, no new tests needed
