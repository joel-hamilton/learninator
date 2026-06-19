# Tasks: Post-Lesson Navigation

**Input**: Design documents from `/specs/008-post-lesson-navigation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/routes.md, quickstart.md

**Tests**: Tests are included — HTTP-level integration tests per Constitution Principle II.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions include exact file paths

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — the project already exists with all dependencies.

**Status**: Skip — no setup tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire `LessonGenerator` into the app so all user story phases can use it for generation actions.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Inject LessonGenerator into app context in `src/index.ts` — create `LessonGenerator` instance from `{ ai: resolvedAi, toolExecutor: createToolExecutor(store), db: resolvedDb, logger: createLogger("generator") }`, set on context via `c.set("lessonGenerator", generator)`
- [x] T002 Add `lessonGenerator` to `AppVariables` type in `src/types.ts` — import `LessonGenerator` from `lessons/generator.js`, add `lessonGenerator: LessonGenerator` to the interface
- [x] T003 Remove unused `completeBar()` function from `src/views/fragments.ts` (lines 81-97) — it's dead code, never imported

**Checkpoint**: `LessonGenerator` is available via `c.get("lessonGenerator")` in all route handlers. No visible behavior change yet.

---

## Phase 3: User Story 1 - Complete a Lesson and Choose Next Step (Priority: P1) 🎯 MVP

**Goal**: After marking a lesson complete, the student sees a clear "What's next?" section with three predictable options: Continue Learning (always creates main lesson), Dive Deeper (always creates sub-lesson), Explore Something New (browse flow). No more AI-decided lesson types.

**Independent Test**: Complete any lesson, verify post-completion bar shows three options, click "Continue Learning" and verify it always creates a main lesson, click "Dive Deeper" and verify it always creates a sub-lesson.

### Tests for User Story 1

- [ ] T004 [P] [US1] Add test for post-completion bar rendering after marking complete in `src/test/lessons.test.ts` — verify the response HTML contains "What's next?", "Continue Learning", "Dive Deeper", and "Explore Something New" and does NOT contain "New Lesson" or "More on This"
- [ ] T005 [P] [US1] Add test for Continue Learning always creating a main lesson in `src/test/lessons.test.ts` — queue `toolUseResponse("create_lesson")` + `textResponse("Done")`, POST to `/generate-next`, verify polling returns `generationDoneBar` with a main lesson link (no sub-number)
- [ ] T006 [P] [US1] Add test for Dive Deeper always creating a sub-lesson in `src/test/lessons.test.ts` — queue `toolUseResponse("create_sub_lesson")` + `textResponse("Done")`, POST to `/generate-sub-lesson`, verify polling returns `generationDoneBar` with a sub-lesson link

### Implementation for User Story 1

- [x] T007 [US1] Create `postCompletionBar()` function in `src/views/fragments.ts` — renders "What's next?" heading, "Continue Learning" button (POST to `/generate-next`), "Dive Deeper" button (POST to `/generate-sub-lesson`), "Explore Something New" link (GET to browse), and "Mark Incomplete" button. Replace the body of `completedLessonBar()` with this new content.
- [x] T008 [US1] Update `/complete` route handler in `src/routes/lessons.ts` (line 119-136) — switch response from `completedLessonBar()` to `postCompletionBar()` (or keep calling `completedLessonBar` with the updated implementation from T007)
- [x] T009 [US1] Refactor `generate-next` route handler in `src/routes/lessons.ts` (lines 178-293) to use `LessonGenerator.generateNext()` from context instead of inline job tracking — remove the local `GenerationJob` type and `generationJobs` Map from this handler
- [x] T010 [US1] Change the `generate-next` system prompt in `src/lessons/generator.ts` (lines 89-106) to ALWAYS instruct `create_lesson` — remove the "Decide whether... create_lesson or create_sub_lesson" language and replace with "Create the next main lesson using create_lesson. Do NOT use create_sub_lesson."
- [x] T011 [US1] Refactor `generate-sub-lesson` route handler in `src/routes/lessons.ts` (lines 321-440) to use `LessonGenerator.generateSubLesson()` from context instead of inline job tracking
- [x] T012 [US1] Add "Explore Something New" link to the post-completion bar in `src/views/fragments.ts` — link to `/missions/:missionId/browse` (the existing browse flow)
- [x] T013 [US1] Update `generate-next/status` route handler in `src/routes/lessons.ts` (lines 295-317) to use `LessonGenerator.getJobStatus()` with the key from `buildJobKey(missionId, number, subNumber, "next")`
- [x] T014 [US1] Update `generate-sub-lesson/status` route handler in `src/routes/lessons.ts` (lines 418-440) to use `LessonGenerator.getJobStatus()` with the key from `buildJobKey(missionId, number, subNumber, "sub")`

**Checkpoint**: Post-completion navigation works end-to-end. Continue Learning always creates main lessons. Dive Deeper always creates sub-lessons. Explore Something New links to browse.

---

## Phase 4: User Story 2 - Give Feedback During a Lesson (Priority: P2)

**Goal**: While viewing an active lesson, the student sees only the 3 difficulty rating buttons and a "Mark Complete" button. After rating "too hard" or "too easy", adjustment buttons appear and work (regenerate in-place, bridging sub-lesson). No dead buttons.

**Independent Test**: View an active lesson, verify only rating + complete buttons shown. Rate "too hard", verify "Make Easier" and "Bridge First" appear and work.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add test for active lesson bar showing only rating + complete buttons in `src/test/lessons.test.ts` — GET lesson, verify response contains "Too Easy", "Just Right", "Too Hard", "Mark Complete" but NOT "New Lesson" or "More on This"
- [ ] T016 [P] [US2] Add test for "too hard" feedback showing adjustment options in `src/test/lessons.test.ts` — POST feedback with `rating=too_hard`, verify response contains "Make Easier" and "Bridge First"
- [ ] T017 [P] [US2] Add test for regenerate route creating a regeneration job in `src/test/lessons.test.ts` — POST to `/regenerate` with `direction=harder`, verify polling bar appears, then status returns done bar
- [ ] T018 [P] [US2] Add test for bridging route creating a bridging job in `src/test/lessons.test.ts` — POST to `/generate-bridging`, verify polling bar appears, then status returns done bar

### Implementation for User Story 2

- [x] T019 [US2] Redesign `lessonActionBar()` in `src/views/fragments.ts` (lines 26-49) — remove "New Lesson" and "More on This" buttons, keep only the 3 rating buttons and a prominent "Mark Complete" button. Remove emoji from rating button labels.
- [x] T020 [US2] Add POST `/regenerate` route handler in `src/routes/lessons.ts` — parse `direction` from body, validate it's "harder" or "easier", call `lessonGenerator.generateRegenerate()`, return `regenerationPollingBar()`
- [x] T021 [US2] Add GET `/regenerate/status` route handler in `src/routes/lessons.ts` — poll `lessonGenerator.getJobStatus()` with regenerate key, return appropriate polling/done/error bar
- [x] T022 [US2] Add POST `/generate-bridging` route handler in `src/routes/lessons.ts` — call `lessonGenerator.generateBridging()`, return `bridgingPollingBar()`
- [x] T023 [US2] Add GET `/generate-bridging/status` route handler in `src/routes/lessons.ts` — poll `lessonGenerator.getJobStatus()` with bridge key, return appropriate polling/done/error bar
- [x] T024 [US2] Update `/feedback` route handler in `src/routes/lessons.ts` (lines 80-99) — keep the same logic but ensure the response `feedbackThanksBar()` links to the new working regenerate/bridging endpoints
- [x] T025 [US2] Update `feedbackThanksBar()` in `src/views/fragments.ts` (lines 51-79) — point "Make Harder"/"Make Easier" buttons at `/regenerate` and "Bridge First" at `/generate-bridging` (these are already correctly targeted — verify no changes needed)

**Checkpoint**: All adjustment buttons work. Regenerate replaces lesson content in-place. Bridging creates a sub-lesson with prerequisite content. No dead buttons remain in any state.

---

## Phase 5: User Story 3 - AI Uses Feedback to Shape Future Lessons (Priority: P3)

**Goal**: When generating new lessons, the AI automatically reads the student's feedback history and calibrates difficulty. Students who consistently rate lessons "too hard" get simpler material; those who rate "too easy" get more challenge.

**Independent Test**: Seed 3 "too hard" ratings, generate a new lesson, verify the system prompt includes instruction to use simpler explanations.

### Tests for User Story 3

- [ ] T026 [P] [US3] Add test for feedback history being passed to generation in `src/test/lessons.test.ts` — seed lessons with "too_hard" ratings, POST to `/generate-next`, verify the AI prompt includes calibration instruction based on feedback pattern (check via FakeAiClient's received messages)
- [ ] T027 [P] [US3] Add test for mixed ratings maintaining current calibration in `src/test/lessons.test.ts` — seed mixed ratings, verify prompt instructs maintaining current difficulty

### Implementation for User Story 3

- [x] T028 [US3] Update `generate-next` system prompt in `src/lessons/generator.ts` to emphasize feedback-driven calibration — ensure the prompt instructs the AI to call `list_feedback_history` before creating content and to adjust difficulty based on patterns (already partially done in the existing text, verify and strengthen)
- [x] T029 [US3] Update `generate-sub-lesson` system prompt in `src/lessons/generator.ts` to include the same feedback calibration instruction as generate-next
- [x] T030 [US3] Update `generateRegenerate` system prompt in `src/lessons/generator.ts` to pass the student's full feedback history context (it already calls `list_feedback_history` via the system prompt from `getRegenerateSystemPrompt()` — verify it's wired correctly)

**Checkpoint**: AI consistently reads feedback history and calibrates lesson difficulty. The calibration happens automatically without the student needing to repeat preferences.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Clean up remaining issues, remove the inline job tracking completely, final validation.

- [x] T031 Remove the module-level `generationJobs` Map and `GenerationJob` type from `src/routes/lessons.ts` (lines 163-176) once all route handlers have been migrated to `LessonGenerator`
- [x] T032 [P] Remove unused imports from `src/routes/lessons.ts` — `generationPollingBar`, `generationRunningBar`, `generationDoneBar`, `generationErrorBar`, `generationMissingBar` may no longer be directly used if all polling goes through LessonGenerator (verify each is still needed)
- [ ] T033 Run full test suite with `npm test` and fix any regressions
- [ ] T034 Run quickstart validation scenarios from `specs/008-post-lesson-navigation/quickstart.md` manually against the running dev server

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — project already initialized
- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — needs `LessonGenerator` in context
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — needs `LessonGenerator` for regenerate/bridging
- **User Story 3 (Phase 5)**: Depends on US2 (Phase 4) — needs feedback collection working before calibration can be tested end-to-end. Can start in parallel with US2 for prompt changes.
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on US2 or US3
- **User Story 2 (P2)**: Can start after Phase 2 — No dependency on US1. US1 and US2 can run in parallel since they touch different UI bars (post-completion vs active/feedback).
- **User Story 3 (P3)**: Light dependency on US2 (feedback must be recorded for calibration to matter), but prompt changes can be done alongside US2. Full testing needs US2 complete.

### Within Each User Story

- Tests MUST be written first and FAIL before implementation
- UI fragments before route handlers (routes reference view functions)
- Route handlers before status endpoints
- Core implementation before cleanup

### Parallel Opportunities

- **Phase 2**: T001 and T003 can run in parallel (different files)
- **Phase 3 (US1)**: T004, T005, T006 (tests) can all run in parallel. T007 (UI) can run parallel to T009-T011 (route refactoring) since they touch different files.
- **Phase 4 (US2)**: T015-T018 (tests) can all run in parallel. T019 (UI) can run parallel to T020-T023 (new routes). T020/T022 can run in parallel (different endpoints).
- **Phase 5 (US3)**: T026 and T027 (tests) in parallel. T028, T029, T030 in parallel (different sections of the same file, but independent prompts).
- **Phase 6**: T032 can run parallel to T031. T033 must run after all others.

---

## Parallel Example: User Story 1

```bash
# Step 1: Launch all US1 tests together (they FAIL initially):
Task: "T004 Add test for post-completion bar rendering in src/test/lessons.test.ts"
Task: "T005 Add test for Continue Learning always creating main lesson in src/test/lessons.test.ts"
Task: "T006 Add test for Dive Deeper always creating sub-lesson in src/test/lessons.test.ts"

