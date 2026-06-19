# Implementation Plan: Collapse Duplicate Lesson Formatting

**Branch**: `020-collapse-lesson-formatting` | **Date**: 2026-06-19 | **Spec**: specs/020-collapse-lesson-formatting/spec.md

**Input**: Feature specification from `specs/020-collapse-lesson-formatting/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Three identical (or identical-by-logic) implementations of `formatLessonNumber` and two of `lessonIdStr` exist across `src/views/lesson.ts`, `src/views/fragments.ts`, and `src/lessons/generator.ts`. This feature hoists both functions into a new shared module `src/shared/lesson-numbers.ts`, removes the duplicate definitions, and wires all call sites to the shared import. Unit tests covering all documented edge cases (single digit, double digit, sub-lesson, null sub, zero sub) are added alongside the module.

This is a pure refactoring -- no behavior changes, no runtime dependencies, no database schema changes.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: None (pure functions -- no new npm packages needed)

**Storage**: N/A (no database changes)

**Testing**: Vitest (existing project setup). Tests are plain unit tests -- no `app.request()`, no database, no AI client needed. This follows the same pattern as `src/shared/slug.test.ts` and `src/shared/errors.test.ts`.

**Target Platform**: Same as project (Node.js 22 on Linux/Darwin)

**Project Type**: Web application (Hono + htmx)

**Performance Goals**: N/A (negligible cost -- two string-formatting functions)

**Constraints**: Preserve identical output for every input. No changes to call-site signatures.

**Scale/Scope**: ~30 call sites across 3 files, 2 functions, ~12 lines of implementation each.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**No violations identified.**

| Principle | Check |
|-----------|-------|
| I. Factory-Based Testability | Not affected -- no `createApp()` changes, no new injectables |
| II. HTTP-Level Integration Testing | Pure functions are tested at the unit level, matching existing patterns for utility modules (`slug.test.ts`, `errors.test.ts`). This is not a violation -- `app.request()`-level testing provides no additional value for deterministic string transformations |
| III. Hypermedia-Driven Frontend | Not affected -- no new HTML rendering |
| IV. Explicit Dependency Injection | Not affected -- pure functions have no dependencies |
| V. Migration Snapshot Integrity | Not affected -- no schema changes |

## Project Structure

### Documentation (this feature)

```text
specs/020-collapse-lesson-formatting/
├── plan.md              # This file (speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (omitted -- no external interfaces)
└── tasks.md             # Phase 2 output (speckit-tasks command -- NOT created here)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── lesson-numbers.ts       # NEW: hoisted shared functions
│   └── lesson-numbers.test.ts  # NEW: unit tests
├── views/
│   ├── lesson.ts               # REMOVE: local formatLessonNumber, lessonIdStr; add import
│   └── fragments.ts            # REMOVE: local lessonIdStr, formatLessonNumber; add import
└── lessons/
    └── generator.ts            # REMOVE: private formatLessonNumber method; add import
```

**Structure Decision**: Single project (Node.js). The new module fits naturally alongside the existing shared modules in `src/shared/`. No new directories or build configuration needed.

## Complexity Tracking

> Not needed -- no constitution violations to justify.

## Phase 0: Research

No unknowns to resolve -- the spec is unambiguous. Research tasks cover verification of call-site completeness and edge case inventory.

### Research Tasks

| Task | Purpose |
|------|---------|
| R1 | Verify all call sites for both functions across the three files (grep sweep) |
| R2 | Confirm both functions produce identical output across all three implementations by reading each definition side-by-side |
| R3 | Identify whether `generator.ts` uses `lessonIdStr` (it does not -- that function only exists in `lesson.ts` and `fragments.ts`) |
| R4 | Verify that `formatLessonNumber` in `generator.ts` is a private method on the `LessonGenerator` class and is always called via `this.formatLessonNumber(...)` |

### Research Findings

All three implementations of `formatLessonNumber` are identical in logic:
- Pad the number to 4 digits with `String(num).padStart(4, "0")`
- Append `.${sub}` when `sub !== null`
- Return as-is when `sub === null`

Both implementations of `lessonIdStr` are identical in logic:
- Return `${number}.${subNumber}` when `subNumber !== null`
- Return `${number}` when `subNumber === null`

No callers exist outside the three identified files.

### Output Artifacts

- `research.md` -- consolidated findings (see above)

## Phase 1: Design & Contracts

### Data Model

No new domain entities. The spec correctly states this involves only two pure functions. See `data-model.md` for the formal entity/function contract.

### Contracts

No external interfaces. Both functions are internal to the Node.js process. No `contracts/` directory needed.

### Quickstart Validation Guide

See `quickstart.md` for runnable validation scenarios: single test run, build check, visual regression verification.

### Agent Context Update

The `CLAUDE.md` `<!-- SPECKIT START -->` / `<!-- SPECKIT END -->` markers will be updated to reference this plan file.

## Phase 2: Tasks

Generated by `speckit-tasks` in a subsequent step. Expected task breakdown:

1. Create `src/shared/lesson-numbers.ts` with exported `formatLessonNumber` and `lessonIdStr`
2. Create `src/shared/lesson-numbers.test.ts` with tests covering all edge cases (single digit, double digit, sub-lesson, null sub, zero sub)
3. Update `src/views/lesson.ts` -- remove local definitions, add import
4. Update `src/views/fragments.ts` -- remove local definitions, add import
5. Update `src/lessons/generator.ts` -- remove private method, add import, change `this.formatLessonNumber(...)` calls to bare function calls
6. Run full test suite to confirm no regressions
