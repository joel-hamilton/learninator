# Feature Specification: Fix AI Barrel File

**Feature Branch**: `016-fix-ai-barrel-file`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Fix AI Barrel File — `src/ai/index.ts` is a misleading barrel that re-exports only a subset of the AI module. Every consumer bypasses it and imports from individual files directly. It creates the illusion of a clean public API while encouraging callers to reach into internal files."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single Entry Point for the AI Module (Priority: P1)

*This is the end-state for Option A (expand the barrel).*

A developer working on any consumer of the AI module (routes, onboarding, lessons, generator, tests, app factory) imports every needed symbol from a single entry point `"../ai/index.js"`. They do not need to know which internal file (`conversation.ts`, `teacher.ts`, `tools.ts`, `events.ts`, `workflow-state.ts`) an export lives in. The barrel is the canonical, complete public API surface of the AI module.

**Why this priority**: A single entry point is the standard module pattern in TypeScript projects. It makes the public API discoverable, documents what's internal vs external, and lets consumers rely on one import path. Without this, every new contributor has to spelunk internal files.

**Independent Test**: Replace every individual-file import from `src/ai/` (`conversation.js`, `teacher.js`, `tools.js`, `events.js`, `workflow-state.js`) with a barrel import from `"../ai/index.js"`, then run the full test suite and start the dev server. Both must succeed with zero changes to test logic.

**Acceptance Scenarios**:

1. **Given** a consumer file that imports from a subpath of `src/ai/` (e.g., `"../ai/conversation.js"`), **When** that import is replaced with `"../ai/index.js"`, **Then** all required symbols resolve correctly.
2. **Given** the full test suite, **When** all consumer imports are migrated to the barrel, **Then** zero tests fail (no test logic changes needed, only import paths).
3. **Given** the dev server, **When** it starts after the migration, **Then** the app runs with no import-resolution errors and all routes/AI functionality works.

---

### User Story 2 - No Misleading Barrel (Priority: P1)

*This is the end-state for Option B (delete the barrel).*

A developer browsing the codebase does not encounter a `src/ai/index.ts` file that claims to be the module's entry point but only re-exports a subset of the module's exports. The individual files are themselves the authoritative public API — there is no second "public face" to accidentally maintain or grow stale. Every file's exports are equally visible and equally valid import targets.

**Why this priority**: A barrel that exports only types, an error class, and two implementations (but not the actual functions and tools consumers use) is worse than no barrel — it creates a false mental model of the module's structure. Deleting it removes the trap.

**Independent Test**: Delete `src/ai/index.ts`, remove the barrel import from all consumers that currently use it (for `AIError`), run the full test suite, and start the dev server. Both must succeed.

**Acceptance Scenarios**:

1. **Given** the file `src/ai/index.ts` is deleted, **When** the full test suite runs, **Then** zero tests fail.
2. **Given** the file `src/ai/index.ts` is deleted, **When** `npm run dev` starts, **Then** the app runs with no import errors.
3. **Given** `src/ai/index.ts` does not exist, **When** a developer wants to understand the AI module's exports, **Then** they look at each individual file — there is no ambiguity about whether something is "public" or "private."

---

### User Story 3 - Import Hygiene Is Enforceable (Priority: P2)

Regardless of which option is chosen, the team can easily keep imports consistent going forward. The pattern is explicit, reviewable, and does not silently drift.

**Why this priority**: Without enforcement, the barrel will inevitably fall out of sync again (Option A) or someone will recreate it (Option B). A lightweight enforcement mechanism prevents regression.

**Independent Test**: Add a new public export to one of the AI module's internal files. Verify that either (A) adding it to the barrel passes review, or (B) no barrel exists so there's nothing to update.

**Acceptance Scenarios**:

1. **Given** a new public function added to `src/ai/tools.ts`, **When** (Option A) the developer adds a re-export to `index.ts` and no consumer imports from `"../ai/tools.js"` directly, **Then** CI passes and the barrel is complete.
2. **Given** a new public function added to `src/ai/tools.ts`, **When** (Option B) a consumer imports it via `"../ai/tools.js"`, **Then** that is the expected pattern — no barrel indirection needed.
3. **Given** a pull request that touches `src/ai/` files, **When** the code owner reviews it, **Then** the review checklist includes "verify barrel exports are complete" (Option A) or "verify no barrel was created/reintroduced" (Option B).

