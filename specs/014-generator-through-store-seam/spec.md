# Feature Specification: Route Generator Through Store Seam

**Feature Branch**: `014-generator-through-store-seam`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Route LessonGenerator through MissionStore instead of raw Drizzle, and extract shared job-boilerplate into a private method."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generator Uses MissionStore Instead of Raw Drizzle (Priority: P1)

A maintainer needs to change the database schema (e.g., rename a column in the `lessons` table). After the change, they update the `DrizzleMissionStore` and `InMemoryMissionStore` implementations. The `LessonGenerator` continues to work without any source-code changes, because it only depends on the `MissionStore` interface.

**Why this priority**: Every schema change currently requires updates in two places (the store AND the generator). This is the primary motivation for the refactor — eliminating a duplicated maintenance burden that will only grow as the schema evolves. The store is the single point of integration.

**Independent Test**: Instantiate a `LessonGenerator` with an `InMemoryMissionStore`, call all four generation methods, and verify they complete without any direct Drizzle imports being reachable from the generator module.

**Acceptance Scenarios**:

1. **Given** a `LessonGenerator` constructed with a `MissionStore` (instead of raw `db`), **When** `generateNext` is called, **Then** the method calls `store.getLatestLesson(missionId)` instead of running a raw Drizzle `SELECT ... ORDER BY id DESC LIMIT 1` query.
2. **Given** a `LessonGenerator` constructed with a `MissionStore`, **When** `generateSubLesson` is called, **Then** the method calls `store.getLatestLesson(missionId)` instead of running a raw Drizzle query.
3. **Given** a `LessonGenerator` constructed with a `MissionStore`, **When** `generateRegenerate` is called, **Then** the method calls `store.getLesson(missionId, number, subNumber)` instead of running a raw Drizzle query with `and()` + `eq()` + `isNull()`.
4. **Given** a `LessonGenerator` constructed with a `MissionStore`, **When** `generateBridging` is called, **Then** the method calls `store.getLatestLesson(missionId)` instead of running a raw Drizzle query.
5. **Given** an `InMemoryMissionStore` that implements `getLatestLesson` and `getLesson`, **When** it is injected into a `LessonGenerator`, **Then** all four generation methods work identically to when a `DrizzleMissionStore` is used.

---

### User Story 2 - Shared Job-Boilerplate Extracted (Priority: P1)

A maintainer needs to add a fifth generation method (e.g., `generateRemedial`). Instead of copying the same ~25 lines of async job scaffolding (IIFE, try/catch/finally, `setTimeout` cleanup), they call a single private `runGenerationJob()` method that handles all of the boilerplate. The new method only needs to provide a system prompt, a user message, and a result-identification function.

**Why this priority**: The four existing methods share ~80% identical code. Every copy increases the chance of bugs (one method was missing a `logger.error` call, another had a different `setTimeout` duration). Extracting the boilerplate reduces the maintenance surface by 4x.

**Independent Test**: Verify that `generateNext`, `generateSubLesson`, `generateRegenerate`, and `generateBridging` all produce identical `InternalJob` lifecycle behavior (status transitions, message tracking, `setTimeout` cleanup) after the refactor, by calling each and polling `getJobStatus`.

**Acceptance Scenarios**:

1. **Given** the `LessonGenerator` class, **When** inspected, **Then** a single private `runGenerationJob()` method exists that encapsulates the IIFE pattern, message initialization, error handling, `setTimeout` cleanup, and per-method-variant dispatching.
2. **Given** the refactored `generateNext` method, **When** called, **Then** it delegates to `runGenerationJob()` with a unique system prompt, user message, and a result-finding callback that calls `store.getLatestLesson(missionId)`.
3. **Given** the refactored `generateRegenerate` method, **When** called, **Then** it delegates to `runGenerationJob()` with a result-finding callback that calls `store.getLesson(missionId, number, subNumber)` (because regeneration modifies in-place, not by appending).
4. **Given** a job that completes successfully in the refactored code, **When** `getJobStatus` returns its terminal state, **Then** the job is deleted from internal storage after a 60-second delay (preserving existing cleanup behavior).
5. **Given** a job that throws an error in the refactored code, **When** `getJobStatus` returns the error state, **Then** the error message is logged and the job is cleaned up after 60 seconds.

