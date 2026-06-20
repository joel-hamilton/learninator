# Tasks: Wired Feedback

**Input**: Design documents from `specs/026-wired-feedback/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No new test files requested in spec. Existing 323 tests must continue to pass.

**Organization**: Tasks grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in descriptions

---

## Phase 1: Setup (Verification)

**Purpose**: Confirm baseline before changes

- [x] T001 Verify all 323 existing tests pass with `npm test`
- [x] T002 Read and understand current feedback flow: `src/routes/lessons.ts` (POST feedback), `src/views/fragments.ts` (feedbackThanksBar), `src/lessons/generator.ts` (GenerationConfig pattern)

---

## Phase 2: Foundational (Shared Feedback Summary)

**Purpose**: Shared utility that US2 and US3 depend on for prompt injection

**⚠️ CRITICAL**: `buildFeedbackSummary` is used by all generation configs in Phase 4 (US2) and Phase 5 (US3)

- [x] T003 Create `buildFeedbackSummary()` in `src/shared/feedback-summary.ts` — accepts `LessonStore` and `missionId`, calls `listLessonFeedback`, returns formatted markdown string with per-lesson ratings/text table (last 5) + trend summary. Pure function, no side effects.

**Checkpoint**: `buildFeedbackSummary` ready — US2 and US3 can use it for prompt injection

---

## Phase 3: User Story 1 - Rate a Lesson and Explain Why (Priority: P1) 🎯 MVP

**Goal**: After clicking a difficulty rating, an inline textarea appears so the student can explain why. Text + rating are saved together. The silent "Thanks!" confirmation is replaced with a visible confirmation showing the rating and text preview.

**Independent Test**: Navigate to an active lesson, click "Too hard", verify textarea appears with label "What made it too hard?", type text, press Enter, verify confirmation shows rating + text preview, verify action buttons remain visible below.

### Implementation for User Story 1

- [x] T004 [US1] Update `feedbackThanksBar()` in `src/views/fragments.ts` — replace the silent confirmation row (`<span class="la-label">Thanks! You rated this...</span>`) with: (a) rating confirmation text, (b) a preview of submitted feedback text (first 100 chars), (c) adjustment buttons (unchanged logic). The action buttons section below the divider is unchanged.
- [x] T005 [US1] Update `lessonActionBar()` in `src/views/fragments.ts` — add inline textarea + submit button that appears when a rating is clicked. The textarea label changes based on selected rating ("What made it too hard?" / "What made it too easy?" / "What worked well?"). Clicking a different rating updates the label while preserving typed text. Include a small inline `<script>` for the label-switching and Enter-to-submit behavior.
- [x] T006 [US1] Update `POST /:number/feedback` route in `src/routes/lessons.ts` — read `feedbackText` from body, pass to `updateLessonFeedback`. No other changes needed — it already returns `feedbackThanksBar`.
- [x] T007 [US1] Update `.la-feedback` CSS in `src/views/lesson.ts` — add styles for inline textarea within the feedback zone: `.la-fb-textarea` (full-width, small font, compact padding), `.la-fb-submit` (compact submit button), `.la-fb-label` (context-sensitive label above textarea). Ensure the textarea doesn't break the two-zone layout on mobile.
- [x] T008 [US1] Verify US1 — all 323 tests pass, textarea renders with correct label switching and submission — run through quickstart.md scenarios 1-3. Confirm textarea appears, label switches, text is preserved on rating change, empty submission works, confirmation shows text preview.

**Checkpoint**: User Story 1 complete — students can provide text feedback inline after rating

---

## Phase 4: User Story 2 - Feedback Shapes the Next Lesson Automatically (Priority: P1)

**Goal**: Every generation prompt (next lesson, sub-lesson, regeneration, bridging) includes a structured feedback summary. The AI no longer needs to call `list_feedback_history` for calibration to occur.

**Independent Test**: Seed feedback history (2+ "too hard" ratings with text), trigger generation, inspect the prompt sent to the AI (via FakeAiClient) to verify feedback summary is present in both system prompt and user message.

### Implementation for User Story 2

- [x] T009 [US2] Update `buildSystemPrompt` in `generateNext` config within `src/lessons/generator.ts` — call `buildFeedbackSummary(this.deps.lessonStore, missionId)` and append the result to the system prompt. Remove the "ALWAYS call list_feedback_history first — this is required" instruction (redundant now that summary is injected).
- [x] T010 [US2] Update `buildUserMessage` in `generateNext` config — inject the most recent lesson's feedback text (if any) directly into the user message. The `opts.feedback` parameter already carries this; ensure it's always appended when present.
- [x] T011 [P] [US2] Update `buildSystemPrompt` in `generateSubLesson` config within `src/lessons/generator.ts` — same pattern as T009: call `buildFeedbackSummary`, append to system prompt, remove redundant "ALWAYS call" instruction.
- [x] T012 [P] [US2] Update `buildUserMessage` in `generateSubLesson` config — inject feedback context into the user message (this path currently has no `opts.feedback`, so use the summary).
- [x] T013 [P] [US2] Update `buildSystemPrompt` in `generateRegenerate` config — call `buildFeedbackSummary` and append. The existing `getRegenerateSystemPrompt` already references feedback history; ensure the summary is injected rather than just referenced.
- [x] T014 [P] [US2] Update `buildUserMessage` in `generateRegenerate` config — inject `opts.feedback` text when present (prep for US3 which passes it from the route).
- [x] T015 [P] [US2] Update `buildSystemPrompt` in `generateBridging` config — same pattern: call `buildFeedbackSummary` and append to system prompt.
- [x] T016 [P] [US2] Update `buildUserMessage` in `generateBridging` config — inject `opts.feedback` text when present (prep for US3).
- [x] T017 [US2] Verify US2 — the existing tests use `FakeAiClient`; verify they still pass. Manually test by seeding feedback and checking that generated lessons reflect the feedback pattern. The `list_feedback_history` tool remains available but is no longer the sole calibration path.

**Checkpoint**: User Story 2 complete — feedback history is programmatically guaranteed in every generation prompt

---

## Phase 5: User Story 3 - Adjustment Buttons Carry Feedback Forward (Priority: P2)

**Goal**: When a student types feedback text and clicks "Make Easier", "Make Harder", or "Bridge First", the text is included in the regeneration/bridging prompt so the adjustment addresses the specific complaint.

**Independent Test**: Rate a lesson "too hard" with text, click "Make Easier", verify the regeneration route forwards the text to the generator and the prompt includes it.

### Implementation for User Story 3

- [x] T018 [US3] Update `feedbackThanksBar()` in `src/views/fragments.ts` — add hidden `feedbackText` fields to the "Make Harder", "Make Easier", and "Bridge First" buttons' `hx-vals` so the submitted text is included in the POST. Use `hx-include` or embed the text in `hx-vals`.
- [x] T019 [US3] Update `POST /:number/regenerate` route in `src/routes/lesson-generation.ts` — read `feedbackText` from body, pass as `opts.feedback` to `generator.generateRegenerate()`.
- [x] T020 [US3] Update `POST /:number/generate-bridging` route in `src/routes/lesson-generation.ts` — read `feedbackText` from body, pass as `opts.feedback` to `generator.generateBridging()`.
- [x] T021 [US3] Verify US3 — test manually: rate "too hard" with text, click "Make Easier", confirm prompt includes both `direction: "easier"` and the feedback text. Confirm existing flows without text still work (direction only, no regression).

**Checkpoint**: User Story 3 complete — adjustment buttons carry feedback text through to generation

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, edge case handling

- [x] T022 Run full test suite with `npm test` — all 323+ tests must pass
- [x] T023 Run through quickstart.md validation scenarios 1-7 — verify end-to-end
- [x] T024 Remove redundant "ALWAYS call list_feedback_history" from `TEACHER_SYSTEM_PROMPT` and `getRegenerateSystemPrompt`/`getBridgingSystemPrompt` in `src/ai/teacher.ts` — the tool remains registered but system prompts no longer claim it's required (since summary is now injected programmatically)
- [x] T025 [P] Handle edge case from spec: if feedback text exceeds `MAX_FEEDBACK_TEXT` (2000 chars), the existing validation in `validateFeedback` catches it — verify this path works with the inline textarea and returns a user-friendly error
- [x] T026 [P] Handle edge case from spec: generator should handle `listLessonFeedback` returning empty array (no feedback yet) gracefully — `buildFeedbackSummary` should return a note that no feedback exists and default difficulty should be used

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify baseline immediately
- **Foundational (Phase 2)**: Depends on Setup — `buildFeedbackSummary` is a new file, safe to create
- **User Story 1 (Phase 3)**: Depends on Foundational only for context; technically independent (no imports from T003). Can start in parallel with Phase 2.
- **User Story 2 (Phase 4)**: Depends on Foundational (T003 `buildFeedbackSummary`). Independent of US1 — can start before US1 finishes.
- **User Story 3 (Phase 5)**: Depends on US1 (T005, T006 for feedback text availability in the bar) and Foundational (T003). Can partially start after Foundational.
- **Polish (Phase 6)**: Depends on all desired user stories complete

### User Story Dependencies

```
Phase 1 (Setup)
    │
