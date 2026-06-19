# Feature Specification: Hoist Duplicate parseLessonParam

**Feature Branch**: `022-hoist-lesson-param`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Hoist duplicate parseLessonParam into lesson-numbers.ts"

## User Scenarios & Testing *(mandatory)*

Note: This is a refactoring feature with no user-facing changes. The "user" here is the developer maintaining the codebase.

### User Story 1 - Eliminate duplicated parsing logic (Priority: P1)

A developer notices that the identical `parseLessonParam` function exists in two route files (`src/routes/lessons.ts` and `src/routes/lesson-generation.ts`). When they need to change how lesson parameters are parsed, they must update both copies — a maintenance burden and a source of drift. The function should live in one shared location, imported by both route files.

**Why this priority**: Duplicate code is the primary source of this feature. Eliminating it is the core value.

**Independent Test**: The function is imported from `src/shared/lesson-numbers.ts` in both route files, and all existing tests pass without modification.

**Acceptance Scenarios**:

1. **Given** the function `parseLessonParam` is defined in `src/shared/lesson-numbers.ts`, **When** both route files import and use it, **Then** the local definitions in `lessons.ts` and `lesson-generation.ts` are removed.
2. **Given** the refactored code, **When** the full test suite runs, **Then** all existing tests pass.

---

### User Story 2 - Correct parsing behavior for all valid lesson numbers (Priority: P2)

A developer relies on `parseLessonParam` to extract lesson number and optional sub-number from a route parameter string. The function must correctly handle all forms that lesson numbers take in the system.

**Why this priority**: Correctness of the parsing function is critical — any regression would break lesson viewing, generation, and navigation.

**Independent Test**: Unit tests for `parseLessonParam` are added that cover its edge cases, runnable independently via `npm test`.

**Acceptance Scenarios**:

1. **Given** a lesson number string like `"1"`, **When** `parseLessonParam` is called, **Then** it returns `{ number: 1, subNumber: null }`.
2. **Given** a lesson number string like `"1.2"`, **When** `parseLessonParam` is called, **Then** it returns `{ number: 1, subNumber: 2 }`.
3. **Given** a lesson number string like `"42"`, **When** `parseLessonParam` is called, **Then** it returns `{ number: 42, subNumber: null }`.
4. **Given** a lesson number string like `"42.7"`, **When** `parseLessonParam` is called, **Then** it returns `{ number: 42, subNumber: 7 }`.
5. **Given** a malformed input like `""` (empty string) or `"abc"`, **When** `parseLessonParam` is called, **Then** it returns `{ number: NaN, subNumber: null }` or similar degraded result without throwing.

### Edge Cases

- Empty string (`""`) — returns `NaN` for number, `null` for sub-number
- Only dot (`"."`) — `parseInt("")` yields `NaN`
- Multiple dots (`"1.2.3"`) — only first two segments are parsed; extra dots are ignored
- Non-numeric input (`"abc"`) — `parseInt` returns `NaN`
- Trailing dot (`"1."`) — `parts` is `["1", ""]`, sub-number is `NaN`
- Leading dot (`".1"`) — `parts` is `["", "1"]`, number is `NaN`

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `parseLessonParam` MUST be exported from `src/shared/lesson-numbers.ts`.
- **FR-002**: `src/routes/lessons.ts` MUST import `parseLessonParam` from `src/shared/lesson-numbers.ts` instead of defining it locally.
- **FR-003**: `src/routes/lesson-generation.ts` MUST import `parseLessonParam` from `src/shared/lesson-numbers.ts` instead of defining it locally.
- **FR-004**: The local `parseLessonParam` definition in `src/routes/lessons.ts` MUST be deleted.
- **FR-005**: The local `parseLessonParam` definition in `src/routes/lesson-generation.ts` MUST be deleted.
- **FR-006**: Unit tests for `parseLessonParam` MUST cover: single digit, double digit, with sub-number, without sub-number, empty string, non-numeric input, multiple dots.
- **FR-007**: All existing tests MUST continue to pass after the refactoring.

### Key Entities *(include if feature involves data)*

No new data entities. The function operates on string inputs and returns plain objects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `parseLessonParam` is defined in exactly one file (not counting tests).
- **SC-002**: Both route files import the shared function; zero local definitions remain.
- **SC-003**: All test cases for parsing edge cases pass in CI.
- **SC-004**: Zero behavioral changes — all existing lesson, generation, and navigation tests pass without modification.

## Assumptions

- The existing `formatLessonNumber` and `lessonIdStr` functions in `src/shared/lesson-numbers.ts` are an established pattern that `parseLessonParam` should follow.
- The function signature and behavior must be preserved exactly as-is — no behavioral changes.
- Tests will be written in the existing test infrastructure (Vitest, `src/test/`).
- No schema changes or database migrations are required.
