# Implementation Plan: Hoist Duplicate parseLessonParam

**Branch**: `022-hoist-lesson-param` | **Date**: 2026-06-19 | **Spec**: `specs/022-hoist-lesson-param/spec.md`

**Input**: Feature specification from `specs/022-hoist-lesson-param/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command.

## Summary

Hoist the identical `parseLessonParam` function from `src/routes/lessons.ts` and `src/routes/lesson-generation.ts` into `src/shared/lesson-numbers.ts`, where `formatLessonNumber` and `lessonIdStr` already live. Add unit tests for the hoisted function covering all edge cases. Remove the two local definitions. Zero behavioral change.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules (`"type": "module"`)

**Primary Dependencies**: Hono (web framework), Vitest (test runner). No new dependencies.

**Storage**: N/A — pure function, no database access.

**Testing**: Vitest with in-memory SQLite via `createTestDb()`. New unit tests for `parseLessonParam` are pure-function tests (no DB, no app factory needed).

**Target Platform**: Linux server (Docker), macOS dev.

**Project Type**: Web application (Node.js/Hono backend + htmx frontend).

**Performance Goals**: N/A — refactoring of a trivial string-split function (sub-microsecond).

**Constraints**: Zero behavioral change. Existing tests must pass unmodified.

**Scale/Scope**: Single internal function, two call sites per route file (6 call sites in lessons.ts, 5 in lesson-generation.ts).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|-----------|
| I. Factory-Based Testability | Not affected — no changes to `createApp()` or dependency injection |
| II. HTTP-Level Integration Testing | Existing integration tests must pass. New unit tests for `parseLessonParam` are allowed (pure-function tests supplement HTTP-level tests) |
| III. Hypermedia-Driven Frontend | Not affected — no view or htmx changes |
| IV. Explicit Dependency Injection | Not affected — the hoisted function takes a string and returns an object; no Hono context access |
| V. Migration Snapshot Integrity | Not affected — no schema changes |
| YAGNI | The hoist eliminates existing duplication; it is anti-speculative by definition |

**Result**: PASS — all gates pass. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/022-hoist-lesson-param/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

(No `/contracts/` — no external interfaces are defined or changed.)

### Source Code (repository root)

```text
src/
├── shared/
│   └── lesson-numbers.ts    # ADD parseLessonParam export
├── routes/
│   ├── lessons.ts            # REMOVE local parseLessonParam, ADD import
│   └── lesson-generation.ts  # REMOVE local parseLessonParam, ADD import
└── test/
    └── lessons.test.ts       # ADD unit tests for parseLessonParam (or new dedicated file)
```

**Structure Decision**: Single-project layout as currently used. The hoisted function follows the established pattern of `formatLessonNumber` and `lessonIdStr` in `src/shared/lesson-numbers.ts`.

## Complexity Tracking

No constitution violations — table omitted.
