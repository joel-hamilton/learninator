# Feature Specification: Unify EventBus Wiring

**Feature Branch**: `015-unify-eventbus-wiring`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Unify EventBus Wiring -- the EventBus in src/ai/events.ts has two competing dependency injection strategies. Most consumers get it from Hono context (c.get('events')), but src/lessons/generator.ts uses a module-level singleton via convenience exports (import { emit } from '../ai/events.js')."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer wiring a new EventBus consumer (Priority: P1)

As a developer adding a new module that needs to emit tool or workflow events, I want a single, consistent way to obtain an EventBus reference so I do not need to reason about which injection strategy to use.

**Why this priority**: Consistency of dependency injection is the core goal of this feature. Every future consumer benefits, and the existing inconsistency is a maintenance trap that can silently introduce bugs (e.g., singleton not properly disposed in test, or events emitted on the wrong bus instance).

**Independent Test**: Can be fully tested by verifying that every file importing from `events.ts` uses either `createEventBus()` (to make a bus) or the `EventBus` type, and no file imports the convenience exports (`emit`, `subscribe`, `emitUser`, `subscribeUser`). Delivers a uniform wiring pattern across the entire codebase.

**Acceptance Scenarios**:

1. **Given** the project source code, **When** I search for imports of `emit`, `subscribe`, `emitUser`, or `subscribeUser` from `events.ts`, **Then** no file imports these convenience exports (the only importers are the `EventBus` type or the `createEventBus` factory).

2. **Given** any module that needs event emission, **When** I look at how it obtains its `EventBus`, **Then** it always receives it via dependency injection (constructor parameter, Hono context, or function argument) and never via a module-level singleton.

---

### User Story 2 - Developer testing lesson generation events (Priority: P1)

As a developer writing tests for lesson generation, I want to inject a spy EventBus into the `LessonGenerator` so I can assert that the correct tool events are emitted during generation without relying on the global singleton.

**Why this priority**: The singleton import path (`import { emit } from "../ai/events.js"`) makes the generator untestable for event-related behavior. Fixing this is the primary motivation for the feature.

**Independent Test**: Can be fully tested by creating a `LessonGenerator` with a mock EventBus, triggering a generation, and asserting that `emit` was called with the expected `ToolEvent` payloads. Delivers testability for event emission in the lesson generation pipeline.

**Acceptance Scenarios**:

1. **Given** a test that creates a `FakeEventBus` (a test double implementing the `EventBus` interface), **When** I instantiate a `LessonGenerator` with that bus and run a generation job, **Then** `FakeEventBus.emit` is called with `{ type: "tool_start", names: [...] }` and `{ type: "tool_end", names: [...] }` at the expected points.

2. **Given** the existing test suite, **When** I run `npm test`, **Then** all existing tests continue to pass without modification (the change is purely additive to the `Deps` interface -- the `events` field is optional or always provided by `createApp()`).

---

### User Story 3 - Developer cleaning up the events module (Priority: P2)

As a maintainer of `src/ai/events.ts`, I want to remove the module-level singleton and its four convenience exports so the module has a single responsibility: defining the `EventBus` interface and providing the `createEventBus()` factory.

**Why this priority**: Removing dead or deprecated code reduces cognitive load and eliminates the risk of new consumers accidentally depending on the singleton. This is lower priority than the injection fix because it is cleanup rather than a correctness fix.

**Independent Test**: Can be tested by verifying that `events.ts` exports only the `EventBus` type and `createEventBus` function (plus the `ToolEvent` and `WorkflowEvent` types). Delivers a leaner, more maintainable module.

**Acceptance Scenarios**:

1. **Given** the `events.ts` module, **When** I inspect its public exports, **Then** the following are no longer exported: `subscribe`, `emit`, `subscribeUser`, `emitUser`.

2. **Given** the `events.ts` module, **When** I run the test suite and the TypeScript compiler, **Then** no compilation errors occur and all tests pass.

---

### Edge Cases

