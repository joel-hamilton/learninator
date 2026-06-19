# Feature Specification: Deepen AIError — inline the format pass-through

**Feature Branch**: `021-deepen-ai-error`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Deepen AIError — inline the format pass-through"

## User Scenarios & Testing

### User Story 1 - Developer understands AI error presentation in one place (Priority: P1)

A developer who wants to know what message will be shown to an end user when an AI call fails currently needs to read two files in separate directories: `src/ai/errors.ts` (which defines `AIError` and its `recoverable` flag) and `src/shared/errors.ts` (which checks the flag and appends a hint). By moving the hint logic onto `AIError` itself, the developer can understand the full user-facing message behavior by reading a single class.

**Why this priority**: This is the core purpose of the feature — eliminating the unnecessary indirection. Without this story, the refactoring has no value.

**Independent Test**: Can be verified by checking that `AIError.prototype.toUserMessage` exists, returns the message with the hint appended when `recoverable` is true, and returns the message alone when `recoverable` is false.

**Acceptance Scenarios**:

1. **Given** a non-recoverable AIError (recoverable=false or undefined), **When** `toUserMessage()` is called, **Then** the returned string equals the error message with no additional hint.
2. **Given** a recoverable AIError (recoverable=true), **When** `toUserMessage()` is called, **Then** the returned string is the error message followed by "It may help to wait a moment and retry."
3. **Given** a value that is not an AIError instance, **When** calling `toUserMessage()` is not applicable (the caller must check), **Then** the caller should fall back to a default or custom message.

---

### User Story 2 - Existing error messages are preserved without change (Priority: P1)

End users must see the exact same error messages before and after this refactoring. No message content, formatting, or behavior should change — only the location of the logic that produces them.

**Why this priority**: This is a refactoring, not a feature. Behavioral change would be a regression. Zero-tolerance for message changes.

**Independent Test**: All six production call sites produce identical output before and after the change. Test assertions for error messages in route tests continue to pass without modification.

**Acceptance Scenarios**:

1. **Given** a route handler that catches an AIError with recoverable=false, **When** the error is rendered as HTML, **Then** the rendered message is identical before and after the change.
2. **Given** a route handler that catches an AIError with recoverable=true, **When** the error is rendered as HTML, **Then** the rendered message (including the retry hint) is identical before and after the change.
3. **Given** a route handler that catches a non-AIError, **When** the error is rendered as HTML, **Then** the fallback message is identical before and after the change.

---

### User Story 3 - Dead code is removed (Priority: P2)

After migrating all callers, the `formatAIError` function and its file (`src/shared/errors.ts`) must be deleted. The test file (`src/shared/errors.test.ts`) must be replaced by tests for the new method in the appropriate location.

**Why this priority**: Cleanup is valuable but secondary to correctness. YAGNI — if the function is no longer used, it should not remain.

**Independent Test**: A grep for `formatAIError` across all `src/` files returns no results. The file `src/shared/errors.ts` does not exist. No imports from `../shared/errors.js` remain in production code.

**Acceptance Scenarios**:

1. **Given** the migration is complete, **When** searching for `formatAIError` in production (`src/`) code, **Then** zero results are returned.
2. **Given** the migration is complete, **When** checking `src/shared/errors.ts`, **Then** the file does not exist.
3. **Given** the migration is complete, **When** checking `src/routes/`, **Then** no file imports from `../shared/errors.js`.

---

### Edge Cases

- What happens when the fallback parameter is not provided and the input is not an AIError? The method (or its caller) should produce a sensible default — the same default message currently used: "Something went wrong. Please try again."
- What happens when recoverable is explicitly `false` vs `undefined` (default)? Both must suppress the hint; only `true` should append it.
- What happens with falsy or non-Error inputs (null, undefined, string, number)? The `instanceof AIError` check in the caller guards against this — those inputs fall through to the fallback message.

## Requirements

### Functional Requirements

- **FR-001**: `AIError` MUST expose a method `toUserMessage(fallback?: string): string` that returns the user-facing error message.
- **FR-002**: When `this.recoverable` is `true`, `toUserMessage()` MUST append " It may help to wait a moment and retry." to `this.message`.
- **FR-003**: When `this.recoverable` is `false` or `undefined`, `toUserMessage()` MUST return `this.message` unchanged (no appended hint).
- **FR-004**: The `fallback` parameter to `toUserMessage()` is unused (reserved for API consistency) — callers MUST perform the `instanceof AIError` check themselves and provide the fallback at the call site. This matches the current `formatAIError` contract.
- **FR-005**: `toUserMessage()` MUST NOT throw under any input condition (it only uses `this` state, never external arguments that could be malformed).
- **FR-006**: All six production call sites MUST be migrated from `formatAIError(err)` to the pattern `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."` (or `err.toUserMessage()` with fallback passed through).
- **FR-007**: The `formatAIError` function MUST be removed from the codebase.
- **FR-008**: The file `src/shared/errors.ts` MUST be deleted.
- **FR-009**: Import statements referencing `../shared/errors.js` for `formatAIError` MUST be removed from all route files.
- **FR-010**: The test file `src/shared/errors.test.ts` MUST be migrated to test `AIError.prototype.toUserMessage`, and may be relocated (e.g., to `src/ai/errors.test.ts` or kept alongside the new implementation).

### Key Entities

No new data entities are involved. The only domain entity is:

- **AIError**: An error class with `message` (string), `status` (number | undefined), and `recoverable` (boolean). After this feature, it also carries the logic for producing a user-facing message string via `toUserMessage()`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All six production call sites render the same error messages before and after the change. Verified by inspecting each route's catch block for identical output strings.
- **SC-002**: A developer can determine what message an end user sees when an AI call fails by reading only `src/ai/errors.ts`. No cross-directory reading required.
- **SC-003**: Zero imports from `src/shared/errors.js` remain in `src/routes/`.
- **SC-004**: The file `src/shared/errors.ts` is deleted and does not exist on disk.
- **SC-005**: All existing tests pass without modification to test logic (only import/file references change, and the formatAIError-specific tests are migrated to test toUserMessage).

## Assumptions

- No caller currently passes a custom fallback string (verified by inspection of all five route files). The `fallback` parameter is carried forward for API consistency but is not used in practice.
- The migrations are purely mechanical: each call site changes `formatAIError(err)` to `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`.
- The `AIError` class remains in `src/ai/errors.ts`. No relocation is part of this feature.
- The `formatAIError` test file (`src/shared/errors.test.ts`) will be moved alongside the new method — either to `src/ai/errors.test.ts` or kept with updated imports, at the implementer's discretion.
- This feature requires no database migration, no environment variable changes, and no schema changes.
