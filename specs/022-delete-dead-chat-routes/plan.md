# Implementation Plan: Delete Dead ChatRoutes Module

**Branch**: `022-delete-dead-chat-routes` | **Date**: 2026-06-19 | **Spec**: `specs/022-delete-dead-chat-routes/spec.md`

**Input**: Feature specification from `specs/022-delete-dead-chat-routes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Delete the unused `src/routes/chat.ts` file, which exports `chatRoutes` but is never imported or mounted anywhere in the codebase. The real chat handler lives in `src/routes/missions.ts:311`. The dead file is a stale duplicate that lacks the `handleActivation()` call and `onboardingMode` support present in the real handler. No other files are modified.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)

**Primary Dependencies**: None — this is a file deletion with no dependency changes

**Storage**: Not affected — no schema or data changes

**Testing**: Vitest, in-memory SQLite via `app.request()`. All existing tests must pass without modification after deletion.

**Target Platform**: Node.js 22 (same as the rest of the application)

**Project Type**: Web application (Node.js/TypeScript, Hono framework with htmx)

**Performance Goals**: Not applicable — dead-code removal, no runtime behavior change

**Constraints**:
- Zero behavioral change — the real handler is untouched
- No other files must be modified
- All existing tests must pass without modification
- TypeScript compilation (`tsc --noEmit`) must be clean

**Scale/Scope**: Single file deletion — `src/routes/chat.ts` (60 lines). No other files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Impact | Status |
|-----------|--------|--------|
| I. Factory-Based Testability | Not affected — the deleted file was never wired through the factory | PASS |
| II. HTTP-Level Integration Testing | Not affected — the deleted file had no tests (never imported) | PASS |
| III. Hypermedia-Driven Frontend | Not affected — no frontend changes | PASS |
| IV. Explicit Dependency Injection | Not affected — the real chat handler uses `c.get("missionChatService")` and remains unchanged | PASS |
| V. Migration Snapshot Integrity | Not affected — no schema changes | PASS |
| No speculative features (YAGNI) | The dead file IS speculative/stale code. Removing it aligns with this principle | PASS |

**Result**: All gates pass. No violations to document.

## Project Structure

### Documentation (this feature)

```text
specs/022-delete-dead-chat-routes/
├── plan.md              # This file
├── spec.md              # Feature specification
└── tasks.md             # Implementation tasks (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/routes/
└── chat.ts              # Deleted — the only change
```

**Structure Decision**: Single file deletion. The dead module is isolated at `src/routes/chat.ts`. No other files are created or modified.

## Complexity Tracking

No constitution violations exist. The change is a straightforward file deletion with no complexity concerns.

## Phase 0 -- Research (research.md)

No NEEDS CLARIFICATION items. The spec is fully specified.

**Pre-deletion verification** (from spec User Story 2):

Comparison of the dead file (`src/routes/chat.ts`) vs. the real handler (`src/routes/missions.ts:311`):

| Aspect | Dead file | Real handler | Assessment |
|--------|-----------|-------------|------------|
| Route definition | `chatRoutes.post("/", ...)` | `missionRoutes.post("/:missionId/chat", ...)` | Different router, same effective path; dead file was never mounted |
| Imports | Has unused imports (`conversationLoop`, `createStandardHooks`, `TEACHER_SYSTEM_PROMPT`, `TEACHER_TOOLS`) | No unused AI imports | Dead file has stale imports; no unique logic lost |
| Empty message handling | Returns full HTML div | Returns `c.text("")` | Dead file version is not superior |
| `context` parameter | Reads `body.context` | Not present | Real handler doesn't need it |
| `onboardingMode` | Not passed to `missionChatService.run()` | Passed when mission status is "onboarding" | Dead file is missing this -- would have been a bug if it were mounted |
| `handleActivation()` call | Not present | Present (lines 97, 343) | Dead file is a stale copy missing activation handling |
| `userInitial()` usage | Used for CSS class generation | Not used | Minor cosmetic difference; real handler is the authoritative version |
| Error styling | `color:var(--danger)` | `color:#c00` | Cosmetic; both render as red text |

**Conclusion**: The dead file contains NO unique logic that needs to be preserved. It is a stale copy that lacks the `handleActivation()` call and `onboardingMode` support. Safe to delete.

## Phase 1 -- Design & Contracts (data-model.md, quickstart.md)

**data-model.md**: Not applicable -- no data model changes.

**Contracts**: Not applicable -- no external interfaces are created or modified.

**quickstart.md**: Not needed for this feature. The deletion is verified by:
1. Running `npm test` -- all tests pass
2. Running `npx tsc --noEmit` -- clean compilation
3. Running `grep -rn "chatRoutes\|from.*chat" src/ --include='*.ts'` -- no hits after deletion
