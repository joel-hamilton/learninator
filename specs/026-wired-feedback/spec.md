# Feature Specification: Wired Feedback

**Feature Branch**: `026-wired-feedback`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Make lesson difficulty feedback actually work end-to-end. Currently, when a student rates a lesson 'Too easy', 'Just right', or 'Too hard', the rating is saved to the DB but the AI must voluntarily call list_feedback_history to use it — there's no programmatic enforcement. Also, there's no way to give free-text feedback from the rating buttons; text feedback only exists in a separate modal flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate a Lesson and Explain Why (Priority: P1)

A student finishes reading a lesson and finds it too difficult. They click "Too hard" in the feedback bar. Instead of a silent "Thanks!" confirmation, a small inline textarea appears: "What made it too hard?" They type a quick note ("The recursion examples went over my head, I need more basics first") and press Enter. The feedback is saved — both the rating and the explanation — and the action buttons remain visible below.

**Why this priority**: This is the core interaction. Free-text feedback is the only feedback that reliably reaches generation prompts today. Making it easy to provide (inline, one keystroke, no modal) increases the odds students will actually give it. Without text feedback, calibration is guesswork.

**Independent Test**: Can be fully tested by viewing an active lesson, clicking a difficulty rating, typing text in the inline textarea, submitting, and verifying both the rating and text are persisted. Delivers value even without the generation injection (User Story 3).

**Acceptance Scenarios**:

1. **Given** a student is viewing an active lesson with the feedback bar visible, **When** they click "Too hard", **Then** the feedback row expands to show an inline textarea labeled "What made it too hard?" and the rating button group is replaced with the selected rating highlighted.
2. **Given** the inline textarea is visible after clicking a rating, **When** the student types an explanation and presses Enter (or clicks a submit button), **Then** both the rating and the text are saved via the existing feedback endpoint, and the textarea collapses into a confirmation showing the rating and a preview of the text.
3. **Given** the inline textarea is visible, **When** the student clicks a different rating button (e.g., switches from "Too hard" to "Just right"), **Then** the textarea updates its label to match ("What made it just right?") and any already-typed text is preserved.
4. **Given** the inline textarea is visible, **When** the student submits without typing any text, **Then** the rating is saved without text (same behavior as current silent confirmation, but the confirmation is now visible).

---

### User Story 2 - Feedback Shapes the Next Lesson Automatically (Priority: P1)

A student has rated three lessons as "too hard" with explanations like "too much math notation" and "needs more concrete examples." When they click "New Lesson" or "More Like This," the generator automatically includes their full feedback history in the prompt — the AI doesn't have to remember to look it up. The next lesson is measurably adjusted: simpler language, fewer equations, worked examples. The student notices the difference without having to re-explain their preferences.

**Why this priority**: This is the whole point of collecting feedback. If feedback doesn't change what gets generated, the feature is cosmetic. Programmatic injection guarantees calibration happens regardless of AI model compliance.

**Independent Test**: Can be tested by seeding feedback history for a mission (e.g., three "too hard" ratings with text), triggering any generation path, and inspecting the prompt sent to the AI to verify feedback history is present. Then verify the generated lesson content reflects the feedback (simpler language, adjusted difficulty).

**Acceptance Scenarios**:

1. **Given** a mission has lesson feedback history (ratings + text), **When** the student triggers "New Lesson" (or "More Like This", "Continue Learning", "Dive Deeper"), **Then** the generation prompt includes a structured summary of all past feedback — ratings, text, and which lessons they apply to — without requiring the AI to call `list_feedback_history`.
2. **Given** a mission has no feedback history yet, **When** a generation is triggered, **Then** the prompt includes a note that no feedback exists yet and the AI should use default difficulty.
3. **Given** a student has consistently rated lessons "too hard", **When** the next lesson is generated, **Then** the AI prompt explicitly instructs simpler explanations, more scaffolding, and foundational prerequisites.
4. **Given** feedback text mentions specific topics ("the section on closures was confusing"), **When** the next lesson is generated, **Then** that text is injected into the prompt so the AI can address the specific gap.

---

### User Story 3 - Adjustment Buttons Carry Feedback Forward (Priority: P2)

A student rates a lesson "too hard" and types "The diagrams didn't make sense." They then click "Make Easier" to regenerate the lesson at lower difficulty. Their text feedback is included in the regeneration prompt, so the AI knows to not only simplify but specifically improve the diagrams. The regenerated lesson addresses both the difficulty level and the specific complaint.

**Why this priority**: The adjustment buttons ("Make Harder", "Make Easier", "Bridge First") are the immediate follow-up to rating. They should carry the student's explanation forward so the adjustment addresses the specific issue, not just the difficulty level.

**Independent Test**: Rate a lesson "too hard" with text feedback, click "Make Easier", and verify the regeneration prompt includes both the `direction: "easier"` parameter and the feedback text.

**Acceptance Scenarios**:

