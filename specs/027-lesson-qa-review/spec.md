# Feature Specification: Lesson QA Review

**Feature Branch**: `027-lesson-qa-review`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "I want to add another quality layer when the agent is generating a lesson. I've noticed some small mistakes in lessons, we should give it to another agent to improve and fix before finalizing and giving to the user"

## Clarifications

### Session 2026-06-20

- Q: How aggressive should the reviewer's mandate be? → A: Conservative — fix only clear-cut errors (typos, broken HTML, verifiably wrong facts). Do not alter writing style, prose clarity, examples, or pedagogical structure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic QA review catches mistakes before delivery (Priority: P1)

When a student completes a lesson and the system generates the next one, a second AI
pass reviews the freshly-generated content for errors before the student ever sees it.
The reviewer corrects factual mistakes, fixes formatting glitches, and verifies the
lesson is pedagogically sound. The student receives a polished, reviewed lesson without
any visible change to their experience — the review happens during the existing
generation progress indicator.

**Why this priority**: This is the core of the feature. Every lesson generation path
benefits from a review pass. Without it, students encounter avoidable errors that
undermine trust in the tutor.

**Independent Test**: Queue lesson generation for any mission. When generation completes,
verify the stored lesson content differs from what the initial generation produced
(in cases where the reviewer found issues). Verify the delivered lesson contains no
factual errors that were present in the draft.

**Acceptance Scenarios**:

1. **Given** a student just completed Lesson 1 and the system is generating Lesson 2,
   **When** the initial AI generates lesson content containing a small factual error,
   **Then** the reviewer AI detects and corrects the error before the lesson is saved,
   and the student sees the corrected version.
2. **Given** a student is waiting for lesson generation,
   **When** the QA review step runs,
   **Then** the generation progress indicator continues showing activity (the student doesn't
   stare at a frozen screen and isn't aware a separate review is happening).
3. **Given** the initial AI generates a lesson with no errors,
   **When** the reviewer AI examines it,
   **Then** the reviewer approves it unchanged and the lesson is delivered without unnecessary modification.

---

### User Story 2 - Reviewer fixes formatting and structural issues (Priority: P2)

The reviewer checks that lesson HTML is well-formed and properly structured: headings
are at the right level, code blocks are syntax-highlighted correctly, images and diagrams
render properly, and the lesson layout matches the expected format. The reviewer can
edit the HTML directly to fix these issues without changing the lesson's core content
or pedagogical approach.

**Why this priority**: Formatting issues are the most common type of mistake and degrade
the learning experience even when the content is factually correct.

**Independent Test**: Generate a lesson with intentional formatting issues (malformed
HTML, broken code blocks). Confirm the reviewer corrects them before storage.

**Acceptance Scenarios**:

1. **Given** a generated lesson has a malformed HTML table,
   **When** the reviewer examines the lesson,
   **Then** the reviewer corrects the HTML structure while preserving the table's content.
2. **Given** a generated lesson has inconsistent heading levels (e.g., jumps from h2 to h4),
   **When** the reviewer examines the lesson,
   **Then** the reviewer normalizes the heading hierarchy.

---

### User Story 3 - Reviewer handles all generation paths (Priority: P1)

The QA review step applies to every lesson creation path: next lesson generation,
sub-lesson generation ("Dive Deeper"), lesson regeneration (harder/easier), and
bridging sub-lessons. All paths produce reviewed content before the student sees it.

**Why this priority**: Partial coverage creates inconsistent quality. Students notice
when some lessons are polished and others have errors.

**Independent Test**: Trigger each generation path (next, sub, regenerate, bridge)
and verify the QA review step runs for each. Use test assertions to confirm the
reviewer prompt includes the appropriate context for each path.

**Acceptance Scenarios**:

1. **Given** a student requests a "Dive Deeper" sub-lesson,
   **When** the sub-lesson is generated,
   **Then** the QA reviewer examines it before it appears in the lesson list.
2. **Given** a student rated a lesson as "too hard" and requested regeneration,
   **When** the regenerated lesson is created,
   **Then** the QA reviewer examines it before delivery.
3. **Given** A bridging sub-lesson is being generated,
   **When** the content is created,
   **Then** The reviewer examines it before finalization.

---

### Edge Cases

- What happens when the reviewer AI itself produces an error or times out? The system
  should fall back to delivering the original (unreviewed) lesson rather than blocking
  delivery entirely.
- What happens when the reviewer makes the lesson worse? The system should compare the
  original and reviewed versions — if the review introduces critical regressions
  (e.g., removes all content), fall back to the original.
- What happens if the initial generation creates no content (empty lesson)? The
  reviewer should detect this and the system should trigger a retry rather than
  delivering an empty lesson.
- What happens if the review step takes too long? A reasonable time limit should apply;
  if exceeded, deliver the original content with a note that review was skipped.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run a second AI review pass on all generated lesson content before saving and delivering it to the user.
- **FR-002**: The reviewer MUST correct only clear-cut, verifiable errors: typos, broken HTML, and factually incorrect statements. It MUST NOT alter writing style, prose clarity, examples, or pedagogical approach.
- **FR-003**: The reviewer MUST NOT alter the lesson's core structure (lesson number, title, section count, topic ordering) unless correcting a verifiable error in those elements.
- **FR-004**: System MUST apply the QA review to all four generation paths: next lesson, sub-lesson (Dive Deeper), regeneration (harder/easier), and bridging sub-lesson.
- **FR-005**: System MUST show continued generation progress during the review step so users are not left staring at an unchanged screen.
- **FR-006**: System MUST fall back to delivering the original (unreviewed) lesson if the review step fails, times out, or produces an empty result.
- **FR-007**: The reviewer MUST receive context about the mission, the student's progress, and the lesson's purpose so it can evaluate content appropriately.
- **FR-008**: System MUST log when the reviewer makes corrections versus when it passes content through unchanged, for quality monitoring.

### Key Entities

- **QA Review Result**: The outcome of the review pass — includes whether corrections were made, what was changed, and a confidence assessment. Tied to a specific lesson generation job.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 90% or more of generated lessons pass through QA review without introducing regressions (i.e., the reviewer doesn't break content that was already correct).
- **SC-002**: Lesson generation time increases by no more than 30% on average due to the review step (students shouldn't notice a meaningful slowdown).
- **SC-003**: User-reported factual errors in lessons decrease by at least 50% after the QA review layer is active.
- **SC-004**: No lesson is delivered to a student with the review step having failed silently — every failure is either recovered via fallback or logged visibly for operators.

## Assumptions

- The reviewer AI uses the same AI model and provider as the generation step. No separate model or provider configuration is needed.
- The reviewer AI can use read-only access to the same mission context (existing lessons, references, mission metadata) that the generating AI had, to evaluate correctness.
- The review step runs sequentially after generation within the same background job — not as a separate async process. This keeps the existing polling-based job status model intact.
- The review prompt is fixed (not user-configurable). Tuning the reviewer's behavior is done through prompt engineering, not UI controls.
- The existing generation progress bar in the UI provides sufficient visibility for the review step without new UI elements.
