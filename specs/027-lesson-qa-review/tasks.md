# Tasks: Lesson QA Review

**Input**: Design documents from `specs/027-lesson-qa-review/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included — each user story specifies independent test criteria. Test tasks follow implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No new dependencies or project structure needed — this feature uses the existing stack and file layout. Skip to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Write `REVIEWER_SYSTEM_PROMPT` constant in `src/ai/teacher.ts` — conservative review prompt instructing the reviewer to fix only clear-cut errors (typos, broken HTML, verifiably wrong facts), not style or structure

**Checkpoint**: Reviewer prompt ready — implementation can now begin

---

## Phase 3: User Story 1 - Automatic QA review catches mistakes before delivery (Priority: P1) + User Story 3 - All generation paths (Priority: P1)

**Goal**: A second AI pass reviews generated lesson content before the student sees it. Applies to all four generation paths (next, sub, regenerate, bridge). The reviewer corrects only clear-cut errors per the conservative mandate.

**Independent Test**: Trigger any lesson generation path. Verify the "Reviewing lesson…" progress message appears, the review AI is called with the lesson content, and the stored lesson reflects corrections (or the original if no errors found). Verify reviewer failure falls back to original content.

### Implementation for US1 + US3

- [x] T002 [US1] Add private `reviewLessonContent()` method to `LessonGenerator` in `src/lessons/generator.ts` — calls `ai.chat()` with `REVIEWER_SYSTEM_PROMPT` and lesson HTML, using `"high"` model tier, returning corrected HTML or null on failure
- [x] T003 [US1] Integrate review call into `startGeneration()` in `src/lessons/generator.ts` — after `runConversation()` and `findResult()` succeed, call `reviewLessonContent()`, then call `lessonStore.updateLessonContent()` if content was corrected
- [x] T004 [US1] Push "Reviewing lesson…" progress message to `job.messages` before review call in `src/lessons/generator.ts` — ensures frontend progress indicator updates during review
- [x] T005 [US1] Add review-outcome logging in `src/lessons/generator.ts` — log `[lesson-qa]` info for "corrected", debug for "passed", warn for "failed" per FR-008

**Checkpoint**: Core review loop working — any lesson generation triggers review before completion. All four generation paths covered (single integration point in `startGeneration()`).

---

## Phase 4: User Story 2 - Reviewer fixes formatting and structural issues (Priority: P2)

**Goal**: The reviewer explicitly checks for malformed HTML, broken code blocks, inconsistent heading levels, and other structural issues. These checks are encoded in the reviewer prompt.

**Independent Test**: Generate a lesson with intentional formatting issues (malformed HTML table, heading level jumps). Confirm the reviewer corrects them before storage.

### Implementation for US2

- [x] T006 [US2] Enhance `REVIEWER_SYSTEM_PROMPT` in `src/ai/teacher.ts` — add explicit formatting checklist: well-formed HTML, consistent heading hierarchy, properly closed tags, correct code block syntax highlighting, images/diagrams rendering

**Checkpoint**: Reviewer prompt now includes explicit formatting verification instructions. Combined with T001's error-correction mandate, the reviewer covers both factual and formatting domains.

---

## Phase 5: Tests

**Purpose**: Verify all three user stories work correctly via HTTP-level integration tests

### Test helpers and setup

- [x] T007 [P] [US1] Add review-specific test helpers in `src/test/lessons.test.ts` — helper to queue `FakeAiClient.chat()` responses for the review step, helper to seed lesson content with known errors

### US1 tests (core review)

- [x] T008 [P] [US1] Test: reviewer corrects factual errors — queue a `toolUseResponse("create_lesson")` + `textResponse(draft)` for generation, then `textResponse(corrected_html)` for review. Verify stored lesson has corrected content. File: `src/test/lessons.test.ts`
- [x] T009 [P] [US1] Test: reviewer passes through unchanged content — queue generation + review that returns identical HTML. Verify stored lesson unchanged. File: `src/test/lessons.test.ts`
- [x] T010 [P] [US1] Test: reviewer failure falls back to original — queue generation + review that throws/returns empty. Verify original lesson delivered, job completes. File: `src/test/lessons.test.ts`

### US2 tests (formatting)

- [x] T011 [P] [US2] Test: reviewer fixes HTML formatting — queue generation with broken HTML (e.g., unclosed tags, heading level jumps), queue review response with fixed HTML. Verify stored lesson has corrected structure. File: `src/test/lessons.test.ts`

### US3 tests (all generation paths)

- [x] T012 [P] [US3] Test: review runs for sub-lesson generation — trigger sub-lesson path, verify "Reviewing lesson…" appears and review step runs. File: `src/test/lessons.test.ts`
- [x] T013 [P] [US3] Test: review runs for regeneration — trigger regenerate path, verify review step runs. File: `src/test/lessons.test.ts`
- [x] T014 [P] [US3] Test: review runs for bridging — trigger bridging path, verify review step runs. File: `src/test/lessons.test.ts`

**Checkpoint**: All tests pass. Each user story has at least one passing test scenario.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T015 Export `REVIEWER_SYSTEM_PROMPT` from `src/ai/index.ts` barrel file for test visibility
- [x] T016 Run `npm test` — verify all existing tests still pass, new tests pass
- [x] T017 Run quickstart.md validation scenarios sequentially against a running dev instance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — no new dependencies or structure needed
- **Foundational (Phase 2)**: No dependencies — can start immediately. BLOCKS all user stories
- **User Story 1 + 3 (Phase 3)**: Depends on Foundational (Phase 2) — needs `REVIEWER_SYSTEM_PROMPT`
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — prompt-only change, no code dependency on Phase 3
- **Tests (Phase 5)**: Depends on Phases 3 and 4 (implementation must exist before testing)
- **Polish (Phase 6)**: Depends on all tests passing

### User Story Dependencies

- **US1 + US3 (P1)**: Can start after Phase 2. US3 is inherently satisfied by the `startGeneration()` integration point — no separate implementation needed
- **US2 (P2)**: Can start after Phase 2. Independent of US1 implementation (prompt-only change)

### Within Each Phase

- T002 → T003 → T004 → T005 (sequential: method, integration, progress, logging)
- T006 independent of T002-T005 (different file)
- T007 before other test tasks (helpers needed)
- T008-T014 all [P] — can run in parallel once T007 is done

### Parallel Opportunities

- After T001: T002 and T006 can run in parallel (different files)
- After T007: T008-T014 can all run in parallel (independent test cases)
- T015 can run anytime after T001

---

## Parallel Example: Tests Phase

```bash
# After T007 (helpers), launch all test tasks in parallel:
Task: "Test: reviewer corrects factual errors in src/test/lessons.test.ts"
Task: "Test: reviewer passes through unchanged content in src/test/lessons.test.ts"
Task: "Test: reviewer failure falls back to original in src/test/lessons.test.ts"
Task: "Test: reviewer fixes HTML formatting in src/test/lessons.test.ts"
Task: "Test: review runs for sub-lesson generation in src/test/lessons.test.ts"
Task: "Test: review runs for regeneration in src/test/lessons.test.ts"
Task: "Test: review runs for bridging in src/test/lessons.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 3 Only)

