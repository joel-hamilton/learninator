# Research: Route Generator Through Store Seam

**Feature**: 014-generator-through-store-seam | **Plan**: [plan.md](./plan.md)

## Research Questions & Resolutions

### R1: Does MissionStore already expose the needed query methods?

**Decision**: Yes — no new store methods needed.

**Rationale**: `MissionStore.getLatestLesson(missionId)` returns the most recently created lesson (ordered by `id DESC`) and `MissionStore.getLesson(missionId, number, subNumber?)` looks up a lesson by its composite key. Both are already implemented in `DrizzleMissionStore` and `InMemoryMissionStore` with identical signatures. The generator's four raw Drizzle queries map 1:1 to these two existing methods.

**Alternatives considered**:
- Adding dedicated `getLatestLessonForGenerator()` method — rejected; unnecessary indirection when `getLatestLesson` already returns the correct data.
- Adding a `LessonStore` sub-interface — rejected; `MissionStore` is the single point of integration and the constitution already directs tools to use it for all DB access.

### R2: Does EventBus emit() signature match generator's current usage?

**Decision**: Yes — no EventBus changes needed.

**Rationale**: The generator calls `emit(missionId, { type: "tool_start" | "tool_end", names: string[] })`. The `EventBus.emit(missionId, event: ToolEvent)` signature matches exactly. `ToolEvent` already has `type: "tool_start" | "tool_end"` and `names: string[]`.

### R3: Should runGenerationJob accept strings or functions for prompts?

**Decision**: Functions (closures) over strings.

**Rationale**: Each generation method builds its system prompt and user message from method arguments (`missionId`, `lesson`, `mission`, `opts`). Passing functions (`() => string`) lets `runGenerationJob` remain generic while each caller's closure captures the values it needs. This avoids a bloated parameter list and keeps prompt construction next to the method that understands its own context.

**Alternatives considered**:
- Passing pre-built strings — simpler signature but loses the lazy evaluation; prompts are always built even if the job is deduplicated.
- Strategy objects — unnecessary ceremony for four call sites.

### R4: Should the generator accept store or db in Deps?

**Decision**: `store: MissionStore`, not `db`.

**Rationale**: The goal is to eliminate raw Drizzle imports from the generator. Accepting the `MissionStore` interface (not the Drizzle implementation) ensures the generator never imports `drizzle-orm` or `../db/schema.js`. This also enables unit testing with `InMemoryMissionStore`.

### R5: InMemoryMissionStore compatibility for generator tests

**Decision**: `InMemoryMissionStore` works as-is for generator tests.

**Rationale**: The store already implements `getLatestLesson` and `getLesson` with the same signatures and semantics as `DrizzleMissionStore`. Generator tests can seed lessons into the in-memory store, queue fake AI responses, and verify job lifecycle without any SQLite or migration setup.

## Resolved Technical Context

All fields from Technical Context are confirmed; no NEEDS CLARIFICATION markers remain.

| Field | Value | Source |
|-------|-------|--------|
| Language/Version | TypeScript 5.x, Node.js 22, ES modules | `package.json`, `tsconfig.json` |
| Primary Dependencies | Hono, Drizzle ORM, Anthropic SDK, Vitest | `package.json` |
| Storage | SQLite via better-sqlite3 (prod), in-memory Map (test) | `src/db/store.ts` |
| Testing | Vitest, in-memory SQLite, `app.request()`, `FakeAiClient` | `src/test/helpers.ts` |
| Target Platform | Node.js server | `src/index.ts` |
| Project Type | Web application (htmx hypermedia) | `CLAUDE.md` |
