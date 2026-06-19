# Tasks: Route Generator Through Store Seam

**Feature**: 014-generator-through-store-seam | **Plan**: [plan.md](./plan.md)

## Task List

### T1: Rename Deps → GeneratorDeps and replace db with store [P1]

- [ ] In `src/lessons/generator.ts`, rename `Deps` interface to `GeneratorDeps`
- [ ] Replace `db: any` field with `store: MissionStore`
- [ ] Add `import type { MissionStore } from "../db/store.js"`
- [ ] Remove `import { eq, and, isNull, desc } from "drizzle-orm"`
- [ ] Remove `import * as schema from "../db/schema.js"`
- [ ] Update `createLessonGenerator(deps: GeneratorDeps)` signature
- [ ] Update `this.deps` type annotation in constructor
- [ ] Verify TypeScript compiles (will fail until store calls are wired)

### T2: Add EventBus to GeneratorDeps and inject instead of module-level emit [P2]

- [ ] Add `events: EventBus` to `GeneratorDeps`
- [ ] Add `import type { EventBus } from "../ai/events.js"`
- [ ] Remove `import { emit } from "../ai/events.js"`
- [ ] In `runConversation`, replace `emit(missionId, ...)` with `this.deps.events.emit(missionId, ...)`
- [ ] Verify TypeScript compiles

### T3: Extract runGenerationJob() private method [P1]

- [ ] Create `runGenerationJob()` method with signature:
  ```
  private runGenerationJob(
    key: string,
    systemPrompt: string,
    messages: AiMessageParam[],
    findResult: () => Promise<JobResult | null>,
    errorLabel: string,
  ): void
  ```
- [ ] Encapsulate: InternalJob creation, IIFE, try/catch/finally, conversation loop, result finding, error logging, setTimeout cleanup
- [ ] Refactor `generateNext` to delegate to `runGenerationJob`
- [ ] Refactor `generateSubLesson` to delegate to `runGenerationJob`
- [ ] Refactor `generateRegenerate` to delegate to `runGenerationJob`
- [ ] Refactor `generateBridging` to delegate to `runGenerationJob`

### T4: Replace raw Drizzle queries with store calls [P1]

- [ ] In `generateNext`: replace Drizzle `SELECT ... ORDER BY id DESC LIMIT 1` with `this.deps.store.getLatestLesson(missionId)`
- [ ] In `generateSubLesson`: same replacement
- [ ] In `generateBridging`: same replacement
- [ ] In `generateRegenerate`: replace Drizzle `SELECT ... WHERE and(eq, eq, isNull)` with `this.deps.store.getLesson(missionId, number, subNumber)`
- [ ] Each findResult callback handles `undefined` by returning `null` (preserving existing behavior)

### T5: Wire store + events in createApp() [P1]

- [ ] In `src/index.ts`, update `createLessonGenerator()` call:
  - Replace `db: resolvedDb` with `store`
  - Add `events: eventBus`
- [ ] No other changes to `createApp()` or route handlers

### T6: Add generator unit tests with InMemoryMissionStore [P2]

- [ ] Create `src/test/generator.test.ts`
- [ ] Test: construct LessonGenerator with InMemoryMissionStore, FakeAiClient, EventBus spy
- [ ] Test: generateNext creates a job, returns key, job progresses to done
- [ ] Test: duplicate job key returns same key (deduplication)
- [ ] Test: getJobStatus transitions: not_found → running → done → not_found (consumed)
- [ ] Test: error handling sets status to "error"
- [ ] Test: EventBus spy records tool_start and tool_end events

### T7: Verify existing tests pass and type check [P1]

- [ ] Run `npm run typecheck` (or `npx tsc --noEmit`)
- [ ] Run `npm test` — all existing tests pass without modification
- [ ] Verify no Drizzle imports remain in generator.ts
