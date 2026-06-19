# Feature Specification: Consolidate Activation Bootstrap

**Feature Branch**: `020-activation-bootstrap-refactor`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Consolidate activation bootstrap — extract repeated didActivate handling across five route handlers into a single shared helper function."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Maintain identical activation behavior across all entry points (Priority: P1)

A developer refactors the five route handlers that currently repeat the same 3-line activation bootstrap pattern. After the refactor, every entry point that triggers mission activation (new mission, chat, guided start, guided answer, guided skip) continues to behave identically: the mission title is generated and the user is redirected to the mission page.

**Why this priority**: The core contract of the activation flow is that users see the same outcome regardless of which entry point triggered activation. Regression here would break the user experience for every mission activation path.

**Independent Test**: All five existing activation paths can be exercised via HTTP-level tests (using `app.request()` with `FakeAiClient` queue entries for activation) to confirm the response behavior is preserved.

**Acceptance Scenarios**:

1. **Given** a mission in onboarding state, **When** any of the five route handlers triggers activation via the `didActivate` response, **Then** the response includes the `HX-Redirect` header pointing to `/missions/{missionId}` and a 200 status code.
2. **Given** a mission that has just been activated, **When** activation occurs through any entry point, **Then** `missionChatService.generateTitle()` is called exactly once for that activation event.
3. **Given** a mission activation event from any of the five route handlers, **When** the activation handler executes, **Then** no other side effects (notifications, logging, secondary redirects) are introduced beyond title generation and HX-Redirect.

---

### User Story 2 — Single point of change for future post-activation logic (Priority: P1)

When a developer needs to add a post-activation step (e.g., sending a notification, logging an event, triggering a background job), they can modify a single helper function rather than hunting down five duplicated blocks.

**Why this priority**: The stated goal of the refactor is to eliminate duplication and reduce maintenance burden. A one-place change is the measurable outcome.

**Independent Test**: After the refactor, a search for the string `didActivate` across route handler files returns at most one occurrence of the activation-if block body outside the helper definition.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** a developer searches for code that handles `result.didActivate` in route handlers, **Then** each handler contains at most a one-line delegation to the shared helper.
2. **Given** the shared helper function, **When** a developer adds a new post-activation step, **Then** the change touches only the helper body, not any of the five route handlers.

---

### Edge Cases

- What happens if `generateTitle()` throws? The error should propagate naturally to the calling handler's error boundary — the helper should not swallow exceptions.
- What if the helper is called when `didActivate` is false? The helper should safely return without performing any operation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A shared helper function MUST be created that accepts the activation result, mission ID, missionChatService instance, and Hono context, and performs the title generation and HX-Redirect.
- **FR-002**: All five existing route handlers that check `if (result.didActivate)` MUST delegate to the shared helper instead of duplicating the logic inline.
- **FR-003**: The helper MUST call `missionChatService.generateTitle(missionId)` before setting the redirect header, preserving the current ordering.
- **FR-004**: The helper MUST set the `HX-Redirect` header to `/missions/${missionId}` and return an empty response body, preserving the current contract with the htmx frontend.
- **FR-005**: The helper SHOULD be imported from a module that does not create circular dependencies with the route files or the mission chat service.
- **FR-006**: Behavior MUST be identical before and after the refactor — the helper must not introduce new side effects or suppress existing error behavior.

### Key Entities

This feature involves no new data entities. It is a structural refactoring of existing code.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five route handlers that previously contained the 3-line activation block now delegate to the shared helper via a single-line call. Verified by code review.
- **SC-002**: The pattern `if (result.didActivate) {` followed by a multi-line block body appears exactly zero times in route handler files. Verified by grep.
- **SC-003**: All existing activation tests (HTTP-level, using `FakeAiClient`) continue to pass without modification. Verified by `npm test`.
- **SC-004**: Adding a new post-activation step (e.g., adding a logging call) to the helper body takes effect across all five activation paths without additional changes. Verified by manual inspection.

## Assumptions

- No user-facing behavior changes are required — this is a pure structural refactoring.
- The `missionChatService` interface (`generateTitle(missionId)`) remains stable.
- The `HX-Redirect` header is the correct mechanism for htmx client-side navigation after activation; this is consistent with the existing codebase pattern.
- The helper will be placed in an existing module (e.g., the services layer or a shared utilities module) that avoids circular dependencies with route modules.
- The five identified handlers are the complete set of activation entry points; no additional hidden activation paths exist in the codebase.
