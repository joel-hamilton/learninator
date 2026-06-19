# Feature Specification: Remove Mission Access Pass-Through

**Feature Branch**: `021-remove-mission-access-shim`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Delete the require-mission-access pass-through module — a 16-line shallow wrapper around store.getMission that adds only a NaN guard. Inline the call at each route site and remove the module."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Direct Validation in Route Handlers (Priority: P1)

As a developer reading route handler code, I want mission-access validation to be visible inline rather than hidden behind a pass-through module, so that I can understand a route's full behavior without navigating to a separate file.

**Why this priority**: This is the core motivation for the change. The `requireMissionAccess` function is a shallow module whose interface (3 params, async return of `MissionRow | undefined`) is as complex as its implementation (1 guard + 1 store call). Every caller already has access to `store` and `user` from context and already checks the result for undefined. Removing the indirection makes each route self-documenting about how it validates mission access.

**Independent Test**: The module `src/shared/require-mission-access.ts` no longer exists. No import of `requireMissionAccess` exists in any file. Every route that previously called `requireMissionAccess` instead calls `store.getMission(missionId, user.id)` with the NaN guard inline, and all existing tests pass unchanged.

**Acceptance Scenarios**:

1. **Given** the file `src/shared/require-mission-access.ts`, **When** the feature is implemented, **Then** the file is deleted
2. **Given** any route in `src/routes/missions.ts`, **When** it needs to verify mission access, **Then** it calls `store.getMission(missionId, user.id)` directly with an inline NaN guard, not a helper function
3. **Given** any route in `src/routes/onboarding.ts`, **When** it needs to verify mission access, **Then** it calls `store.getMission(missionId, user.id)` directly with an inline NaN guard
4. **Given** any route in `src/routes/lessons.ts`, **When** it needs to verify mission access, **Then** it calls `store.getMission(missionId, user.id)` directly with an inline NaN guard
5. **Given** any route in `src/routes/mission-tabs.ts`, **When** it needs to verify mission access, **Then** it calls `store.getMission(missionId, user.id)` directly with an inline NaN guard

---

### User Story 2 - Consistent NaN Guard Preservation (Priority: P1)

As a user of the application, I want invalid mission IDs in URLs to result in a clear 404 response, so that malformed or non-existent mission IDs do not cause confusing errors or undefined behavior.

**Why this priority**: The NaN guard (`Number.isNaN(id) || id < 1`) is the only added value of the removed module. Every call site must preserve this guard. Without it, passing `NaN` (from `parseInt("abc")`) to `store.getMission()` would produce a query that returns undefined, but the guard also catches `id < 1` as an early exit before hitting the database.

**Independent Test**: Sending a request with a non-numeric mission ID (e.g., `/missions/abc/lessons`) returns 404. Sending a request with a negative mission ID (e.g., `/missions/-1/lessons`) returns 404. These are the same behaviors as before the change.

**Acceptance Scenarios**:

1. **Given** a route with a mission ID parameter that is not a valid number (e.g., `/missions/abc`), **When** the request is processed, **Then** the response is 404 Not Found
2. **Given** a route with a mission ID parameter less than 1 (e.g., `/missions/0`), **When** the request is processed, **Then** the response is 404 Not Found
3. **Given** a route with a valid numeric mission ID that exists and belongs to the user, **When** the request is processed, **Then** the response proceeds normally (same as before the change)

---

### User Story 3 - Reduced Codebase Surface (Priority: P2)

As a developer maintaining the codebase, I want one fewer module to navigate and understand, so that the overall cognitive load of the project is reduced.

**Why this priority**: With the module removed, the codebase has one fewer file, one fewer export, and one fewer import to track. The total line count decreases by approximately 16 lines. This is a small but persistent reduction in maintenance surface.

**Independent Test**: The codebase compiles without errors, all tests pass, and `git diff --stat` shows a net reduction of approximately 16 lines (the module file is deleted, and a few lines are added at each call site for the inline guard).

