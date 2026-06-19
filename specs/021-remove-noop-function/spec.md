# Feature Specification: Remove No-Op Function

**Feature Branch**: N/A (code cleanup, no branch needed)

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: Delete the `hideBannerOnSettle()` no-op function and all 6 call sites in `src/views/fragments.ts`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer encounters clean, navigable code (Priority: P1)

A developer reading `src/views/fragments.ts` will not encounter a function named `hideBannerOnSettle` that always returns an empty string, nor its 6 call sites that contribute nothing to the rendered HTML. The dead code scaffolding is removed, reducing cognitive load and eliminating a maintenance surface.

**Why this priority**: This is the entire value of the feature — improved code clarity. There are no other user-facing effects.

**Independent Test**: Search the codebase for the string `hideBannerOnSettle` and confirm zero results. Run the full test suite and confirm all tests pass. No view rendering is changed because the function always contributed an empty string.

**Acceptance Scenarios**:

1. **Given** the source file `src/views/fragments.ts`, **When** searching for the string `hideBannerOnSettle`, **Then** no results are returned.
2. **Given** the project test suite, **When** running all tests, **Then** all tests pass with no modifications required.

---

### User Story 2 - Future developer avoids misinterpretation (Priority: P2)

A future developer who encounters a call like `${hideBannerOnSettle()}` in a template string will not be misled into thinking the function has active banner-hiding behavior. Removing the scaffolding eliminates the suggestion of functionality that does not exist.

**Why this priority**: This is a secondary benefit of the cleanup. The primary benefit (reduced clutter) is captured by User Story 1.

**Independent Test**: Review all 6 locations in `src/views/fragments.ts` where `hideBannerOnSettle()` was called and confirm the template strings are clean — no empty interpolation expressions remain.

**Acceptance Scenarios**:

1. **Given** the 6 template strings that previously contained `${hideBannerOnSettle()}`, **When** inspecting their compiled HTML output, **Then** the output is identical to before the change.

---

### Edge Cases

- What if the function was called with arguments in the future? Not applicable — it was always called with zero arguments at all 6 existing call sites.
- What if a developer later needs banner-hiding behavior? That is a separate feature. The dead scaffolding should not be left in place as an invitation to implement the feature halfway.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `function hideBannerOnSettle(): string { return ""; }` definition MUST be removed from `src/views/fragments.ts`.
- **FR-002**: All 6 call sites (`hideBannerOnSettle()` inside template literal interpolations) MUST be removed — the empty string they contributed MUST NOT be replaced with anything.
- **FR-003**: All existing automated tests MUST continue to pass with zero modifications to test files.
- **FR-004**: The rendered HTML output MUST be identical to the pre-change output for all view functions.

### Key Entities

*None.* This feature involves no data, no new entities, and no schema changes. It is purely source code cleanup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -r hideBannerOnSettle src/` returns zero results after the change.
- **SC-002**: The full test suite (`npm test`) passes with zero failures.
- **SC-003**: Visual inspection of all 6 affected template strings confirms the empty interpolation `\${hideBannerOnSettle()}` is removed and not replaced with any other content.

## Assumptions

- The function truly always returns an empty string under all code paths (confirmed: single-line function with a hardcoded `return ""`).
- Banner-hiding behavior is not currently needed. If it becomes needed later, it should be implemented as a separate feature with actual functionality.
- No other files reference `hideBannerOnSettle` — it is defined and called only within `src/views/fragments.ts`.
- The 6 call sites are the only usages (confirmed by the feature description: lines 132, 138, 183, 189, 230, 236).
