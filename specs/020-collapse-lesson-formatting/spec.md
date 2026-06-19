# Feature Specification: Collapse Duplicate Lesson Formatting

**Feature Branch**: `020-collapse-lesson-formatting`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Collapse duplicate lesson formatting - two pure functions formatLessonNumber and lessonIdStr are duplicated across three files. Hoist into a shared module."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer maintains lesson number formatting (Priority: P1)

A developer needs to change how lesson numbers are displayed (e.g., changing zero-padding width or sub-lesson separator). Currently the formatting logic is duplicated in three files, so the developer must find and update every copy. After this change, the developer edits one shared function and all call sites pick up the change automatically.

**Why this priority**: This is the sole value of the feature. Every future formatting change is safer and faster.

**Independent Test**: The refactored functions produce identical output to the originals for every input value.

**Acceptance Scenarios**:

1. **Given** a codebase with duplicate `formatLessonNumber` and `lessonIdStr` definitions, **When** a developer changes the formatting in the shared module, **Then** all views and the lesson generator use the new format.
2. **Given** the shared module exports both functions, **When** either function is called, **Then** it returns the same value as the original duplicated versions for all inputs.

---

### User Story 2 - Tests validate formatting edge cases (Priority: P1)

A developer wants to verify that lesson number formatting handles all edge cases correctly. Tests for both functions exist in a single location covering single-digit, double-digit, sub-lesson, and null-sub scenarios.

**Why this priority**: Tests are essential for a refactoring — they provide confidence that no behavior changed.

**Independent Test**: Running the test suite confirms all formatting behaviors are preserved.

**Acceptance Scenarios**:

1. **Given** the test suite, **When** tests for `formatLessonNumber` are run, **Then** all edge cases pass (single digit, double digit, with sub-lesson, null sub).
2. **Given** the test suite, **When** tests for `lessonIdStr` are run, **Then** all edge cases pass (single digit, double digit, with sub-lesson, null sub).

---

### Edge Cases

- What happens when `num` is 0? The function pads to 4 digits, producing "0000".
- What happens when `sub` is 0 (not null)? The sub-lesson is appended: "0001.0".
- What happens when `num` is a multi-digit number (e.g., 99 or 1234)? `padStart` only pads up to 4 characters, so numbers with 4+ digits render without padding.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A shared module `src/shared/lesson-numbers.ts` MUST export both `formatLessonNumber(num: number, sub: number | null): string` and `lessonIdStr(number: number, subNumber: number | null): string`.
- **FR-002**: `formatLessonNumber` MUST zero-pad the lesson number to 4 digits and append a dot-separated sub-lesson number when `sub` is not null (e.g., `formatLessonNumber(1, null)` returns `"0001"`, `formatLessonNumber(12, 3)` returns `"0012.3"`).
- **FR-003**: `lessonIdStr` MUST return the un-padded number with a dot-separated sub-lesson suffix when `subNumber` is not null (e.g., `lessonIdStr(1, null)` returns `"1"`, `lessonIdStr(12, 3)` returns `"12.3"`).
- **FR-004**: The duplicate definitions in `src/views/lesson.ts`, `src/views/fragments.ts`, and the private method in `src/lessons/generator.ts` MUST be removed, and their call sites MUST import from the new shared module instead.
- **FR-005**: Tests MUST cover both functions with the following inputs: single-digit number with null sub, single-digit number with sub, double-digit number with null sub, double-digit number with sub, and number with sub-lesson of 0.

### Key Entities *(include if feature involves data)*

*(No new domain entities. The feature involves only two pure functions and their test coverage.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After refactoring, all existing tests pass without modification.
- **SC-002**: `formatLessonNumber` and `lessonIdStr` each exist in exactly one source location (no duplicate definitions in the codebase).
- **SC-003**: Both functions have test coverage for all documented edge cases (single digit, double digit, sub-lesson, null sub, zero sub).

## Assumptions

- The exact behavior of both functions is defined by their current implementations — the refactoring preserves output for every input.
- No call sites exist outside the three identified files (`src/views/lesson.ts`, `src/views/fragments.ts`, `src/lessons/generator.ts`).
- The project's existing test infrastructure (Vitest, in-memory SQLite) is adequate for testing these pure functions — no new test dependencies are needed.
- The functions are not exported from their current locations (they are local/private), so no existing consumers outside these files rely on them.
