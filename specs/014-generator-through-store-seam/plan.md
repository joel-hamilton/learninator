# Implementation Plan: Route Generator Through Store Seam

**Branch**: `ai/014-generator-through-store-seam` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-generator-through-store-seam/spec.md`

## Summary

Refactor `LessonGenerator` to depend on `MissionStore` instead of raw Drizzle, inject `EventBus` via constructor instead of module-level singleton, and extract 4x duplicated async job boilerplate into a single `runGenerationJob()` private method.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono, Drizzle ORM, Anthropic SDK, Vitest

**Storage**: SQLite via better-sqlite3 (production), in-memory Map (tests: InMemoryMissionStore)

**Testing**: Vitest, in-memory SQLite, HTTP-level via `app.request()`, FakeAiClient

**Target Platform**: Node.js server

**Project Type**: Web application (htmx hypermedia)

**Performance Goals**: Generator tests under 500ms with InMemoryMissionStore (no SQLite)

**Constraints**: Zero changes to existing test files, route handlers, or public API surface

**Scale/Scope**: Single file refactor (`src/lessons/generator.ts`) + one-line wiring change in `src/index.ts`

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | PASS | Generator already uses constructor injection; store/events replace raw db/emit |
| II. HTTP-Level Integration Testing | PASS | Existing tests use real SQLite via createApp(); unchanged |
| III. Hypermedia-Driven Frontend | PASS | No UI changes |
| IV. Explicit Dependency Injection | PASS | Moving from implicit `db: any` + module-level `emit` to explicit `store: MissionStore` + `events: EventBus` |
| V. Migration Snapshot Integrity | PASS | No schema changes |

## Project Structure

### Documentation (this feature)

```text
specs/014-generator-through-store-seam/
├── plan.md              # This file
├── spec.md              # Feature specification
└── tasks.md             # Implementation tasks
```

### Source Code (changes)

```text
src/lessons/generator.ts  # Primary change: Deps→GeneratorDeps, store+events injection, runGenerationJob extraction
src/index.ts               # Single-line wiring change: store+events instead of raw db
src/test/                  # New: generator.test.ts (unit tests with InMemoryMissionStore)
```

**Structure Decision**: Single project (existing Hono web app). The refactor touches only `src/lessons/generator.ts` (implementation) and `src/index.ts` (one-line wiring change). New unit tests go in `src/test/generator.test.ts` alongside existing test files.

## Complexity Tracking

No constitution violations — all gates pass. This is a pure refactor aligning existing code with established patterns (constructor injection, MissionStore interface, EventBus abstraction).

## Design Decisions

### D1: GeneratorDeps shape

```typescript
export interface GeneratorDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore;
  events: EventBus;
  logger: Logger;
}
```

- Rename `Deps` → `GeneratorDeps` for clarity
- Replace `db: any` with `store: MissionStore`
- Add `events: EventBus` (replaces module-level `emit`)
- `ai`, `toolExecutor`, `logger` unchanged

### D2: runGenerationJob signature

```typescript
private runGenerationJob(
  key: string,
  buildSystemPrompt: () => string,
  buildUserMessage: () => string,
  findResult: () => Promise<JobResult | null>,
  errorLabel: string,
): void
```

- Takes functions for prompt construction (not strings — shared context like `missionId`, `lesson` is captured in closures)
- `findResult` callback differs by method: `getLatestLesson` for next/sub/bridge, `getLesson` for regenerate
- `errorLabel` for logger context ("generate-next", "regenerate", etc.)

### D3: InMemoryMissionStore compatibility

The InMemoryMissionStore already implements `getLatestLesson` and `getLesson` with matching signatures. No changes needed.

### D4: EventBus injection

Replace `import { emit } from "../ai/events.js"` with `events: EventBus` in GeneratorDeps. In `runConversation`, call `this.deps.events.emit()` instead of `emit()`. In `createApp()`, pass the existing `eventBus` instance.