Phase 2 (Foundational: buildFeedbackSummary)
    │
    ├── Phase 3 (US1: Inline Textarea) ──┐
    │       │                             │
    │       └── Phase 5 (US3: Carry ──────┘
    │              Feedback Forward)
    │
    └── Phase 4 (US2: Feedback Injection)
```

- **US1 and US2 are independent** — can be implemented in parallel
- **US3 depends on US1** — needs the inline textarea and feedback text from the bar

### Within Each User Story

- Views before routes (UI fragment defines what data the route receives)
- Core implementation before verification
- [P] tasks within a phase can run in parallel

### Parallel Opportunities

- **Phase 2**: Single task (T003)
- **Phase 3**: T004 and T005 can run in parallel (different functions in same file, but independent). T007 parallel with T006.
- **Phase 4**: T009-T016 — all 8 generator config updates are independent of each other (different GenerationConfig closures). T009 blocks T010 (same config), but T009+T010 can run parallel with T011+T012, etc.
- **Phase 5**: T018 (view) then T019 + T020 (routes, parallel)
- **Phase 6**: T024, T025, T026 all parallel

---

## Parallel Example: Phase 4 (US2)

```bash
# All config pairs are independent — launch together:
Task: "T009+T010: Update generateNext config in src/lessons/generator.ts"
Task: "T011+T012: Update generateSubLesson config in src/lessons/generator.ts"
Task: "T013+T014: Update generateRegenerate config in src/lessons/generator.ts"
Task: "T015+T016: Update generateBridging config in src/lessons/generator.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004-T008)
4. **STOP and VALIDATE**: Test inline textarea with manual scenarios
5. Deploy/demo if ready — students can now provide text feedback

### Full Delivery (Recommended)

1. Setup + Foundational (T001-T003)
2. US1 + US2 in parallel (they don't share files):
   - US1: T004-T008 (inline textarea)
   - US2: T009-T017 (feedback injection)
3. US3: T018-T021 (carry feedback to adjustments)
4. Polish: T022-T026

### Incremental Deployment

1. Deploy US1 → students can type feedback after rating
2. Deploy US2 → feedback actually shapes future lessons
3. Deploy US3 → adjustment buttons use the feedback text
4. Each deploy adds value without breaking previous work