# Step 2: Implement UI + route changes in parallel:
Task: "T007 Create postCompletionBar() in src/views/fragments.ts"
Task: "T009 Refactor generate-next route to use LessonGenerator in src/routes/lessons.ts"
Task: "T011 Refactor generate-sub-lesson route to use LessonGenerator in src/routes/lessons.ts"

# Step 3: Wire remaining pieces:
Task: "T008 Update /complete route handler in src/routes/lessons.ts"
Task: "T010 Change generate-next system prompt in src/lessons/generator.ts"
Task: "T012 Add Explore Something New link in src/views/fragments.ts"
Task: "T013 Update generate-next/status handler in src/routes/lessons.ts"
Task: "T014 Update generate-sub-lesson/status handler in src/routes/lessons.ts"
```

---

## Parallel Example: User Story 2

```bash
# Step 1: Launch all US2 tests together (they FAIL initially):
Task: "T015 Add test for active lesson bar in src/test/lessons.test.ts"
Task: "T016 Add test for too hard feedback in src/test/lessons.test.ts"
Task: "T017 Add test for regenerate route in src/test/lessons.test.ts"
Task: "T018 Add test for bridging route in src/test/lessons.test.ts"

# Step 2: Implement UI + new routes in parallel:
Task: "T019 Redesign lessonActionBar() in src/views/fragments.ts"
Task: "T020 Add POST /regenerate route in src/routes/lessons.ts"
Task: "T022 Add POST /generate-bridging route in src/routes/lessons.ts"

