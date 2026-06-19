# Feature Specification: Delete Dead ChatRoutes Module

**Feature Branch**: `022-delete-dead-chat-routes`

**Created**: 2026-06-19

**Status**: Complete

**Input**: User description: "Delete dead chatRoutes module — `src/routes/chat.ts` is a 60-line Hono router that exports `chatRoutes` but is never imported or mounted anywhere in the codebase. The real chat handler lives at `src/routes/missions.ts:311`. The dead file defines a POST `/:missionId/chat` handler that duplicates the real one."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dead Code Removal (Priority: P1)

As a developer, unused module files are removed from the codebase so that the codebase is easier to navigate and maintain without dead code that may cause confusion.

**Why this priority**: The file is entirely unused — never imported, never mounted, never tested. It contains a duplicate handler that was presumably left behind during a refactor. Keeping it creates a maintenance hazard: anyone reading the code will wonder whether it is used, and future edits to the real handler may need to be mirrored here.

**Independent Test**: Run `grep -rn "chatRoutes" src/ --include='*.ts'` — the only result is the definition in `src/routes/chat.ts` itself. After deletion, no imports break and all existing tests pass.

**Acceptance Scenarios**:

1. **Given** the current codebase, **When** searching for imports of `chatRoutes` or `./chat` across all TypeScript files, **Then** the only reference found is the definition in `src/routes/chat.ts` itself
2. **Given** the file is deleted, **When** running `npm test`, **Then** all existing tests pass without any modification
3. **Given** the file is deleted, **When** running `npx tsc --noEmit`, **Then** the TypeScript compiler reports zero errors
4. **Given** the file is deleted and the application is started, **When** visiting any page and using the chat feature, **Then** the real handler in `src/routes/missions.ts` continues to work as expected

---

### User Story 2 - No Unique Logic Lost (Priority: P1)

As a developer, any logic present in the deleted file that does not exist in the real handler is identified and assessed before deletion, ensuring no functionality is accidentally removed.

**Why this priority**: The premise is that this is a pure duplicate. However, if the dead file has diverged and contains unique logic (e.g., different error handling, additional validation, or alternative rendering), that logic may need to be preserved. Verification must be done before deletion.

**Independent Test**: Diff the dead file against the real handler at `src/routes/missions.ts:311-360` (approximate line range for the POST handler). Flag any code paths, error handling, or behavior in the dead file that do not exist in the real handler.

**Acceptance Scenarios**:

1. **Given** the dead `chat.ts` file and the real handler in `missions.ts`, **When** comparing their POST handler logic, **Then** no unique, non-duplicate logic exists in the dead file that is missing from the real handler
2. **Given** a difference is found, **When** assessed, **Then** it is either (a) incorporated into the real handler before deletion, or (b) determined to be obsolete/buggy and safely omitted

---

### Edge Cases

- What if a third-party script or build tool references `src/routes/chat.ts` indirectly? The build (`tsc`) and test runner (`vitest`) only process modules that are imported through the dependency graph. If nothing imports it, nothing breaks.
- What if the file was intended for future use? Dead code that is "planned for later" should be recreated from version control when needed. Keeping it in the working tree provides no benefit and creates maintenance debt.
- What if the file contains imports that are only used in this file? Unused imports in the dead file (like `conversationLoop`, `createStandardHooks`, `TEACHER_SYSTEM_PROMPT`, `TEACHER_TOOLS`) are harmless but will be removed along with the file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The file `src/routes/chat.ts` MUST be deleted entirely
- **FR-002**: No other files MUST be modified — the deletion is isolated to this single file
- **FR-003**: All existing tests MUST pass without modification after deletion
- **FR-004**: The application MUST build (TypeScript compile) without errors after deletion
- **FR-005**: The real chat handler at `src/routes/missions.ts:311` MUST continue to function identically

### Key Entities

- **chat.ts (dead module)**: A 60-line file at `src/routes/chat.ts` that exports `chatRoutes`, a Hono router with a single POST `/:missionId/chat` handler. Never imported or mounted. Contains duplicate logic of the real handler in `src/routes/missions.ts:311`.
- **Real chat handler**: The active POST `/:missionId/chat` route defined in `src/routes/missions.ts:311` that correctly handles chat messages through `missionChatService.run()`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -rn "chatRoutes\|from.*chat\"" src/ --include='*.ts'` returns no results after deletion (the identifier is fully removed)
- **SC-002**: `npm test` exits with code 0 (all tests pass)
- **SC-003**: `npx tsc --noEmit` exits with code 0 (clean TypeScript compilation)
- **SC-004**: The real chat handler in `missions.ts` continues to work — verified by existing chat integration tests

## Assumptions

- **No unique logic**: Based on initial comparison, the dead file is a near-identical duplicate of the real handler. Both use `missionChatService.run()` with the same parameter pattern. Any unused imports (e.g., `conversationLoop`, `createStandardHooks`, `TEACHER_SYSTEM_PROMPT`, `TEACHER_TOOLS`) in the dead file are also unused in that file and safe to delete.
- **No runtime registration**: The dead file's `chatRoutes` router was never mounted via `app.route()` or `app.mount()` in the app factory (`src/index.ts`). Therefore no route was ever registered from this file at runtime.
- **Scope boundary**: This feature does not refactor, rename, or restructure the real handler. It only removes the dead file.
- **Version control**: The deleted file will remain in git history. If the code is ever needed, it can be recovered from the commit history.
