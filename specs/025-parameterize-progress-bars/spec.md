# Feature Specification: Parameterize Generation Progress Bars

**Feature Branch**: `025-parameterize-progress-bars`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Parameterize the 13 near-identical generation progress bar functions in src/views/fragments.ts. Currently there are 3 categories (next lesson with 5 states including missing, regeneration with 4 states, bridging with 4 states) = 13 functions, all structurally identical. They differ only in: header text, badge text, link colors, and whether they accept an isSub parameter. Extract a single parameterized function generationProgressBar(style: GenStyle, state: JobStatus, missionId: number, lesson: LessonInfo): string. Each generation type becomes one GenStyle config object. Export convenience wrappers (generateNextBar, regenerateBar, bridgingBar) that call the parameterized function with the right config so existing callers in src/routes/lesson-generation.ts don't need to change."

## User Scenarios & Testing

### User Story 1 - Developer Maintains Progress Bar Rendering (Priority: P1)

As a developer maintaining the lesson generation feature, I want to make a single change to the progress bar HTML template (e.g., updating the CSS class or badge color) and have all three generation types (next, regeneration, bridging) reflect that change, so that I don't need to update 13 separate functions for a single visual tweak.

**Why this priority**: This is the core value of the refactor — eliminating the maintenance burden of duplicated HTML templates.

**Independent Test**: A developer can change the badge text prefix in the single GenStyle config for "next" generation and verify that all five state functions (polling, running, done, error, missing) use the updated text without editing individual functions.

**Acceptance Scenarios**:

1. **Given** the current 13 generation bar functions, **When** a developer needs to change the badge color for regeneration bars, **Then** they only need to edit one config value rather than 4 separate regeneration functions.
2. **Given** a new generation type is needed (e.g., "review"), **When** a developer creates the feature, **Then** they only need to define one new GenStyle config object rather than 4-5 new functions.

---

### User Story 2 - All Existing Callers Work Without Changes (Priority: P1)

As a route handler developer, I want to call the same convenience wrapper names (`generationPollingBar`, `generationDoneBar`, etc.) that exist today, so that existing route handlers in lesson-generation.ts continue to work without modification.

**Why this priority**: The refactor must be a drop-in replacement. Changing call sites introduces risk and increases the scope of work.

**Independent Test**: A route handler that calls `generationPollingBar(missionId, number, subNumber, false)` produces identical HTML output before and after the refactor.

**Acceptance Scenarios**:

1. **Given** the refactored fragments.ts, **When** `renderJobStatus` in lesson-generation.ts calls `generationMissingBar(missionId)`, **Then** the response is identical to the current output.
2. **Given** the refactored fragments.ts, **When** the generate-next route calls `generationPollingBar(missionId, number, subNumber, false)`, **Then** the response is identical to the current output.
3. **Given** the refactored fragments.ts, **When** the regenerate route calls `regenerationPollingBar(missionId, number, subNumber)`, **Then** the response is identical to the current output.

---

### Edge Cases

- The `isSub` parameter is only relevant for "next" generation types (polling and running states). Other generation types and states must not accept or require this parameter.
- The `generationMissingBar` state only applies to "next" generation — regeneration and bridging types use error bars instead. The parameterized function must handle this gracefully.
- The done state bars differ only in link text and link color (`var(--rubric)` vs `var(--accent)`) between generation types.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST define a `GenStyle` configuration type that captures all per-generation-type differences: header text, badge text, link color, and whether `isSub` is applicable.
- **FR-002**: The system MUST provide a single parameterized `generationProgressBar` function that accepts a `GenStyle` config, a job status (polling/running/done/error/missing), a mission ID, and lesson info, and returns the correct HTML fragment.
- **FR-003**: The system MUST export convenience wrapper functions (`generateNextBar`, `regenerateBar`, `bridgingBar`) that call the parameterized function with the appropriate `GenStyle` config, matching the signatures of the current 13 exported functions.
- **FR-004**: The system MUST produce byte-identical HTML output for every call site currently in use, so that existing tests and route handlers continue to work without modification.
- **FR-005**: The system MUST NOT change the import interface in `lesson-generation.ts` — all existing named imports from `fragments.ts` must remain available.

### Key Entities

- **GenStyle**: A configuration object type that encapsulates the differences between generation types — header label, badge text, polling status endpoint suffix, link color CSS value, and whether the state supports `isSub`.
- **JobStatus**: A union type representing the possible states of a generation job: polling, running, done, error, missing.
- **LessonInfo**: A type describing a lesson by its identity (number, subNumber, title) for use in rendering done/error bars.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The 13 individual generation bar functions are replaced by exactly 1 parameterized function and 3 convenience wrappers (or fewer, if some non-identical functions remain).
- **SC-002**: All existing tests pass without modification.
- **SC-003**: All 13 call sites in `lesson-generation.ts` continue to work with zero import or call-site changes.
- **SC-004**: The rendered HTML for every state (polling, running, done, error, missing) across all three generation types (next, regeneration, bridging) is byte-identical to the current output.
- **SC-005**: Adding a new generation type in the future requires defining only 1 new `GenStyle` config object and its convenience wrapper, rather than 4-5 new functions.

## Assumptions

- The refactoring is limited to `src/views/fragments.ts` and does not require changes to CSS, backend job logic, or route handling.
- The existing function names exported from `fragments.ts` serve as the public API surface and must be preserved.
- No other files import these generation bar functions beyond `lesson-generation.ts`.
- The refactored code follows the project's existing patterns (template literals, no templating engine).
