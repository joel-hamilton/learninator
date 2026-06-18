# Research: Implement Missing AI Tools

## Overview

No external research needed. All patterns are well-established within the existing codebase.

## Existing Patterns

### Store Layer Patterns

- `listLessonSummaries()` in `DrizzleMissionStore` uses `this.db.select({...}).from(schema.lessons).where(...)` with specific column selection. This is the template for `listLessonFeedback()` which adds `feedbackRating` and `feedbackText`.

- `updateLessonFeedback()` in `DrizzleMissionStore` uses `this.db.update(schema.lessons).set(...).where(and(...))`. This is the template for `updateLessonContent()`.

- `InMemoryMissionStore` mirrors every `DrizzleMissionStore` method using in-memory array manipulation.

### Tool Handler Patterns

- Each handler is an async function taking `ToolHandlerContext` and returning a string.
- Response messages follow the format shown in existing handlers (e.g., `Created lesson 0001: "Title"`).
- Registration requires entries in both `TOOL_DISPLAY_NAMES` and `buildHandlerMap()`.

### Lesson Number Formatting

- All existing handlers use `String(num).padStart(4, "0")` for display.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| listLessonFeedback type | `LessonFeedbackSummary` extending `listLessonSummaries` with feedback fields | Follows existing `LessonSummary` pattern |
| updateLessonContent approach | Reuses Drizzle's `update` with `and()` conditions | Same pattern as `updateLessonFeedback` and `updateLessonStatus` |
| Sub-lesson support in regenerate | Supports subNumber parameter | The existing `updateLessonStatus` and `updateLessonFeedback` methods support subNumber |
| Tool response format | Plain text (not JSON) | Matches existing tool handler pattern |
