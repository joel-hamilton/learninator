# Implementation Plan: Lesson QA Review

**Branch**: `027-lesson-qa-review` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-lesson-qa-review/spec.md`

## Summary

Add a second AI review pass to lesson generation that catches and corrects clear-cut errors (typos, broken HTML, verifiably wrong facts) before the student sees the lesson. The review runs sequentially within the existing background job after the main conversation loop saves the lesson. Uses a simple `ai.chat()` call — no tools needed for review. Falls back to original content on any failure.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 (ES modules)

**Primary Dependencies**: Hono (web framework), Anthropic SDK (AI), Drizzle ORM (SQLite), htmx (frontend), Vitest (testing)

**Storage**: SQLite via better-sqlite3 — no schema changes needed. Review results are ephemeral (in-memory during job lifetime).

**Testing**: Vitest with in-memory SQLite, `app.request()` HTTP-level tests, `FakeAiClient` for AI mocking

**Target Platform**: Linux server (Docker Compose)

**Project Type**: Web service (Hono + htmx)

**Performance Goals**: Lesson generation time increase ≤ 30% (per SC-002). Review step adds one AI API call with a single turn — estimated 2-5 seconds additional latency.

**Constraints**: Must not block lesson delivery. Timeout or review failure must fall back to original content. Must preserve the polling-based job status model.

**Scale/Scope**: Applies to 4 generation paths. Single background job per generation — no concurrent lesson generation for the same mission.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | ✅ Pass | Reviewer uses injected `AiClient` and `LessonStore` — no new singletons |
| II. HTTP-Level Integration Testing | ✅ Pass | `FakeAiClient` already supports queue-based `chat()` responses; lesson generation tests use `app.request()` + job polling |
| III. Hypermedia-Driven Frontend | ✅ Pass | No new UI. Existing progress bar covers review step via job message update |
| IV. Explicit Dependency Injection | ✅ Pass | `LessonGenerator` already receives deps via constructor. Reviewer uses `this.deps.ai` and `this.deps.lessonStore` |
| V. Migration Snapshot Integrity | ✅ Pass | No schema changes — review is purely a runtime pass |

**Gate result**: All pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/027-lesson-qa-review/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lessons/
│   └── generator.ts         # LessonGenerator — add reviewLesson() private method
├── ai/
│   ├── teacher.ts           # Add REVIEWER_SYSTEM_PROMPT
│   ├── types.ts             # No changes (AiClient.chat() already exists)
│   └── fake.ts              # No changes (FakeAiClient.chat() already exists)
└── test/
    └── lessons.test.ts      # Add review-specific test scenarios
```

**Structure Decision**: Single-project structure. The review is an internal step within `LessonGenerator` — no new module, no new route. A new system prompt constant goes in `src/ai/teacher.ts` alongside existing prompts.

## Complexity Tracking

> No violations — this section intentionally empty.
