# Implementation Plan: Deepen AIError — inline the format pass-through

**Branch**: `021-deepen-ai-error` | **Date**: 2026-06-19 | **Spec**: specs/021-deepen-ai-error/spec.md

**Input**: Feature specification from `specs/021-deepen-ai-error/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command.

## Summary

Move the user-facing error message formatting logic from the standalone `formatAIError()` function in `src/shared/errors.ts` onto `AIError.prototype.toUserMessage()` in `src/ai/errors.ts`, then remove the dead code. This is a pure mechanical refactoring — all six production call sites change from `formatAIError(err)` to the pattern `err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."`. No behavioral change, no new entities, no schema changes.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES Modules (`"type": "module"`)

**Primary Dependencies**: None new — code moves within the existing project. The `AIError` class already depends on the `createLogger` from `src/logger.js`.

**Storage**: N/A — no database changes.

**Testing**: Vitest. Existing test file at `src/shared/errors.test.ts` (7 test cases for `formatAIError`) will be migrated to `src/ai/errors.test.ts`, retargeting against `AIError.prototype.toUserMessage`.

**Target Platform**: Linux server (Docker Compose), macOS development.

**Project Type**: Web application (Hono + htmx + SQLite).

**Performance Goals**: Not applicable — this is a trivial string concatenation at error-reporting call sites on infrequent error paths.

**Constraints**: Zero behavioral change in error messages. Every rendered message must be byte-identical before and after the refactoring.

**Scale/Scope**: 1 file deleted (`src/shared/errors.ts`), ~15 lines added to `src/ai/errors.ts`, 6 call sites patched across 5 route files, 1 test file relocated and retargeted.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Rationale |
|-----------|--------|-----------|
| I. Factory-Based Testability | PASS | `AIError` is an error class instantiated via `new`, not through the factory. No impact on `createApp()` or dependency injection. |
| II. HTTP-Level Integration Testing | PASS | Existing route tests that assert on error messages continue to pass unchanged — no test logic is modified, only import/file references change. |
| III. Hypermedia-Driven Frontend | PASS | No frontend or view code is touched. Error messages continue to render as before. |
| IV. Explicit Dependency Injection | PASS | `AIError` does not access `c.get("db")` or any Hono context. No DI impact. |
| V. Migration Snapshot Integrity | PASS | No schema changes. No `schema.ts` edit, no migration, no snapshot. |

**Result**: All gates pass. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/021-deepen-ai-error/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — no unknowns found
├── data-model.md        # Phase 1 output — AIError class, method contract
├── quickstart.md        # Phase 1 output — validation guide
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

The feature touches existing files only — no new directories or files (the test file is relocated within the same project tree):

```text
src/
├── ai/
│   ├── errors.ts        # MODIFY — add toUserMessage()
│   └── errors.test.ts   # CREATE — migrated from src/shared/errors.test.ts
├── routes/
│   ├── browse.ts        # MODIFY — 1 call site
│   ├── chat.ts          # MODIFY — 1 call site
│   ├── lessons.ts       # MODIFY — 1 call site
│   ├── missions.ts      # MODIFY — 1 call site
│   └── onboarding.ts    # MODIFY — 2 call sites
└── shared/
    └── errors.ts        # DELETE
```

**Structure Decision**: Single project (unchanged). All changes are within existing `src/` tree.

## Complexity Tracking

No constitution violations to resolve. Table omitted.

## Phase 0 — Research

### Unknowns Assessment

All technical details are fully specified. Zero `NEEDS CLARIFICATION` items.

### Research Tasks

None required. The spec defines every acceptance scenario, every interface contract (`toUserMessage(fallback?: string): string`), every migration pattern (`err instanceof AIError ? err.toUserMessage() : default`), and every cleanup step (delete `src/shared/errors.ts`, remove imports).

## Phase 1 — Design

### Key Entity

**AIError** (existing class in `src/ai/errors.ts`):

| Member | Kind | Current | After |
|--------|------|---------|-------|
| `message` | public inherited | string from Error | unchanged |
| `status` | public readonly | number \| undefined | unchanged |
| `recoverable` | public readonly | boolean (default false) | unchanged |
| `toUserMessage()` | new method | — | string, appended hint when recoverable |

### Interface Contracts

No external interfaces are changed. The method is internal-only (called from route catch blocks). No contracts/ directory needed.

### Validation Scenarios

See `quickstart.md` for runnable validation.