- What happens if `createLessonGenerator` is called without an `events` field in the deps object? The change should be backward-compatible by either making `events` optional in `Deps` with a no-op fallback, or by always providing it from `createApp()`. Given that `createApp()` always creates an `eventBus`, the latter is preferred -- no optional field needed.
- How does the system handle the rare case where the singleton's event listeners had accumulated state (e.g., leftover SSE subscribers) that depended on the singleton's identity? Since the singleton `defaultBus` was never exposed for external subscription (the routes all use the Hono-injected bus), no external code depends on `defaultBus` having subscribers. The singleton is effectively unreachable for subscription, so its removal is safe.
- What if a future developer unfamiliar with the project accidentally imports the convenience exports from `events.ts` before they are removed? The removal will cause a compile-time TypeScript error, making this obvious at development time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `LessonGenerator` constructor SHALL accept an optional `events: EventBus` field in its `Deps` parameter.
- **FR-002**: The `LessonGenerator.runConversation` method SHALL use `this.deps.events.emit()` instead of the module-level `emit()` singleton when the `events` dep is provided.
- **FR-003**: The `createApp()` factory in `src/index.ts` SHALL pass the `eventBus` instance to `createLessonGenerator()` via the `Deps.events` field.
- **FR-004**: If `LessonGenerator` is constructed without an `events` dep, its `runConversation` method SHALL silently skip event emission (no crash).
- **FR-005**: The module-level singleton `defaultBus` and its four convenience exports (`subscribe`, `emit`, `subscribeUser`, `emitUser`) SHALL be removed from `src/ai/events.ts`.
- **FR-006**: The `src/ai/events.ts` module SHALL continue to export the `EventBus` interface, `createEventBus()` factory, `ToolEvent`, and `WorkflowEvent` types.
- **FR-007**: All existing consumers of `EventBus` via Hono context (`c.get("events")`) SHALL continue to work unchanged.
- **FR-008**: The `src/lessons/generator.ts` file SHALL no longer import from `"../ai/events.js"` after the change (the `EventBus` type may be imported if needed for the `Deps` interface).
- **FR-009**: No file in the project SHALL import the convenience exports (`emit`, `subscribe`, `emitUser`, `subscribeUser`) from `events.ts` after the change.

### Key Entities

- **EventBus**: An interface defining four methods (`subscribe`, `emit`, `subscribeUser`, `emitUser`) for publishing tool-level events (scoped to a mission) and workflow-level events (scoped to a user). Created via the `createEventBus()` factory.
- **LessonGenerator**: A class that generates lessons in background async jobs. Receives its dependencies via a `Deps` constructor parameter. Currently receives `ai`, `toolExecutor`, `db`, and `logger` -- will also receive `events`.
- **Deps (LessonGenerator)**: The dependency injection interface for `LessonGenerator`. Defined inline in `generator.ts` at line 19 with fields `ai`, `toolExecutor`, `db`, `logger`. Will gain an `events` field pointing to the `EventBus` instance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All `EventBus` consumers in the project use a single injection strategy (constructor parameter or Hono context), verified by grep audit showing zero imports of the singleton convenience exports.
- **SC-002**: A `LessonGenerator` instantiated with a mock/spy `EventBus` correctly records `tool_start` and `tool_end` events during generation, verified by a new unit test.
- **SC-003**: The existing test suite passes with zero modifications (`npm test` exits with code 0), proving backward compatibility.
- **SC-004**: The `events.ts` module exports no more than five items: `EventBus` (type), `createEventBus` (function), `ToolEvent` (type), `WorkflowEvent` (type), and optionally `ToolEventCallback`/`WorkflowEventCallback` types if they are reused elsewhere.

## Assumptions

- All existing consumers of `EventBus` via `c.get("events")` are correctly wired and will not be affected by the change, since they already use `createEventBus()` via the middleware and do not reference the singleton.
- The singleton `defaultBus` has no subscribers that outlive a single request cycle, because `subscribe`/`subscribeUser` are only called by the SSE route handlers which receive the Hono-injected bus, not the singleton. Therefore removing `defaultBus` will not orphan active subscriptions.
- The `AppVariables` type in `src/types.ts` already includes `events: EventBus` and `lessonGenerator: LessonGenerator` -- no type changes needed at the Hono context level.
- `npm test` provides sufficient regression coverage; no additional integration tests specific to event emission in lesson generation are required for the success criteria (a unit test is sufficient).
- The `Deps` interface in `generator.ts` can reference the `EventBus` type directly -- either by importing it or by defining `events` as a structurally compatible callback.
