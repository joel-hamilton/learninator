# Feature Specification: Post-Lesson Navigation

**Feature Branch**: `008-post-lesson-navigation`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "I'm not happy with the post-lesson options. The mark complete/new-lesson/more-on-this things aren't intuitive. Sometimes it creates a new lesson, sometimes a sub-lesson, sometimes there are options to give feedback to nudge the next lesson in a certain direction, and sometimes there aren't. Let's figure out a better way to do all this stuff in the spec."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a Lesson and Choose Next Step (Priority: P1)

A student finishes reading a lesson. They see a clear, predictable set of options for what to do next. Each option does exactly what it says — no surprises about whether a new main lesson or a sub-lesson gets created. The student confidently picks their next step and the system responds immediately with visible feedback.

**Why this priority**: This is the core loop. Every student hits this decision point after every lesson. Confusion here undermines the entire learning experience.

**Independent Test**: Can be fully tested by completing any lesson and verifying that the post-completion options are shown, each option triggers the correct action, and loading feedback appears immediately.

**Acceptance Scenarios**:

1. **Given** a student is viewing an active lesson, **When** they click "Mark Complete", **Then** the lesson status changes to completed, and a clear "What's next?" section appears with predictable options.
2. **Given** a completed lesson with "What's next?" options visible, **When** the student clicks "Continue Learning", **Then** a new main lesson is always created (never a sub-lesson) and the student is taken to it.
3. **Given** a completed lesson with "What's next?" options visible, **When** the student clicks "Dive Deeper", **Then** a sub-lesson is always created under the current lesson topic and the student is taken to it.
4. **Given** a completed lesson with "What's next?" options visible, **When** the student clicks "Explore Something New", **Then** they enter a guided flow to pick a new topic direction.

---

### User Story 2 - Give Feedback During a Lesson (Priority: P2)

While working through a lesson, a student can quickly indicate whether the difficulty level feels right. If the lesson is too hard or too easy, they can request an adjusted version immediately without leaving the lesson. The feedback they provide also helps the AI calibrate future lessons for their mission.

**Why this priority**: In-lesson feedback improves the current lesson and future ones. It's a secondary flow to the main completion loop but directly impacts learning quality.

**Independent Test**: Can be tested by viewing an active lesson, submitting a difficulty rating, and verifying that adjustment options appear for non-"just right" ratings.

**Acceptance Scenarios**:

1. **Given** a student is viewing an active lesson, **When** they rate it "Just Right", **Then** a brief confirmation appears and the rating is recorded for the AI.
2. **Given** a student is viewing an active lesson, **When** they rate it "Too Hard", **Then** options to "Make This Easier" or "Add a Bridging Lesson" appear immediately.
3. **Given** a student is viewing an active lesson, **When** they rate it "Too Easy", **Then** an option to "Make This Harder" appears immediately.
4. **Given** a student requests a difficulty adjustment, **When** the adjustment is generated, **Then** it replaces the current lesson content (not creating a new lesson record) and the student sees the loading indicator throughout.

---

### User Story 3 - AI Uses Feedback to Shape Future Lessons (Priority: P3)

The AI teacher takes the student's feedback history into account when generating new lessons. A student who consistently marks lessons as "too easy" gets more challenging material. A student who marks lessons as "too hard" gets more scaffolding. This happens automatically — the student doesn't need to repeat their preferences.

**Why this priority**: This is the "smart" behavior that differentiates the app from static content. It's valuable but depends on the feedback collection working first.

**Independent Test**: Can be tested by seeding feedback history (e.g., three "too hard" ratings) and verifying that the next generated lesson includes simpler language or more foundational content.

**Acceptance Scenarios**:

1. **Given** a student has rated the last three lessons as "too hard", **When** the next lesson is generated, **Then** the AI is prompted to use simpler explanations and more scaffolding.
2. **Given** a student has consistently rated lessons "too easy", **When** the next lesson is generated, **Then** the AI is prompted to increase depth and complexity.
3. **Given** a student has mixed ratings, **When** the next lesson is generated, **Then** the AI is prompted to maintain the current difficulty level.

---

### Edge Cases

