# Implementation Plan: Type the InMemory Store Adapters

**Branch**: `021-type-inmemory-stores` | **Date**: 2026-06-19 | **Spec**: `specs/021-type-inmemory-stores/spec.md`

**Input**: Feature specification from `specs/021-type-inmemory-stores/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace all `any[]` internal collections and `any` parameter types in the 8 InMemory store classes at the bottom of `src/db/store.ts` with the corresponding Drizzle-inferred row types (`MissionRow`, `LessonRow`, `ChatMessageRow`, `GuidedQuestionRow`, `ReferenceDocRow`, `LearningRecordRow`, `MissionContentRow`, `UserRow`, `SessionRow`) so that TypeScript catches invalid field values at compile time rather than silently passing them to the production Drizzle store.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)

**Primary Dependencies**: Drizzle ORM (better-sqlite3) — row types from `$inferSelect` / `$inferInsert` on the schema tables

**Storage**: No storage changes — this is a type-only change to in-memory test stores

**Testing**: Vitest, in-memory SQLite via `createTestDb()`, `FakeAiClient`. The typed InMemory stores will be used directly in tests (via `InMemoryMissionStore`, `InMemoryLessonStore`, etc.)

**Target Platform**: N/A — type-only change, not platform-specific

**Project Type**: Web application (Node.js/TypeScript, Hono framework)

**Performance Goals**: N/A — purely a compile-time type safety change

**Constraints**:
- Zero behavioral change — runtime values must be identical before and after
- All existing tests must pass without any modifications to test files
- No `any` type may remain in any InMemory store collection declaration or method return type

**Scale/Scope**: 8 InMemory store classes in a single file (`src/db/store.ts`), lines 526–642. 9 row types to apply across collections and method signatures.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Impact | Status |
|-----------|--------|--------|
| I. Factory-Based Testability | Not affected — InMemory stores are already injectable, typing does not change the factory pattern | PASS |
| II. HTTP-Level Integration Testing | Enhanced — typed InMemory stores catch type errors at compile time, strengthening test validity | PASS |
| III. Hypermedia-Driven Frontend | Not related | PASS |
| IV. Explicit Dependency Injection | Not affected — store interfaces remain unchanged; only internal collection types and method signatures change | PASS |
| V. Migration Snapshot Integrity | Not affected — no schema changes | PASS |
| No speculative features (YAGNI) | The change directly addresses concrete `any[]` collections that silently accept bad data | PASS |

**Result**: All gates pass. No violations to document.

## Project Structure

### Documentation (this feature)

```text
specs/021-type-inmemory-stores/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Not needed — no external interfaces
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

No new files or directories — all changes are within the existing `src/db/store.ts` file, lines 526–642 (the InMemory store classes below the `DrizzleMissionStore` class).

```text
src/db/store.ts           # Only file modified — 8 InMemory store classes
src/test/*.test.ts        # Unchanged — all existing tests must pass as-is
```

**Structure Decision**: Single-file change. The InMemory stores are co-located with the DrizzleMissionStore in `src/db/store.ts`. No restructuring needed.

## Complexity Tracking

No constitution violations exist, so this table is not populated. The change is mechanically straightforward: typed array declarations and typed method parameters/returns.

## Phase 0 — Research (research.md)

No NEEDS CLARIFICATION items. The spec is fully specified. The research document captures the mapping of each row type to each InMemory store, the approach for typing the spread-construction pattern, and the edge cases identified during analysis.

## Phase 1 — Design & Contracts (data-model.md, quickstart.md)

- **data-model.md**: Maps each InMemory store class to its row type, documents the typed method signature changes, and covers the spread-construction typing strategy.
- **Contracts**: Not applicable — no external interfaces are created or modified.
- **quickstart.md**: Documents the validation scenarios: compile-time check with `--strict`, enum value validation test, and full test suite pass.
