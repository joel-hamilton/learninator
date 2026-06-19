# Feature Specification: Deduplicate Guided-Question JavaScript

**Feature Branch**: `023-deduplicate-guided-js`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Deduplicate guided-question JavaScript in src/views/shared.ts where the guided-question form's client-side JavaScript exists in two places -- inline in pageHead()'s script tag and as the exported GUIDED_QUESTION_SCRIPT constant. Have the inline script reference GUIDED_QUESTION_SCRIPT instead of duplicating the function definitions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developers maintain guided-question behavior from one location (Priority: P1)

As a developer, I want to fix or improve the guided-question JavaScript logic in one place, so that both the full-page rendered form and the htmx-fragment rendered form automatically benefit from the fix without manual double-patching.

**Why this priority**: This is the entire purpose of the feature. Without it, every guided-question JS change requires synchronous edits in two locations, which is error-prone and wastes development time.

**Independent Test**: Can be fully tested by confirming that the `pageHead()` function output includes a `<script>` tag that reuses `GUIDED_QUESTION_SCRIPT` (by reference, not by value duplication), and that the rendered onboarding page still submits guided answers correctly.

**Acceptance Scenarios**:

1. **Given** the source file `src/views/shared.ts`, **When** I inspect the `pageHead()` function's inline `<script>` tag, **Then** the guided-question function definitions (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`) are no longer duplicated inline, and instead reference or embed `GUIDED_QUESTION_SCRIPT`.
2. **Given** a user loads the onboarding page (which uses `pageHead()`), **When** they interact with a guided-question form, **Then** all guided-question behaviors work identically to before the refactor.
3. **Given** a user loads an htmx fragment that includes `guidedQuestionSection()`, **When** they interact with the guided-question form, **Then** all guided-question behaviors work identically to before the refactor.

---

### User Story 2 - No behavioral regression on existing guided-question flows (Priority: P1)

As a user completing onboarding, I want the guided-question form to behave exactly as it did before, so that the refactoring does not disrupt my experience.

**Why this priority**: A refactoring that changes behavior is a regression. The tests must prove behavioral equivalence.

**Independent Test**: Can be fully tested by running the existing test suite (`npm test`) — no guided-question-specific test changes are required if the refactor is purely mechanical.

**Acceptance Scenarios**:

1. **Given** a user is on a guided-question step during onboarding, **When** they select an option, **Then** the selection UI updates correctly (same visual feedback as before).
2. **Given** a user has filled in a guided-question form, **When** they submit, **Then** the same data payload is sent as before.
3. **Given** the existing test suite, **When** I run `npm test`, **Then** all previously passing tests continue to pass.

---

### Edge Cases

- What happens if `GUIDED_QUESTION_SCRIPT` contains a script tag error? Both contexts should fail identically — there is no separate error surface to debug.
- What happens if a future developer needs to override guided-question behavior in only one context? They must extract it into a separate script constant — the current design intentionally makes both contexts share the same code.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `pageHead()` function MUST NOT contain inline definitions of the guided-question JavaScript functions (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`) that duplicate `GUIDED_QUESTION_SCRIPT`.
- **FR-002**: The `pageHead()` inline `<script>` tag MUST either reference `GUIDED_QUESTION_SCRIPT` directly or include it in a way that eliminates the duplicated function bodies.
- **FR-003**: The exported `GUIDED_QUESTION_SCRIPT` constant MUST remain the single source of truth for guided-question JavaScript logic, usable by both `pageHead()` and `guidedQuestionSection()`.
- **FR-004**: After the change, the rendered onboarding page (full-page load via `pageHead()`) MUST behave identically to the pre-refactor version for all guided-question interactions.
- **FR-005**: After the change, the htmx-fragment rendered guided-question forms (via `guidedQuestionSection()`) MUST behave identically to the pre-refactor version.

### Key Entities *(include if feature involves data)*

This feature does not introduce or modify any data entities. It is a pure JavaScript/rendering refactor scoped to `src/views/shared.ts`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Line count of `src/views/shared.ts` decreases by approximately 40 lines (the duplicated inline function definitions are removed).
- **SC-002**: No duplicate function definitions for `selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, or `submitGuidedAnswer` exist in `src/views/shared.ts`.
- **SC-003**: All existing tests pass without modification (`npm test` succeeds).
- **SC-004**: A developer can modify a guided-question JavaScript function in `GUIDED_QUESTION_SCRIPT` and both the full-page and htmx-fragment rendering contexts reflect the change without additional edits.

## Assumptions

- The two copies of the guided-question JavaScript are functionally identical in the current codebase — no behavioral divergence has been introduced between them.
- The `GUIDED_QUESTION_SCRIPT` constant is the correct single source of truth (it is already exported and used by `guidedQuestionSection()`).
- The `pageHead()` function's inline `<script>` tag can embed `GUIDED_QUESTION_SCRIPT` at the template level (e.g., by interpolating the constant value or by constructing a script that delegates to it).
- No test coverage changes are needed — the existing HTTP-level tests for onboarding and guided Q&A verify the behavior.