---

### User Story 3 - EventBus Injected via Constructor (Priority: P2)

A maintainer runs the test suite. The `LessonGenerator` no longer imports the module-level `emit` singleton from `../ai/events.js`; instead, it receives an `EventBus` instance through its constructor. In the test setup, a spy `EventBus` can verify that the correct tool events are emitted during generation.

**Why this priority**: The module-level `EventBus` singleton in `events.ts` prevents the generator from being unit-tested in isolation. A spy/injectable `EventBus` enables deterministic testing of event emission without shared mutable state.

**Independent Test**: Construct a `LessonGenerator` with a test `EventBus` that records all events, call a generation method, and assert that `tool_start` and `tool_end` events were emitted for the expected tool names.

**Acceptance Scenarios**:

1. **Given** the `Deps` interface (renamed to `GeneratorDeps`), **When** inspected, **Then** it contains `events: EventBus` instead of the generator importing the module-level `emit` function.
2. **Given** a `LessonGenerator` constructed with a test `EventBus` spy, **When** `generateNext` triggers a tool execution, **Then** the spy records a `tool_start` event with the correct tool names.
3. **Given** a `LessonGenerator` constructed with a test `EventBus` spy, **When** tool execution completes, **Then** the spy records a `tool_end` event with the matching tool names.
4. **Given** a `LessonGenerator` constructed with a test `EventBus` spy, **When** a generation method completes, **Then** no unhandled errors are thrown (the spy should not interfere with normal operation).
5. **Given** the production `createApp()` factory in `src/index.ts`, **When** it creates the `LessonGenerator`, **Then** it passes the same `eventBus` instance that was created for the request pipeline, ensuring tool events are visible to SSE subscribers.

---

### User Story 4 - Generator Testable Without Real SQLite (Priority: P2)

A developer writes a new unit test for the `LessonGenerator`'s job-lifecycle logic (e.g., verifying that duplicate job keys are rejected, or that the 60-second cleanup fires). They instantiate the generator with an `InMemoryMissionStore` and a fake `AiClient` — no SQLite database, no migrations, no file I/O. The test completes in under 100ms.

**Why this priority**: The current design forces any test of the generator to set up a real SQLite database. An `InMemoryMissionStore` makes tests faster, more deterministic, and easier to write. This lowers the barrier to adding generator tests.

**Independent Test**: Write a test that seeds an `InMemoryMissionStore` with a lesson, calls `generateNext` with matching args, and verifies the resulting job key is returned and the job status eventually becomes "done" (when a fake AI response is queued).

**Acceptance Scenarios**:

1. **Given** an `InMemoryMissionStore` seeded with a mission and lesson, a `FakeAiClient` with queued responses, and a `LessonGenerator` wired with both, **When** `generateNext` is called, **Then** the returned job key is not empty and `getJobStatus(key)` initially returns `{ status: "running" }`.
2. **Given** a `LessonGenerator` wired with `InMemoryMissionStore`, **When** `generateNext` is called twice with the same arguments, **Then** the second call returns the same job key (deduplication) and does not start a second job.
3. **Given** a `LessonGenerator` wired with `InMemoryMissionStore`, **When** a job completes, **Then** `getJobStatus` returns the terminal state, and a subsequent call returns `{ status: "not_found" }` (job was consumed and cleaned up).
4. **Given** the same setup, **When** the AI throws an error during generation, **Then** `getJobStatus` returns `{ status: "error" }` with an error message, and the job is cleaned up.

---

### User Story 5 - Existing Production Behavior is Preserved (Priority: P1)

A developer deploys the refactored `LessonGenerator`. All existing generation flows (next lesson, sub-lesson, regenerate, bridging) continue to work identically. Existing route handlers, polling bars, and htmx fragments require no changes. The `AppVariables` type and the `c.get("lessonGenerator")` injection point are unchanged.

**Why this priority**: This is a structural refactor with zero behavioral change. Any regression in generation behavior would be visible to end users as broken "Continue Learning", "Dive Deeper", "Make Easier/Harder", or "Bridging" buttons.