1. **Given** a student has just submitted a "too hard" rating with text "too much jargon", **When** they click "Make Easier", **Then** the regeneration prompt includes both `direction: "easier"` and the feedback text "too much jargon".
2. **Given** a student submits a rating without text, **When** they click an adjustment button, **Then** the adjustment proceeds with only the direction parameter (current behavior preserved, no regression).
3. **Given** a student clicks "Bridge First", **When** the bridging lesson is generated, **Then** the feedback text and rating are included in the prompt so the bridge addresses the specific difficulty gap.

---

### Edge Cases

- What happens when a student types feedback text but never submits it, then clicks "Mark Complete"? The unsaved text should be submitted with the last selected rating before the completion action fires.
- What happens when a student rapidly switches between ratings and types text? Each rating change updates the pending rating but preserves the typed text; only the final submit persists to the DB.
- What happens when feedback text exceeds the 2,000 character limit? The existing `MAX_FEEDBACK_TEXT` limit applies; show an inline validation message if exceeded.
- What happens when a generation is triggered from the completed-lesson bar (after marking complete)? The feedback from the just-completed lesson must be included in the prompt.
- What happens when feedback history includes mixed ratings (some too hard, some too easy)? The prompt should summarize the pattern rather than forcing a single direction — the AI can calibrate per-topic.
- What happens when a mission has 20+ lessons with feedback? Summarize the most recent N ratings (last 5) and note any long-term trend.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an inline textarea after a student clicks a difficulty rating button, labeled with a context-specific prompt ("What made it too easy/hard?" for extreme ratings, "What worked well?" for "just right").
- **FR-002**: System MUST allow the student to submit the textarea by pressing Enter or clicking a submit button, and MUST allow submission with empty text (text is optional).
- **FR-003**: System MUST save both the rating and the optional feedback text via the existing `updateLessonFeedback` store method in a single submission.
- **FR-004**: System MUST preserve typed text in the textarea if the student switches to a different rating before submitting.
- **FR-005**: System MUST programmatically inject a structured feedback summary into every generation prompt (next lesson, sub-lesson, regeneration, bridging) — the AI MUST NOT need to call `list_feedback_history` for calibration to occur. The tool remains available for deeper analysis but is no longer the sole path to calibration.
- **FR-006**: The injected feedback summary MUST include: each lesson's number and title, its rating, its feedback text (if any), and a trend summary (e.g., "3 of last 5 rated too hard").
- **FR-007**: System MUST inject the current lesson's just-submitted rating and feedback text into any immediately following generation (regeneration, bridging, next lesson triggered from the same bar).
- **FR-008**: The existing adjustment buttons ("Make Harder", "Make Easier", "Bridge First") MUST include the feedback text in their generation prompts when text was submitted in the same session.
- **FR-009**: System MUST keep the existing three rating values unchanged (`too_easy`, `just_right`, `too_hard`) and the existing `feedbackText` column — no schema migration required.
- **FR-010**: The inline textarea and feedback flow MUST show immediate visible feedback (htmx-request class, loading indicator) consistent with the project's immediate feedback principle.
- **FR-011**: The `completedLessonBar` actions ("Continue Learning", "Dive Deeper") MUST also carry any feedback submitted before the lesson was marked complete.

### Key Entities

- **Lesson Feedback**: A rating (`too_easy` / `just_right` / `too_hard`) plus optional free-text explanation, tied to a specific lesson within a mission. Already exists in the schema — no changes needed.
- **Feedback Summary**: A structured prompt injection derived from the mission's feedback history, containing per-lesson ratings and text plus a trend analysis. This is computed at generation time, not persisted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students can submit a difficulty rating with explanatory text in under 15 seconds (measured from rating click to submission confirmation).
- **SC-002**: 100% of generation prompts include feedback history injection — verification is a programmatic guarantee, not a probability.
- **SC-003**: Lessons generated after consistent "too hard" feedback contain measurably simpler language (shorter sentences, fewer advanced terms) compared to lessons generated with no feedback or "too easy" feedback.
- **SC-004**: Students who provide text feedback receive lessons that address their specific concerns at least 70% of the time (judged by whether the AI's response references the feedback text).
- **SC-005**: No existing feedback flows regress — existing tests pass, existing rating buttons still work, and the feedback modal for the "New Lesson" flow continues to function.

## Assumptions

- The existing `lessons` table schema (`feedbackRating` and `feedbackText` columns) is sufficient and requires no changes.
- The existing `updateLessonFeedback` and `listLessonFeedback` store methods are sufficient; the new behavior is in how their data is used at generation time.
- The `LessonGenerator` class and its four generation methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) are the correct injection points for feedback summaries.
- The inline textarea replaces the current silent "Thanks!" confirmation in `feedbackThanksBar` but the adjustment buttons and action buttons remain in the same bar below it.
- Students will provide meaningful text feedback at least some of the time; the textarea is optional to avoid forcing input.