# Step 3: Status endpoints + remaining wiring:
Task: "T021 Add GET /regenerate/status route in src/routes/lessons.ts"
Task: "T023 Add GET /generate-bridging/status route in src/routes/lessons.ts"
Task: "T024 Update /feedback route handler in src/routes/lessons.ts"
Task: "T025 Verify feedbackThanksBar endpoints in src/views/fragments.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T003) — wire LessonGenerator
2. Complete Phase 3: User Story 1 (T004-T014) — post-completion navigation
3. **STOP and VALIDATE**: Test US1 independently — complete a lesson, verify all three options work, verify Continue Learning always creates main lesson
4. Deploy/demo if ready — this already fixes the core complaint about unpredictability

### Incremental Delivery

1. Phase 2 → Foundation ready (LessonGenerator wired)
2. Add US1 → Test independently → **MVP!** The core predictability problem is solved
3. Add US2 → Test independently → In-lesson feedback adjustments work, no dead buttons
4. Add US3 → Test independently → AI calibration makes lessons adaptive
5. Phase 6 → Polish → Final test pass, cleanup

### Single Developer Strategy

Execute sequentially: Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6. Within each phase, write tests first, then implement, then verify the checkpoint before moving on.

---

## Notes

- [P] tasks = different files, no dependencies on other incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- The `LessonGenerator` class already has all four generation methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) and `getJobStatus()` — tasks are about wiring, not rewriting
- No schema changes — the existing `lessons` table fully supports this feature
- The `FakeAiClient` test helper already supports `toolUseResponse()` and `textResponse()` for the AI conversation loop — use the existing pattern from `src/test/lessons.test.ts`
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
