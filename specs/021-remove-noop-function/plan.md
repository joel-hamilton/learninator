# Implementation Plan: Remove No-Op Function

**Branch**: (none — code cleanup, no branch needed) | **Date**: 2026-06-19 | **Spec**: specs/021-remove-noop-function/spec.md

**Input**: Feature specification from `specs/021-remove-noop-function/spec.md`

## Summary

Delete the `hideBannerOnSettle()` no-op function (always returns `""`) and all 6 call sites from `src/views/fragments.ts`. The rendered HTML output is identical before and after the change since the function contributed an empty string in every template literal interpolation.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: None (purely a source cleanup — no dependency changes)

**Storage**: N/A

**Testing**: Vitest (`npm test`). All existing tests MUST pass with zero modifications.

**Target Platform**: N/A (no runtime behavior change)

**Project Type**: Web application — single file source cleanup in `src/views/fragments.ts`

**Performance Goals**: N/A (dead code removal has no measurable performance impact)

**Constraints**: HTML output must be byte-identical to pre-change output.

**Scale/Scope**: 1 file, 1 function definition + 6 call sites removed. No new code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Rationale |
|-----------|-----------|-----------|
| I. Factory-Based Testability | PASS | No changes to factory, DI, or entry point. |
| II. HTTP-Level Integration Testing | PASS | Test suite must pass without modification. Removal of dead code does not affect any test path. |
| III. Hypermedia-Driven Frontend | PASS | No change to view rendering strategy (still template literals, still htmx). |
| IV. Explicit Dependency Injection | PASS | No changes to Hono context or dependency wiring. |
| V. Migration Snapshot Integrity | PASS | No schema changes. |

**Result**: ALL GATES PASS — no constitution violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/021-remove-noop-function/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (trivial — no data)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (empty — no external interfaces)
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

No structural changes. The only affected file is:

```
src/views/fragments.ts
```

**Structure Decision**: Existing project layout unchanged. Single-file deletion within `src/views/`.

## Complexity Tracking

Not required — all constitution gates pass.
