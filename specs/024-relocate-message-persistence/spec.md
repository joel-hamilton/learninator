# Feature Specification: Relocate Message Persistence

**Feature Branch**: `024-relocate-message-persistence`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Move message persistence logic from src/shared/messages.ts closer to where it's used. The file has 3 exports: saveMessage (thin JSON.stringify wrapper over ChatStore), loadMessages (complex orphaned tool_result filtering logic that belongs in the AI layer), and contentToText (used only for display rendering in routes). Move saveMessage and loadMessages into a new file src/ai/persistence.ts (or into src/ai/conversation.ts since createStandardHooks is the primary caller). Move contentToText into src/views/shared.ts. Delete src/shared/messages.ts. The file also has unused imports of eq and asc from drizzle-orm. Update all imports in: src/ai/conversation.ts, src/services/mission-chat.service.ts, src/routes/missions.ts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Removes Code Duplication and Misplaced Logic (Priority: P1)

As a developer maintaining the codebase, I want message persistence logic (saveMessage, loadMessages) co-located with the AI conversation layer where it is actually consumed, and display-only logic (contentToText) moved to the views layer, so that the module structure reflects actual usage and future developers can find the right file without guessing.

**Why this priority**: This directly addresses the stated problem of misplaced code. Moving `loadMessages` to the AI layer eliminates the awkward import of a shared module into `mission-chat.service.ts` and `conversation.ts` for what is AI-specific filtering logic (orphaned tool_result detection). Moving `contentToText` to the views layer unifies display rendering helpers. This is the core value of the change.

**Independent Test**: Can be fully verified by checking that all three functions (saveMessage, loadMessages, contentToText) are importable from their new locations, the old file is deleted, all existing tests pass, and the app renders messages correctly in both onboarding and chat views.

**Acceptance Scenarios**:

1. **Given** the codebase in its current state, **When** a developer looks for where messages are saved or loaded, **Then** those functions are found in `src/ai/persistence.ts` rather than `src/shared/messages.ts`.
2. **Given** the codebase in its current state, **When** a developer looks for the `contentToText` function, **Then** it is found in `src/views/shared.ts`.
3. **Given** `src/shared/messages.ts` has been deleted, **When** all import statements across the codebase are inspected, **Then** no file imports from `../shared/messages.js`.
4. **Given** the refactored import paths, **When** the test suite runs, **Then** all existing tests pass without modification to test logic (import paths in tests may need updating if they import from the moved modules).

---

### User Story 2 - Developer Removes Dead Code (Priority: P2)

As a developer keeping the codebase clean, I want unused imports (`eq`, `asc` from drizzle-orm) removed from `src/shared/messages.ts` (and never re-introduced in the new locations), so that the codebase has no dead import baggage and linters do not flag false positives.

**Why this priority**: While this is a smaller cleanup item, it is trivially addressed as part of the move and prevents lint warnings. It also ensures the new files start clean.

**Independent Test**: Can be verified by running the linter or TypeScript compiler against the new files and confirming no unused import warnings for `eq` or `asc`.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** the TypeScript compiler is run, **Then** no unused-import warnings for `eq` or `asc` are emitted for any file in the project.
2. **Given** the new `src/ai/persistence.ts`, **When** its imports are inspected, **Then** it does not import `eq` or `asc` (which are not needed by the moved functions).

---

### Edge Cases

- What happens if a file imports from `src/shared/messages.js` that was not listed in the feature description? The spec assumes only three files import from it: `src/ai/conversation.ts`, `src/services/mission-chat.service.ts`, and `src/routes/missions.ts`. If there are additional importers, they must also be updated.
- How does the `contentToText` function interact with other display helpers in `src/views/shared.ts`? It should be a standalone utility function with no internal dependencies on the rest of the views module.
- Does the `loadMessages` function depend on any types or utilities defined in `src/shared/` beyond what it already imports? It imports `AiMessageParam` from `../ai/index.js` and `ChatStore` from `../db/store.js` — these are not shared-layer types but rather AI and DB types, reinforcing that this function belongs in the AI layer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `saveMessage` and `loadMessages` MUST be moved to a new module `src/ai/persistence.ts` (or into `src/ai/conversation.ts`) and be importable from their new location.
- **FR-002**: `contentToText` MUST be moved to `src/views/shared.ts` and be exportable from that module.
- **FR-003**: All existing imports of `saveMessage`, `loadMessages`, and `contentToText` from `../shared/messages.js` MUST be updated to import from the new locations.
- **FR-004**: The file `src/shared/messages.ts` MUST be deleted after all consumers have been updated.
- **FR-005**: The unused imports (`eq`, `asc` from drizzle-orm) in the moved code MUST NOT be carried over to the new files.
- **FR-006**: All functions MUST retain their exact signatures and behavior — this is a pure relocation, no functional changes.
- **FR-007**: The test suite MUST pass without any test modifications (unless a test imports directly from `src/shared/messages.ts`, in which case that import path should be updated).

### Key Entities *(include if feature involves data)*

- **`saveMessage(store, missionId, role, content)`**: Function that serializes and persists a chat message via ChatStore. Signature must remain unchanged.
- **`loadMessages(store, missionId)`**: Function that retrieves and filters chat messages from ChatStore, discarding orphaned tool_result blocks. Signature must remain unchanged.
- **`contentToText(content)`**: Function that parses JSON message content and extracts displayable text. Signature must remain unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three functions are importable from their new locations with zero behavioral changes — verified by the existing test suite passing.
- **SC-002**: `src/shared/messages.ts` no longer exists in the codebase.
- **SC-003**: No file in the project imports from `../shared/messages.js`.
- **SC-004**: The unused `eq` and `asc` imports are absent from the new files.
- **SC-005**: All import paths across the three updated consumer files (`src/ai/conversation.ts`, `src/services/mission-chat.service.ts`, `src/routes/missions.ts`) correctly reference the new module locations.

## Assumptions

- No other files beyond the three listed (`src/ai/conversation.ts`, `src/services/mission-chat.service.ts`, `src/routes/missions.ts`) import from `src/shared/messages.ts`. If other files do import from it, those must also be updated.
- Tests do not import directly from `src/shared/messages.ts` — if they do, import paths in tests must also be updated.
- The function signatures, parameter types, and return types of all three functions are considered part of the public API and must be preserved identically.
- The existing project build tooling (TypeScript compiler, module resolution) handles the new file paths correctly without configuration changes (new files within existing module directories do not require tsconfig adjustments).