---

### Edge Cases

- **What happens when a consumer imports from BOTH the barrel AND individual files simultaneously (Option A)?** TypeScript resolves identical symbols from different paths to the same binding — no runtime error occurs. But it is confusing and should be caught by code review. A linter rule (`import/no-duplicates` or equivalent) can flag this.
- **What happens if the barrel re-export creates a circular dependency?** The current internal files (`tools.ts` imports from `types.ts`, `teacher.ts` imports from `types.ts`) have no cycles. But if a future file in `src/ai/` imports from the barrel instead of the internal file, a cycle could form. The barrel should only re-export — never re-import — from its own module.
- **What happens with tree-shaking / dead-code elimination?** Barrel re-exports (Option A) are transparent to bundlers — they do not prevent tree-shaking. Module-level side-effect-free re-exports are fine. No performance concern.
- **What about `FakeAiClient` being re-exported but only used in tests?** Currently the barrel exports `FakeAiClient`. Under Option A, test-only utilities should remain in the barrel for consistency (tests are legitimate consumers). Under Option B, the barrel is gone and `FakeAiClient` is imported directly from `"../ai/fake.js"` by tests — no issue.
- **What happens when the `src/ai/index.ts` file is deleted (Option B) but some consumer imports from `"../ai/index.js"`?** TypeScript/Node will throw a `MODULE_NOT_FOUND` error at runtime. All consumers that import from the barrel (`routes/chat.ts`, `routes/missions.ts`, `routes/lessons.ts`, `routes/browse.ts`, `onboarding/index.ts` — all for `AIError`) must be updated to import `AIError` from `"../ai/errors.js"` instead.
- **What about the app factory (`src/index.ts`) which already bypasses the barrel and imports from individual files?** Under Option A, the app factory would be migrated to the barrel. Under Option B, it already follows the correct pattern — no change needed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The file `src/ai/index.ts` MUST either be deleted (Option B) or expanded to re-export every public symbol from every file in `src/ai/` (Option A). There MUST be no intermediate state where the barrel exports some but not all public symbols.
- **FR-002**: (Option A) The barrel MUST re-export all of the following:
  - All types from `types.ts` (currently done)
  - `conversationLoop`, `createStandardHooks`, `ConversationLoopParams`, `ConversationHook` from `conversation.ts`
  - `TEACHER_SYSTEM_PROMPT`, `TEACHER_TOOLS`, `getRegenerateSystemPrompt`, `getBridgingSystemPrompt` from `teacher.ts`
  - `TOOL_DISPLAY_NAMES`, `createToolExecutor`, `ToolName` from `tools.ts`
  - `emit`, `createEventBus` from `events.ts`
  - `WorkflowStateManager` from `workflow-state.ts`
  - All existing exports (`AnthropicAiClient`, `FakeAiClient`, `AIError`) — retained
- **FR-003**: (Option A) All consumer files that currently import from individual `src/ai/` subpaths MUST be migrated to import from `"../ai/index.js"` instead. The following files MUST be updated:
  - `src/index.ts` — currently imports from `./ai/anthropic.js`, `./ai/tools.js`, `./ai/events.js`, `./ai/workflow-state.js`, `./ai/types.js` — MUST use `./ai/index.js`
  - `src/routes/chat.ts` — currently imports from `./ai/teacher.js` and `./ai/conversation.js` — MUST use `./ai/index.js`
  - `src/routes/missions.ts` — currently imports from `./ai/teacher.js`, `./ai/conversation.js`, `./ai/types.js` — MUST use `./ai/index.js`
  - `src/routes/lessons.ts` — currently imports from `./ai/teacher.js` and `./ai/conversation.js` — MUST use `./ai/index.js`
  - `src/routes/browse.ts` — currently imports from `./ai/types.js` — MUST use `./ai/index.js`
  - `src/onboarding/index.ts` — currently imports from `./ai/types.js`, `./ai/conversation.js`, `./ai/teacher.js` — MUST use `./ai/index.js`
  - `src/lessons/generator.ts` — currently imports from `./ai/conversation.js`, `./ai/teacher.js`, `./ai/tools.js`, `./ai/events.js`, `./ai/types.js` — MUST use `./ai/index.js`
  - `src/shared/messages.ts` — currently imports from `./ai/types.js` — MUST use `./ai/index.js`
  - `src/browse/explorer.ts` — currently imports from `./ai/types.js` — MUST use `./ai/index.js`
  - All test files importing from `./ai/fake.js`, `./ai/types.js`, `./ai/tools.js` — MUST use `./ai/index.js`