**Independent Test**: Run the full existing test suite (`npm test`). All existing tests pass without modification because the generator's public API (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`, `getJobStatus`, `buildJobKey`) and its return types (`JobStatus`) are unchanged.

**Acceptance Scenarios**:

1. **Given** the refactored `LessonGenerator`, **When** any external module imports it, **Then** all public exports (`JobStatus`, `Deps`/`GeneratorDeps`, `buildJobKey`, `LessonGenerator`, `createLessonGenerator`) remain available with matching signatures.
2. **Given** the refactored `Deps` interface, **When** a consumer constructs a `LessonGenerator`, **Then** it can pass `store` instead of `db`, but `db` is no longer accepted — the TypeScript compiler catches this at build time.
3. **Given** the `createApp()` factory in `src/index.ts`, **When** it creates the `LessonGenerator`, **Then** it passes `store` (the `DrizzleMissionStore` instance) and `events` (the `EventBus` instance) instead of the raw Drizzle `db`.
4. **Given** the refactored generator, **When** a generation job runs to completion, **Then** the `lessonNumber`, `lessonSubNumber`, and `lessonTitle` in the job result are identical to what the current code produces.
5. **Given** the refactored generator, **When** a generation job encounters an error, **Then** the error message in `getJobStatus` is identical in content and format to the current error handling.

---

### Edge Cases

- What happens when `store.getLatestLesson(missionId)` returns `undefined` (no lessons exist)? The current code handles this silently — `job.result` stays `null` and `job.status` is set to `"done"`. The refactored code must preserve this behavior: the result-finding callback should be a no-op (or handle `undefined` gracefully).
- What happens when `store.getLesson(missionId, number, subNumber)` returns `undefined` in `generateRegenerate`? The current code skips setting `job.result`, leaving it `null`, and sets `job.status = "done"`. The refactored code must do the same.
- What happens when the same `missionId` + `number` + `subNumber` combination is used for different generation types (e.g., both "next" and "sub")? The key prefix (`type`) ensures no collision — `buildJobKey` already uses `type` as the first segment.
- What happens when `generateRegenerate` is called for a lesson that was regenerated in-place but the AI didn't actually update it? The result-finding callback won't find a "new" lesson — but `getLesson` will still find the existing one. The current code sets `job.result` from the found lesson. The refactored code must do the same.
- What happens when an `EventBus` subscriber throws an error? The `EventBus` implementation already swallows subscriber errors. The refactored generator must not add additional error handling beyond calling `events.emit()`.
- What happens if a job is already running and `runGenerationJob` is called with the same key? The guard (`if (this.jobs.has(key)) return key`) at the top of each public method prevents this — the refactor must keep this guard in each public method before delegating to `runGenerationJob`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `Deps` interface MUST be renamed to `GeneratorDeps` (or equivalent) and MUST replace the raw `db: any` field with `store: MissionStore`.
- **FR-002**: The `Deps`/`GeneratorDeps` interface MUST accept an optional `events: EventBus` field. When present, the generator MUST call `events.emit()` instead of the module-level `emit()` singleton for tool lifecycle events.
- **FR-003**: The `LessonGenerator` constructor MUST accept the new `GeneratorDeps` shape. Instantiation with an old-style `Deps` that has `db` instead of `store` MUST cause a TypeScript compilation error.
- **FR-004**: All raw Drizzle imports (`drizzle-orm`, `../db/schema.js`) MUST be removed from `generator.ts`. The generator MUST NOT import `eq`, `and`, `isNull`, `desc`, or the `schema` object.
- **FR-005**: A private `runGenerationJob()` method MUST be added to `LessonGenerator` that encapsulates the shared async job lifecycle: `InternalJob` creation, IIFE with try/catch/finally, conversation loop dispatch, error logging, and 60-second `setTimeout` cleanup.
- **FR-006**: The `runGenerationJob()` method MUST accept a callback or strategy for identifying the result lesson after the conversation loop completes. Different callbacks handle `getLatestLesson` (for next/sub/bridge) vs. `getLesson` (for regenerate).
- **FR-007**: Each public generation method (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) MUST retain its current deduplication guard (`if (this.jobs.has(key)) return key`) and its current `buildJobKey` call.
- **FR-008**: Each public generation method MUST continue to return the same `string` job key type, and `getJobStatus(key)` MUST return the same `JobStatus` type.
- **FR-009**: The `createApp()` factory in `src/index.ts` MUST construct the `LessonGenerator` with `store` and `events` instead of the raw Drizzle `db`. The module-level `emit` import from `events.ts` MUST still work for any other remaining consumers outside the generator.
- **FR-010**: The `buildJobKey` helper function, the `JobStatus` type, and the `LessonGenerator` class MUST remain publicly exported from the `generator.ts` module.
- **FR-011**: The `InMemoryMissionStore` and `DrizzleMissionStore` MUST both continue to implement `getLatestLesson()` and `getLesson()` with the same signatures — no changes to the store interface are needed since the required methods already exist.
- **FR-012**: All existing route handlers in `src/routes/lessons.ts` that use `c.get("lessonGenerator")` MUST continue to work without changes. The `AppVariables` type MUST NOT require updates.