- What happens when a student submits feedback and then immediately marks the lesson complete? The feedback should still be recorded and applied to future lessons.
- What happens when "Dive Deeper" is clicked on a sub-lesson (e.g., lesson 0003.1)? It should create another sub-lesson (0003.2) under the same parent.
- What happens when a generation job fails (AI timeout, error)? The student should see a clear error message with a "Try Again" option, not a broken state.
- What happens when a student clicks multiple "Continue Learning" buttons rapidly? The system should prevent duplicate generation jobs for the same lesson.
- What happens when a student marks a lesson incomplete after completing it? The post-completion options should hide and the in-progress view should restore.
- What happens when there's an active generation job and the student navigates away? The job should still complete and the new lesson should appear in the mission's lesson list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present a clear, visually distinct "What's next?" section after a lesson is marked complete, separate from the in-lesson feedback controls.
- **FR-002**: System MUST provide a "Continue Learning" action that always creates a new main lesson (next sequential number), never a sub-lesson.
- **FR-003**: System MUST provide a "Dive Deeper" action that always creates a sub-lesson under the current lesson's parent topic, never a new main lesson.
- **FR-004**: System MUST provide an "Explore Something New" action that initiates a guided topic exploration flow for the student.
- **FR-005**: System MUST allow students to rate lesson difficulty (too easy / just right / too hard) while the lesson is in progress, without requiring completion first.
- **FR-006**: System MUST offer immediate difficulty adjustment options ("Make Easier", "Make Harder", "Add Bridging Lesson") when a student indicates the lesson is too hard or too easy.
- **FR-007**: Difficulty adjustment actions MUST replace the current lesson content in-place rather than creating a new lesson record.
- **FR-008**: System MUST record all difficulty ratings and make them available to the AI when generating subsequent lessons for the same mission.
- **FR-009**: All actions that trigger AI generation (Continue Learning, Dive Deeper, Make Easier, Make Harder, Bridging) MUST show immediate loading feedback via the existing polling bar pattern.
- **FR-010**: System MUST prevent duplicate generation jobs for the same lesson (e.g., rapid double-clicks).
- **FR-011**: System MUST show a clear error state with retry option when a generation job fails.
- **FR-012**: "Mark Incomplete" MUST restore the in-progress view with feedback controls, reversing the completion state.

### Key Entities

- **Lesson**: Represents a single teaching unit. Has a number (main sequence), optional sub-number (for deep-dives), status (active/in_progress/completed), difficulty rating, and feedback text.
- **Feedback Record**: A student's difficulty rating (too_easy/just_right/too_hard) and optional free-text notes tied to a specific lesson. Used by the AI to calibrate future lesson generation.
- **Generation Job**: An asynchronous AI task that creates or regenerates lesson content. Has a status (running/done/error), a result (new lesson ID or replacement content), and an expiry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students can identify their next action after completing a lesson in under 3 seconds (measured by time from completion to clicking a next-step button).
- **SC-002**: 100% of "Continue Learning" actions result in a new main lesson (predictability guarantee).
- **SC-003**: 100% of "Dive Deeper" actions result in a sub-lesson (predictability guarantee).
- **SC-004**: Students who provide difficulty ratings receive AI-calibrated lessons that reflect their feedback history within the same mission.
- **SC-005**: No dead buttons — every visible action triggers a working flow with immediate loading feedback.
- **SC-006**: Generation job failures show a recovery path (retry) within 2 seconds of the failure.

## Assumptions

- The existing polling bar pattern (generationPollingBar/generationRunningBar/generationDoneBar/generationErrorBar) will be reused for all AI generation actions.
- The `LessonGenerator` class in `src/lessons/generator.ts` (currently unwired) contains the building blocks for the new generation flows and will be connected to route handlers.
- The existing `create_lesson` and `create_sub_lesson` AI tools are correct and the spec only changes when and how they are invoked.
- The feedback modal (`mode=more`) for the chat panel's "More on this topic" quick chip is a separate concern (chat-based exploration) and is out of scope for this feature.
- The sidebar chat panel and its quick-action chips are not modified by this feature.
- Lesson content regeneration (Make Easier/Harder/Bridging) replaces content in-place rather than creating new lesson records, which means the existing lesson's `number` and `subNumber` stay the same.
