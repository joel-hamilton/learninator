# Implementation Plan: Tool Store Type Narrowing

**Branch**: `025-tool-store-type-narrowing` | **Date**: 2026-06-19 | **Spec**: spec.md

**Input**: Feature specification from `/specs/025-tool-store-type-narrowing/spec.md`

## Summary

Narrow each AI tool handler function's `store` parameter type from the full `ToolStore` (intersection of 6 interfaces) to only the individual store interface(s) the handler actually uses. This is a pure type-level change with zero runtime cost — TypeScript's structural typing guarantees that the concrete `ToolStore` satisfies all narrower interfaces. The handler map in `createToolExecutor` will use a minimal type assertion to accommodate the divergent handler signatures.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)

**Primary Dependencies**: None (no new dependencies; the `ToolStore` intersection type and individual store interfaces — `ContentStore`, `LessonStore`, `ChatStore`, `MissionStore`, `RefDocStore`, `LearningRecordStore` — are already defined in `src/db/store.ts`)

**Storage**: N/A (no runtime change)

**Testing**: Vitest (`npm test`). Existing tests must pass without modification since no runtime behavior changes.

**Target Platform**: Same as project (Node.js 22+, server-side)

**Project Type**: Web service (Hono + htmx)

**Performance Goals**: Zero runtime cost — type annotations are erased at compile time.

**Constraints**:
- No runtime behavior changes whatsoever
- All existing tests must pass without modification
- TypeScript compilation (`npx tsc --noEmit`) must succeed with zero errors

**Scale/Scope**: 17 tool handler functions in `src/ai/tools.ts` to narrow. Each maps to 1 of the 6 store interfaces (some handlers to the same interface).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Factory-Based Testability

**Status: PASS**

No impact. The concrete `DrizzleMissionStore` implements all 6 store interfaces. The `createToolExecutor(store: ToolStore)` factory signature remains unchanged — it still accepts the full `ToolStore`. Only the internal handler parameter types change.

### Gate II — HTTP-Level Integration Testing

**Status: PASS**

No impact. Tests construct `FakeAiClient` with queued responses. The store object passed through the AI pipeline is unchanged at runtime — only type annotations change. Tests continue to use `createTestDb()` and `createTestApp()` identically.

### Gate III — Hypermedia-Driven Frontend

**Status: PASS**

No impact. This change is entirely server-side type annotations with zero frontend effects.

### Gate IV — Explicit Dependency Injection

**Status: PASS**

No impact. The `ToolExecutor` interface in `src/ai/types.ts` is unchanged. The injection of the store through the AI tool execution pipeline is unchanged at runtime.

### Gate V — Migration Snapshot Integrity

**Status: PASS**

No impact. No schema changes are involved.

**Overall Gate Result: ALL PASS** — Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/025-tool-store-type-narrowing/
├── plan.md              # This file (/speckit-plan command output)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no new data entities)
├── quickstart.md        # Phase 1 output (validation guide)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── types.ts          # Remove or keep ToolHandler type alias; handler parameter types move inline
│   ├── tools.ts          # Narrow each handler's store parameter; adapt buildHandlerMap()
│   └── ...               # No other files need changes
└── test/
    └── ...               # No test changes needed
```

**Structure Decision**: Single project — no new files or directories, only type annotation changes within existing files.

## Complexity Tracking

**No constitution violations** — Complexity Tracking table is not required.

## Handler-to-Interface Mapping

| Handler | Methods Called | Store Interface |
|---|---|---|
| `readMissionContent` | `getMissionContent` | `ContentStore` |
| `writeMissionContent` | `upsertMissionContent` | `ContentStore` |
| `readResources` | delegates to `readMissionContent` | `ContentStore` |
| `writeResources` | delegates to `writeMissionContent` | `ContentStore` |
| `createLesson` | `getMainLessonCount`, `createLesson` | `LessonStore` |
| `createSubLesson` | `getLesson`, `getSubLessonCount`, `createLesson` | `LessonStore` |
| `readLesson` | `getLesson` | `LessonStore` |
| `listLessons` | `listLessons` | `LessonStore` |
| `listFeedbackHistory` | `listLessonFeedback` | `LessonStore` |
| `regenerateLesson` | `getLesson`, `updateLessonContent` | `LessonStore` |
| `createReferenceDoc` | `createReferenceDoc` | `RefDocStore` |
| `listReferenceDocs` | `listReferenceDocs` | `RefDocStore` |
| `createLearningRecord` | `getLearningRecordCount`, `createLearningRecord` | `LearningRecordStore` |
| `listLearningRecords` | `listLearningRecords` | `LearningRecordStore` |
| `updateLearningRecord` | `listLearningRecords`, `updateLearningRecord` | `LearningRecordStore` |
| `markMissionActive` | `updateMissionStatus` | `MissionStore` |
| `askGuidedQuestion` | `createGuidedQuestion` | `ChatStore` |

## Design Decision: Handler Map Adaptation

The `ToolHandler` type alias (`(ctx: ToolHandlerContext) => Promise<string>`) cannot accommodate handlers with different narrowed `store` parameter types. Three approaches were evaluated:

1. **Union of handler signatures**: Type-safe but verbose.
2. **Generic wrapper function**: Unnecessary abstraction for a no-runtime-change refactor.
3. **Minimal type assertion in `buildHandlerMap()`** (chosen): Keep `ToolHandler` for backward compat. Cast each handler to `ToolHandler` in the map constructor. Safe because at runtime, the concrete `ToolStore` satisfies all narrower interfaces.

```typescript
// Chosen approach — cast is safe due to structural subtyping
function buildHandlerMap(): Map<string, ToolHandler> {
  return new Map([
    ["read_mission_content", readMissionContent as ToolHandler],
    // ...
  ]);
}
```
