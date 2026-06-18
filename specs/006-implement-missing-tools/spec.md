# Feature Specification: Implement Missing AI Tools

**Feature Branch**: `006-implement-missing-tools`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Fix missing AI tool implementations for list_feedback_history and regenerate_lesson"

## User Scenarios & Testing

### User Story 1 - AI Teacher Uses Feedback History (Priority: P1)

The AI teacher wants to gauge the student's demonstrated difficulty level before creating new lessons. It calls `list_feedback_history` to see how past lessons were rated and adjusts its teaching approach accordingly.

**Why this priority**: Without this tool, the AI cannot see lesson feedback and therefore cannot calibrate difficulty. The system prompt explicitly instructs the AI to use this tool.

**Independent Test**: Can be fully tested by calling the `list_feedback_history` tool on a mission with and without lessons that have feedback ratings.

**Acceptance Scenarios**:

1. **Given** a mission with no lessons, **When** the AI calls `list_feedback_history`, **Then** the tool returns a message indicating no feedback is available.
2. **Given** a mission with lessons that have feedback ratings and text, **When** the AI calls `list_feedback_history`, **Then** the tool returns a formatted summary of all lesson feedback ordered by lesson number.
3. **Given** a mission with lessons that have no feedback (null), **When** the AI calls `list_feedback_history`, **Then** those lessons are still listed but with no rating shown.

---

### User Story 2 - AI Teacher Regenerates Lessons (Priority: P1)

The AI teacher wants to update an existing lesson's content to adjust difficulty after receiving student feedback. It calls `regenerate_lesson` with a new title, slug, and HTML content to replace the lesson in-place.

**Why this priority**: Without this tool, the AI cannot modify existing lesson content to adjust difficulty. The system prompt and helper functions explicitly generate calls to this tool.

**Independent Test**: Can be fully tested by calling `regenerate_lesson` on an existing lesson and verifying the content is updated.

**Acceptance Scenarios**:

1. **Given** a mission with an existing lesson, **When** the AI calls `regenerate_lesson` with a valid lesson number, new title, slug, and HTML content, **Then** the lesson's title, slug, and HTML content are updated and a success message is returned.
2. **Given** a mission with no lesson at the specified number, **When** the AI calls `regenerate_lesson` with a non-existent lesson number, **Then** the tool returns an error message indicating the lesson was not found.
3. **Given** a mission with an existing sub-lesson, **When** the AI calls `regenerate_lesson` targeting the sub-lesson, **Then** the sub-lesson's content is updated.

---

### Edge Cases

- What happens when `regenerate_lesson` is called with a lesson number that doesn't exist in the mission? An error message should be returned.
- What happens when `list_feedback_history` is called with no lessons? It returns "No feedback yet."
- What happens when lessons exist but have null feedback fields? They are listed without rating/text.

## Requirements

### Functional Requirements

- **FR-001**: The store layer MUST provide a `listLessonFeedback(missionId)` method that returns lesson summaries including feedbackRating and feedbackText.
- **FR-002**: The store layer MUST provide an `updateLessonContent(missionId, number, subNumber, title, slug, htmlContent)` method that updates an existing lesson's content in-place.
- **FR-003**: The `list_feedback_history` tool handler MUST call `store.listLessonFeedback()` and return a formatted human-readable summary.
- **FR-004**: The `regenerate_lesson` tool handler MUST validate the lesson exists before calling `store.updateLessonContent()`.
- **FR-005**: Both tool handlers MUST be registered in `TOOL_DISPLAY_NAMES` with friendly display names.
- **FR-006**: Both tool handlers MUST be registered in `buildHandlerMap()` so the tool executor can dispatch to them.
- **FR-007**: Both `DrizzleMissionStore` and `InMemoryMissionStore` implementations MUST implement the new methods.
- **FR-008**: Tests MUST cover: empty feedback, feedback with ratings, lesson regeneration, and regeneration on a non-existent lesson.

### Key Entities

- **Lesson**: Contains number, subNumber, title, slug, htmlContent, status, feedbackRating, feedbackText, completedAt. Already has feedbackRating (too_easy/just_right/too_hard) and feedbackText columns.

## Success Criteria

### Measurable Outcomes

- **SC-001**: AI can successfully call `list_feedback_history` and receive formatted feedback data for any mission with lessons.
- **SC-002**: AI can successfully call `regenerate_lesson` to update lesson content in-place.
- **SC-003**: All 15 existing tests continue to pass after changes.
- **SC-004**: New test cases cover all acceptance scenarios for both tools.

## Assumptions

- The lessons table already has `feedbackRating` and `feedbackText` columns in the schema (confirmed).
- The `regenerate_lesson` tool updates only title, slug, and htmlContent — not the lesson number, subNumber, status, or feedback fields.
- The `list_feedback_history` tool returns lessons sorted by number then subNumber, matching the existing `listLessons` ordering.
- Both new tools follow the same patterns as the existing 15 tools in the codebase.