**Acceptance Scenarios**:

1. **Given** the current codebase, **When** the feature is implemented, **Then** `src/shared/require-mission-access.ts` does not exist
2. **Given** the current codebase, **When** the feature is implemented, **Then** no file imports from `src/shared/require-mission-access.ts`
3. **Given** the current codebase, **When** the feature is implemented, **Then** all existing tests pass without modification

---

### Edge Cases

- **What happens if a route handler was importing `requireMissionAccess` alongside other utilities from `src/shared/`?** The import is removed. If the file also imports `MissionStore` from elsewhere (e.g., `src/db/store.ts`), that import remains in place. If not, it may need to be added — but the user noted that callers already import `MissionStore` directly.
- **What if the NaN guard was catching additional edge cases beyond what the user described?** The guard is `Number.isNaN(missionId) || missionId < 1`. This is fully specifiable inline. No behavior changes — the same check appears at each call site.
- **What if a new route needs mission-access validation in the future?** The developer writes the guard inline. This is a two-line pattern — no need for a shared helper. If the pattern repeats more than 3 times with identical logic, extraction into a helper can be reconsidered (YAGNI principle).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The file `src/shared/require-mission-access.ts` MUST be deleted
- **FR-002**: Every call site that previously called `requireMissionAccess(store, missionId, user.id)` MUST instead call `store.getMission(missionId, user.id)` directly
- **FR-003**: Every call site MUST include the NaN guard `if (Number.isNaN(missionId) || missionId < 1)` before calling `store.getMission()`, returning 404 Not Found when the guard triggers
- **FR-004**: Call sites are located in `src/routes/missions.ts`, `src/routes/onboarding.ts`, `src/routes/lessons.ts`, and `src/routes/mission-tabs.ts`
- **FR-005**: No file in the codebase MUST import from `src/shared/require-mission-access.ts` after the change
- **FR-006**: All existing tests MUST pass without modification, as behavior is fully preserved
- **FR-007**: The `MissionStore` import MUST remain or be added at each call site file (callers already import it; this requirement ensures no broken imports)

### Key Entities

- **MissionStore**: The existing store interface (already imported by all callers) that provides `getMission(missionId, userId)` used to validate that a mission exists and belongs to the requesting user.
- **Mission ID**: A numeric route parameter validated at the call site with a NaN guard before being passed to the store. Validation is now co-located with the route handler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The file `src/shared/require-mission-access.ts` is deleted (verified by filesystem check)
- **SC-002**: Zero imports of `requireMissionAccess` or `require-mission-access` exist in the codebase (verified by grep)
- **SC-003**: All existing tests pass without modification (verified by `npm test`)
- **SC-004**: Requests with non-numeric mission IDs return 404 — behavior identical to before the change (verified by integration test)
- **SC-005**: Requests with mission ID < 1 return 404 — behavior identical to before the change (verified by integration test)
- **SC-006**: The codebase shows a net reduction of approximately 16 lines (the module file removed, offset by inline guard lines added at each call site)

## Assumptions

- **No helper extraction needed**: The NaN guard + store call pattern is short enough (2-3 lines) that extracting it into a shared function provides no meaningful benefit. If the pattern appears at fewer than 4 call sites, inlining is strictly better (no indirection, no import).
- **Import analysis is complete**: The four route files listed in the feature description are the only callers. A grep of the codebase will confirm this before deletion.
- **Caller already imports MissionStore**: The feature description states that all callers already import MissionStore directly. If any caller does not, an import will be added as part of the change.
- **No behavioral change**: The feature is purely a refactoring. No user-visible behavior changes, no new features, no bug fixes beyond what the existing code already provides.
- **Scope boundary**: This feature does not modify the `store.getMission()` implementation, the `MissionStore` interface, or any route handler logic beyond the access-check pattern. It does not add or remove route handlers.
