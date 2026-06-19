# Implementation Plan: Extract View-Model Functions

**Branch**: `021-extract-view-model-functions` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-extract-view-model-functions/spec.md`

## Summary

Extract three inline data-transformation computations from route handlers into pure, independently-testable functions: (a) lesson grouping enrichment in `missions.ts`, (b) chat message HTML rendering in `missions.ts`, and (c) prev/next lesson navigation in `lessons.ts`. Routes become thin coordinators — fetch data, call view model, return HTML. Each extracted function can be unit-tested without HTTP, auth, or database setup.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: None beyond standard TypeScript types already defined in the project (LessonSummary, ChatMessageRow)

**Storage**: N/A — extracted functions are pure computations over in-memory data

**Testing**: Vitest — unit tests call extracted functions directly with plain data, no Hono `app.request()` needed

**Target Platform**: Linux server (Docker), macOS (dev)

**Project Type**: Web application (Hono/htmx/SQLite)

**Performance Goals**: Negligible — these are lightweight in-memory transformations already running on every page load; extraction does not change performance characteristics

**Constraints**: No change to rendered output; existing integration tests must pass without modification

**Scale/Scope**: Three extractions from two route files; new module under `src/view-models/` (or optionally co-located as module-level exports within route modules)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Factory-Based Testability — PASS (no violation)
The extracted functions do not use `createApp()` at all. They are pure functions that receive data and return data/HTML. This is consistent with the factory pattern since they don't need injection — they are the kind of deterministic logic the constitution encourages.

### II. HTTP-Level Integration Testing — PASS (no violation)
Extraction does not replace or bypass integration testing. It adds a complementary unit-test layer below integration tests. Existing integration tests continue to exercise the full request/response cycle.

### III. Hypermedia-Driven Frontend — PASS (no violation)
Chat message rendering produces HTML fragments compatible with the existing htmx-driven frontend. The rendered output is identical.

### IV. Explicit Dependency Injection — PASS (no violation)
Extracted functions accept only plain data parameters, not Hono context. This is consistent with "a handler that reads db from context is testable" — and these functions don't need db at all.

### V. Migration Snapshot Integrity — N/A
No schema changes.

**Additional gates from spec**:
- No user-facing behavior change: existing integration tests must pass without modification.

### Gates

| Gate | Status |
|------|--------|
| G1: No change to rendered output | Pass |
| G2: Functions are pure (no Hono, no DB, no side effects) | Pass |
| G3: Existing integration tests pass | Pass |
| G4: Diagram consistency check | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/021-extract-view-model-functions/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── view-models/
│   ├── index.ts          # Re-exports
│   ├── lesson-grouping.ts     # lessonGrouping() function
│   ├── chat-messages.ts       # renderChatMessages() function
│   └── lesson-navigation.ts   # computeLessonNavigation() function
├── routes/
│   ├── missions.ts       # Updated: calls view-model functions
│   └── lessons.ts        # Updated: calls view-model function
└── test/
    ├── view-models/
    │   ├── lesson-grouping.test.ts
    │   ├── chat-messages.test.ts
    │   └── lesson-navigation.test.ts
    ├── missions.test.ts   # Unchanged — integration tests still pass
    └── lessons.test.ts    # Unchanged — integration tests still pass
```

**Structure Decision**: New `src/view-models/` module for pure data-transformation and HTML-rendering functions. This follows the constitution's emphasis on testability and separation of concerns. View rendering functions (`lessonCard`, `chatMessageBubble`, `formatMarkdown`, etc.) remain in `src/views/` as they are — the extracted functions call into them.

## Complexity Tracking

> No Constitution Check violations — this table is empty.
