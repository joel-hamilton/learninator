# Implementation Plan: Post-Lesson Navigation

**Branch**: `008-post-lesson-navigation` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-post-lesson-navigation/spec.md`

## Summary

Redesign the post-lesson action UI to be predictable and intuitive. Replace the current 6-button crammed bar with two visually distinct sections: in-lesson feedback (during active lesson) and post-completion navigation (after marking complete). Wire the existing `LessonGenerator` class into route handlers. Add missing route handlers for regenerate and bridging flows. Make generation actions deterministic: "Continue Learning" always creates a main lesson, "Dive Deeper" always creates a sub-lesson.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), htmx (frontend), Drizzle ORM + better-sqlite3, Anthropic SDK

**Storage**: SQLite via better-sqlite3. No schema changes needed — the existing `lessons` table already has `status`, `feedbackRating`, `feedbackText`, `htmlContent`, `parentLessonId`, `subNumber`, `number`.

**Testing**: Vitest with in-memory SQLite, `app.request()` HTTP-level tests, `FakeAiClient` for AI mocking

**Target Platform**: Node.js server, web browser (htmx-driven, no SPA)

**Project Type**: Web application (server-rendered HTML with htmx)

**Performance Goals**: AI generation is async with 1s polling; UI interactions (feedback, completion) respond immediately (< 50ms for non-AI actions)

**Constraints**: All AI calls must show immediate loading feedback (htmx-request CSS class + loading indicator). No JSON APIs — all responses are HTML fragments. Factory-based dependency injection via `createApp()`.

**Scale/Scope**: Single-user missions. Generation jobs are in-memory (Map-based, 60s auto-expiry). Duplicate job prevention per lesson.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ PASS | `LessonGenerator` will be injected via `createApp()` options or context middleware. Tests will use `FakeAiClient` + in-memory SQLite. |
| II. HTTP-Level Integration Testing | ✅ PASS | All new endpoints tested via `app.request()` with real SQLite. `FakeAiClient` queued responses for generation flows. |
| III. Hypermedia-Driven Frontend | ✅ PASS | All responses are HTML fragments. htmx attributes for actions. No JSON APIs. No new templating engine. |
| IV. Explicit Dependency Injection | ✅ PASS | `LessonGenerator` accessed via `c.get("lessonGenerator")` — no module-level singleton in routes. |
| V. Migration Snapshot Integrity | ✅ PASS | No schema changes. No migration needed. |

**Gate result**: All principles pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-post-lesson-navigation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── index.ts              # createApp() — inject LessonGenerator into context
├── types.ts              # AppVariables — add lessonGenerator
├── lessons/
│   └── generator.ts      # LessonGenerator — already exists, wire into routes
├── routes/
│   └── lessons.ts        # Add /regenerate, /generate-bridging routes; refactor existing
├── views/
│   └── fragments.ts      # Redesign action bars; add regenerate/bridging polling bars
├── ai/
│   ├── teacher.ts        # Regenerate/bridging system prompts — already exist
│   └── tools.ts          # regenerate_lesson tool — already exists
└── test/
    └── lessons.test.ts   # New tests for regenerate, bridging, and redesigned flows
```

**Structure Decision**: Single web application (Option 1 from template). All changes are within existing `src/` structure. No new directories needed. The `LessonGenerator` class already exists in `src/lessons/generator.ts` with all four generation methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) and job status polling — it just needs to be wired into `createApp()` and used by route handlers.

## Complexity Tracking

> No violations to justify.

## Implementation Phases

### Phase 0: Research

See [research.md](./research.md) for decisions on:
- How to inject `LessonGenerator` (context middleware vs constructor option)
- How to structure the polling endpoints (unified vs per-type)
- How "Explore Something New" integrates with existing browse flow
- How to handle the feedback→adjustment UI state transitions

### Phase 1: Design

See [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md) for:
- Entity relationships (no schema changes, but state transition diagrams)
- Route contracts for new/changed endpoints
- Validation guide for manual testing
