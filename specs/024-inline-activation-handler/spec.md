# Feature Specification: Inline Activation Handler

**Feature Directory**: `specs/024-inline-activation-handler`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Inline the handleActivation function from src/shared/activate-mission.ts into its 5 call sites. This 28-line module wraps 3 lines of logic: check result.didActivate, call missionChatService.generateTitle(missionId), set HX-Redirect header, return body null. The call sites are in src/routes/missions.ts (2 sites: POST /, POST /:missionId/chat) and src/routes/onboarding.ts (3 sites: guided/start, guided/answer, guided/skip). After inlining, delete src/shared/activate-mission.ts. The pattern is identical at every call site — no abstraction is lost, but the indirection is removed."

## User Scenarios & Testing

### User Story 1 - No Behavior Change for Users (Priority: P1)

This is a pure refactoring: the function is inlined at each call site, then the module is deleted. There is zero user-facing behavior change. Users cannot observe any difference in page loads, redirect behavior, title generation, or error handling.

**Why this priority**: This is the only story. The entire value of this feature is internal — reducing indirection, eliminating a module that provides no meaningful abstraction, and making the code easier to navigate.

**Independent Test**: All existing HTTP-level integration tests pass without modification. The test suite covers all 5 call sites: mission creation (POST /), chat messaging (POST /:missionId/chat), guided onboarding start, guided onboarding answer, and guided onboarding skip. No new tests are needed because no behavior changes.

**Acceptance Scenarios**:

1. **Given** an existing test suite with tests covering all 5 call sites, **When** `handleActivation` is inlined at each call site and `src/shared/activate-mission.ts` is deleted, **Then** all existing tests pass with zero modifications.

2. **Given** a developer reading the code at any of the 5 call sites, **When** they follow the control flow for mission activation, **Then** the redirect-and-title-generation logic is visible inline rather than requiring a navigation to another module.

---

### Edge Cases

- **What if a call site has slightly different logic than the others?** The `handleActivation` function is called identically at all 5 sites with a consistent three-line pattern: condition check, async title generation, header set, body return. The inline code at each site will be identical.
- **What if the module is imported elsewhere that we missed?** After inlining, we check for remaining imports of `activate-mission` in the codebase. If none remain, the module is deleted.
- **What if the import was re-exported through a barrel file?** Check `src/shared/index.ts` or any barrel files for re-exports of `handleActivation`.

## Requirements

### Functional Requirements

- **FR-001**: After refactoring, mission activation MUST behave identically to the current implementation at all 5 call sites: if `result.didActivate` is true, the mission title is generated and the client is redirected to the mission page.
- **FR-002**: The `src/shared/activate-mission.ts` module MUST be deleted after all call sites are updated.
- **FR-003**: No new imports, exports, or modules MUST be created. The existing imports from call site files should be trimmed (remove the `handleActivation` import) since the function is no longer needed from that module.
- **FR-004**: After inlining, the logic at each call site MUST be a direct equivalent of the original `handleActivation` function body, preserving both the success path (title generation + redirect) and the non-activation path (return `undefined` / continue normal processing).

### Key Entities

- **Mission**: The entity whose activation status is checked. Mission activation triggers title generation and HX-Redirect.
- **MissionChatService**: The service whose `generateTitle` method is called during activation. Accessed from Hono context.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All existing HTTP-level integration tests pass without modification. The test suite covers all 5 call sites.
- **SC-002**: The `src/shared/activate-mission.ts` file no longer exists in the repository.
- **SC-003**: No remaining imports from `activate-mission.ts` exist anywhere in the codebase.
- **SC-004**: The codebase has one fewer indirection layer — a developer reading any of the 5 call sites can see the full activation logic inline rather than jumping to a separate module.

## Assumptions

- The `handleActivation` import is only used at the 5 identified call sites (2 in `missions.ts`, 3 in `onboarding.ts`). No barrel files or indirect re-exports need updating.
- The function's behavior is deterministic: the inline version will produce exactly the same result as the called version for all inputs.
- The test suite has adequate coverage of all 5 call sites to validate the refactoring. No new tests are required.
- The function's signature (`result`, `missionId`, `missionChatService`, `c`) maps directly to local variables already available at every call site.
