# Implementation Plan: Deduplicate Guided-Question JavaScript

**Branch**: `023-deduplicate-guided-js` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-deduplicate-guided-js/spec.md`

## Summary

Remove the inline duplicate function definitions (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`) from the `pageHead()` HTML template in `src/views/shared.ts` and replace them with a reference to the already-exported `GUIDED_QUESTION_SCRIPT` constant. The approach is to strip the `<script>` wrapper from `GUIDED_QUESTION_SCRIPT` (making it raw JS) and update the one caller (`onboarding.ts`) that depends on the script wrapper. This is a pure mechanical refactor with zero behavioral change.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (server), htmx (frontend)

**Storage**: N/A — no data entities modified

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`

**Target Platform**: Web server (Docker / Node.js)

**Project Type**: Web application (server-rendered HTML with htmx)

**Performance Goals**: N/A — rendering-only change, no runtime performance impact

**Constraints**: N/A

**Scale/Scope**: Single file modification (`src/views/shared.ts`), single caller update (`src/views/onboarding.ts`)

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Factory-Based Testability | PASS | No new components introduced |
| II. HTTP-Level Integration Testing | PASS | Existing 290 tests cover all guided-question behavior; SC-003 requires `npm test` passes unmodified |
| III. Hypermedia-Driven Frontend | PASS | No frontend architecture changes; pure JS deduplication |
| IV. Explicit Dependency Injection | PASS | No changes to dependency wiring |
| V. Migration Snapshot Integrity | PASS | No schema changes |

**Result: ALL GATES PASS — no violations. Complexity Tracking table is not needed.**

## Project Structure

### Documentation (this feature)

```text
specs/023-deduplicate-guided-js/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no data model changes)
├── quickstart.md        # Phase 1 output (validation guide)
└── contracts/           # Skipped — no external interfaces
```

### Source Code (repository root)

```text
src/views/
├── shared.ts            # Modified — deduplicate guided-question JS
├── onboarding.ts        # Modified — adapt to script-tag-free GUIDED_QUESTION_SCRIPT
└── ...                  # Unchanged files
```

**Structure Decision**: Single-project web application. The refactoring affects exactly two files in `src/views/`.

## Complexity Tracking

**Not required** — all Constitution gates passed with no violations.