### Key Entities

- **MissionStore**: The interface defining all database access methods. `DrizzleMissionStore` is the production SQLite implementation; `InMemoryMissionStore` is the test in-memory implementation. After this refactor, the `LessonGenerator` depends exclusively on this interface.
- **LessonGenerator**: The asynchronous job manager for AI-generated lesson content. Manages a `Map<string, InternalJob>` of in-flight generation tasks. Provides polling-based status via `getJobStatus(key)`. Receives `store`, `ai`, `toolExecutor`, `events`, and `logger` via constructor.
- **InternalJob**: The private job-tracking structure. Contains status, message list, result (lesson number/subNumber/title), and error string. Managed entirely inside `LessonGenerator` — never exposed outside the module.
- **EventBus**: The publish/subscribe mechanism for tool lifecycle events. After this refactor, the `LessonGenerator` receives its own `EventBus` instance via constructor rather than importing the module-level singleton, enabling test isolation and predictable event routing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four existing generation methods produce identical `JobStatus` results (same lesson numbers, titles, and error messages) before and after the refactor, verified by running the existing test suite.
- **SC-002**: Number of lines of duplicate boilerplate across the four generation methods is reduced from approximately 100 lines of near-identical code to exactly 1 shared `runGenerationJob()` call per method.
- **SC-003**: The generator module (`src/lessons/generator.ts`) no longer imports from `drizzle-orm` or from `../db/schema.js` — verifiable by grepping the file for these imports after the refactor.
- **SC-004**: A developer can construct a `LessonGenerator` with `InMemoryMissionStore` and a `FakeAiClient` (no real SQLite, no migrations) and successfully test all four generation methods in under 500ms total.
- **SC-005**: `npm test` passes with zero modifications to existing test files — the refactor is purely internal to the generator's implementation and its constructor wiring in `createApp()`.

## Assumptions

- The `MissionStore` interface already exposes `getLatestLesson(missionId)` and `getLesson(missionId, number, subNumber?)` methods that return the same data the generator currently queries via raw Drizzle. No new store methods need to be added.
- The `InMemoryMissionStore` already implements `getLatestLesson` and `getLesson` — it can be used as the test double for generator unit tests immediately, with no changes.
- The module-level `emit` function in `events.ts` is only imported by `generator.ts` among the AI-related modules. Other consumers (if any) will continue to use the module-level singleton unchanged.
- The `EventBus` interface's `emit(missionId, ToolEvent)` signature is compatible with the generator's current usage (`emit(missionId, { type: "tool_start", names })` and `emit(missionId, { type: "tool_end", names })`). No changes to the EventBus are required.
- The public API surface of the generator module (`JobStatus`, `buildJobKey`, `LessonGenerator`, `createLessonGenerator`) is stable and will not change — this refactor only changes internal implementation details and constructor dependencies.
- The `Deps` interface is only used to construct the generator inside `createApp()` and potentially in tests. Renaming it to `GeneratorDeps` will not affect any external consumers.
- Route handlers in `lessons.ts` access the generator via `c.get("lessonGenerator")` (Hono context injection), not by constructing it directly. Therefore, changes to the constructor signature only affect the single construction site in `src/index.ts`.
