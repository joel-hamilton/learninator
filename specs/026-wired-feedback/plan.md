# Implementation Plan: Wired Feedback

**Branch**: `026-wired-feedback` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/026-wired-feedback/spec.md`

## Summary

Two changes that close the feedback loop: (1) an inline textarea replaces the silent "Thanks!" after rating a lesson, so students can explain *why* they found it too hard or too easy; (2) feedback history is programmatically injected into every generation prompt so calibration doesn't depend on AI voluntarily calling `list_feedback_history`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (web framework), htmx (frontend), Drizzle ORM + better-sqlite3 (storage), Anthropic SDK (AI)

**Storage**: SQLite via better-sqlite3. Existing `lessons` table columns (`feedbackRating`, `feedbackText`) are sufficient — no schema changes.

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`, `FakeAiClient` for AI

**Target Platform**: Server-rendered web app (Node.js + htmx)

**Project Type**: Web application (single-process, hypermedia-driven)

**Performance Goals**: Same as existing — generation jobs are async, bar swaps are instant HTML fragment responses

**Constraints**: No new dependencies. Must pass existing 323 tests. No schema migration.

**Scale/Scope**: 2 modified UI fragments, 1 modified route handler (feedback POST), 4 modified generation configs (system prompt + user message), 1 new shared function (`buildFeedbackSummary`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | PASS | Generator already uses injected store; feedback summary function is pure, testable in isolation |
| II. HTTP-Level Integration Testing | PASS | New feedback textarea + submission flow testable via `app.request()`; feedback injection testable by inspecting FakeAiClient prompt |
| III. Hypermedia-Driven Frontend | PASS | Inline textarea uses htmx patterns; no JS framework; textarea toggles via CSS/htmx swaps |
| IV. Explicit Dependency Injection | PASS | Generator receives store via constructor; feedback summary uses store interface, not raw DB |
| V. Migration Snapshot Integrity | PASS | No schema changes — no migration needed |

## Project Structure

### Documentation (this feature)

```text
specs/026-wired-feedback/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── routes.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── ai/
│   └── teacher.ts           # TEACHER_SYSTEM_PROMPT (minor: remove redundant "ALWAYS call list_feedback_history" since it's now injected)
├── lessons/
│   └── generator.ts         # injectFeedbackSummary() in buildSystemPrompt/buildUserMessage for all 4 generation configs
├── routes/
│   ├── lessons.ts           # POST /:number/feedback — accept feedbackText in body, return new feedbackThanksBar inline
│   └── lesson-generation.ts # regenerate/bridging routes — accept and forward feedback text
├── shared/
│   └── feedback-summary.ts  # NEW: buildFeedbackSummary(store, missionId) → string
└── views/
    └── fragments.ts         # feedbackThanksBar — replace silent confirmation with inline textarea; lessonActionBar — add JS for textarea toggle
```

**Structure Decision**: Single project structure. All changes are within existing `src/` directories. One new file in `src/shared/`.

## Complexity Tracking

No constitution violations. No complexity tracking needed.