- **FR-004**: (Option B) The file `src/ai/index.ts` MUST be deleted with no replacement. The five consumer files that currently import from it (`routes/chat.ts`, `routes/missions.ts`, `routes/lessons.ts`, `routes/browse.ts`, `onboarding/index.ts`) MUST be updated to import `AIError` from `"../ai/errors.js"` instead.
- **FR-005**: (Option B) No new barrel or index file MUST be created in `src/ai/`. Each individual file in `src/ai/` IS the authoritative export source for its symbols.
- **FR-006**: The app MUST start without errors after the change. All routes, middleware, AI chat, onboarding, lesson generation, and browse flows MUST work identically to before.
- **FR-007**: The full test suite MUST pass with zero changes to test logic — only import paths may differ. Coverage requirements MUST NOT regress.
- **FR-008**: (Option A) The barrel MUST be kept in sync with the module. Any future public export added to any file in `src/ai/` MUST be accompanied by a corresponding re-export in `index.ts`. A missing re-export is a bug.
- **FR-009**: (Option A) The barrel MUST NOT import from any file in `src/ai/` in a way that creates a circular dependency. Re-exports use `export { X } from "./file.js"` syntax (which does not pull the re-exported module into the barrel's own dependency graph). Type-only re-exports MUST use `export type { X } from "./file.js"`.

### Key Entities

- **AI Barrel File (`src/ai/index.ts`)**: The module entry point for `src/ai/`. Currently re-exports types from `types.ts`, three classes/errors from other files, but omits all functions and constants from `conversation.ts`, `teacher.ts`, `tools.ts`, `events.ts`, and `workflow-state.ts`. Is the target of this fix.
- **Consumer Files**: Every file in the project that imports from `src/ai/`. These are the files that must be updated depending on the chosen option. Total: approximately 25 import paths across 15+ files (routes, services, tests, app factory).
- **Public API Surface**: Under Option A, the complete set of re-exports from `index.ts`. Under Option B, nothing — every file is equally public.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero files in `src/` (excluding test helpers and test fixtures) import from any path under `src/ai/` other than `index.js` (Option A) — verified by `grep -rn "from.*\"../ai/" src/ | grep -v "index.js"` producing zero matches. Under Option B, the barrel file simply does not exist.
- **SC-002**: `npm test` passes with zero failures, unchanged from baseline.
- **SC-003**: `npm run dev` starts without import errors or warnings.
- **SC-004**: (Option A) All previously-existing imports from individual files are replaced — a diff of `src/` before and after shows zero `from "../ai/` paths targeting non-index files.
- **SC-005**: (Option B) `ls src/ai/index.ts` returns "No such file or directory".
- **SC-006**: The change can be reviewed in under 10 minutes — it is purely mechanical import-path changes with no behavioral logic altered.

## Assumptions

- The existing test suite provides adequate coverage that no behavioral regression will go undetected. No new tests are needed for this refactoring.
- Both Option A and B are acceptable to the team. This spec does not mandate which one to implement — the implementation task will make the call or ask for clarification.
- Node.js `exports` field in `package.json` will not be used to create an alternative barrel mechanism. The fix lives entirely within `src/ai/`.
- All consumers of the AI module are inside `src/` — there are no external consumers (e.g., a separate package) that depend on the current barrel exports. Changing or removing the barrel does not affect any external API contract.
- The existing `export type { ... }` syntax for type-only re-exports will be preserved for type-only exports in Option A.
- No circular dependencies exist today between files in `src/ai/`, and the changes described here will not introduce any.
- The `WorkflowStateManager` export from `workflow-state.ts` is a legitimate public API that should be re-exported under Option A (the app factory already imports it).
- Build tooling (tsx for dev, tsc for type-checking) handles both barrel re-exports and direct file imports identically in terms of performance.