1. Complete Phase 2: Foundational (T001 — REVIEWER_SYSTEM_PROMPT)
2. Complete Phase 3: US1 + US3 (T002-T005 — review method + integration)
3. **STOP and VALIDATE**: Manually trigger lesson generation, verify review runs, check logs for [lesson-qa]
4. This delivers the core value: all generation paths get review before delivery

### Incremental Delivery

1. Phase 2 → Foundation ready (review prompt exists)
2. Phase 3 → Core review works (P1 stories delivered — MVP!)
3. Phase 4 → Formatting checks refined (P2 story delivered)
4. Phase 5 → Tests complete (all stories verified)
5. Phase 6 → Polish and quickstart validation

### Single-File Focus

The entire implementation touches only 2 source files:
- `src/ai/teacher.ts` — add `REVIEWER_SYSTEM_PROMPT`
- `src/lessons/generator.ts` — add review method, integration call, progress message, logging

Tests add to:
- `src/test/lessons.test.ts` — review-specific test cases

No new files, no schema changes, no route changes, no UI changes.

---

## Notes

- [P] tasks = different test cases or different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US3 (all generation paths) has no separate implementation — it's inherently satisfied by the `startGeneration()` integration point (T003)
- US2 (formatting) is primarily a prompt engineering task (T001 + T006) with one test (T011)
- All review failures use try/catch — never block lesson delivery
- The review uses `ai.chat()` (not `chatWithTools()`) — single-turn, no tool access needed
- Review model tier: `"high"` (accuracy matters for QA)
