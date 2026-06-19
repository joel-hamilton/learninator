# Feature Specification: EventBus Interface Split

**Feature Branch**: `025-eventbus-interface-split`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Split the EventBus interface in src/ai/events.ts into two focused interfaces: ToolEventBus and WorkflowEventBus."

## User Scenarios & Testing

### User Story 1 - Developers configure event wiring by interface contract (Priority: P1)

As a developer wiring up the application in `src/index.ts`, I want to create and pass only the event bus interface that each consumer actually needs, so that I can see at a glance what each module depends on and the type system prevents passing the wrong bus to the wrong consumer.

**Why this priority**: This is the primary motivation — cleaning up the single `EventBus` that conflates two domains makes the dependency graph clearer and catches wiring mistakes at compile time.

**Independent Test**: Each consumer module (conversation loop, workflow state manager, home SSE route, lesson generator, mission chat service) accepts only the bus interface it actually uses. Compilation with TypeScript strict mode passes without errors. No `c.get("events")` call site needs to import both sub-interfaces unless it genuinely consumes both event domains.

**Acceptance Scenarios**:

1. **Given** the type definitions in `src/ai/events.ts`, **When** a developer inspects the `ConversationLoopParams` type, **Then** its `events` field references `ToolEventBus` and has no access to `subscribeUser`/`emitUser`.
2. **Given** the type definitions in `src/ai/events.ts`, **When** a developer inspects the `WorkflowStateManager` constructor parameter, **Then** it references `WorkflowEventBus` and has no access to `subscribe`/`emit`.
3. **Given** the `homeRoutes` SSE endpoint, **When** a developer reads `c.get("events").subscribeUser(...)`, **Then** the returned type is `WorkflowEventBus` and the tool-event methods (`subscribe`, `emit`) are not accessible.
4. **Given** `createEventBus()`, **When** a developer calls the factory, **Then** the returned value satisfies both `ToolEventBus` and `WorkflowEventBus` so callers that need both (like `src/index.ts`) can use a single created instance.

---

### User Story 2 - Developers maintain event subsystems in isolation (Priority: P2)

As a developer making changes to the tool-event subsystem (e.g., adding a new tool event type), I want to modify only the `ToolEventBus` interface and its associated types without touching `WorkflowEventBus`, and be confident the tests for the workflow subsystem still pass unchanged.

**Why this priority**: Independent evolution of the two event domains reduces merge conflicts and cognitive load when working on either subsystem.

**Independent Test**: A change that adds a new method to `ToolEventBus` compiles with zero modifications to `WorkflowEventBus`. All existing workflow-related tests (workflow-state tests, home SSE tests) continue to pass without alteration.

**Acceptance Scenarios**:

1. **Given** the split interfaces, **When** a new method is added to `ToolEventBus`, **Then** only call sites that pass `ToolEventBus` need updates, and no `WorkflowEventBus` consumer is affected.
2. **Given** the split interfaces, **When** `WorkflowEventBus` is refactored, **Then** no changes are required in files that import only `ToolEventBus`.

---

### User Story 3 - Developers write focused mocks for each event domain (Priority: P3)

As a developer writing tests, I want to create a mock or fake that implements only `ToolEventBus` or only `WorkflowEventBus`, so that my test setup is minimal and only needs to satisfy the contract under test.

**Why this priority**: Smaller mock surface leads to simpler test setup and fewer coupling points in test code.

**Independent Test**: A test for the conversation loop can instantiate a `FakeToolEventBus` with just `subscribe` and `emit` methods, and pass it where `ToolEventBus` is expected. No workflow-related methods need to be implemented.

**Acceptance Scenarios**:

1. **Given** the split interfaces, **When** a test creates an object implementing only `ToolEventBus`, **Then** it can be passed to `conversationLoop` without TypeScript errors.
2. **Given** the split interfaces, **When** a test creates an object implementing only `WorkflowEventBus`, **Then** it can be passed to `WorkflowStateManager` and `homeRoutes` without TypeScript errors.

---

### Edge Cases

- What happens if a single component genuinely needs both tool and workflow events? The component should depend on both interfaces (via intersection type `ToolEventBus & WorkflowEventBus` or two separate constructor parameters). This is currently the case for `src/index.ts` and `createMissionChatService`.
- What about the `LessonGenerator`? It passes `events` to `conversationLoop`, so it only needs `ToolEventBus`. Its `options` type should be updated accordingly.
- What about tests that create `createEventBus()` and use both subscriber domains? They should continue to work since `createEventBus()` returns an object satisfying both interfaces.

## Requirements

### Functional Requirements

- **FR-001**: `src/ai/events.ts` MUST define two separate interfaces: `ToolEventBus` (with `subscribe`/`emit` for mission-scoped tool events) and `WorkflowEventBus` (with `subscribeUser`/`emitUser` for user-scoped workflow events).
- **FR-002**: The existing `EventBus` interface MUST be removed and replaced with the two focused interfaces.
- **FR-003**: `createEventBus()` MUST return an object that satisfies both `ToolEventBus` and `WorkflowEventBus`.
- **FR-004**: `ConversationLoopParams.events` MUST be typed as `ToolEventBus` (optional).
- **FR-005**: `WorkflowStateManager.constructor` MUST accept `WorkflowEventBus` instead of `EventBus`.
- **FR-006**: The `homeRoutes` SSE endpoint's `c.get("events")` MUST be typed as `WorkflowEventBus` at the call site.
- **FR-007**: `createLessonGenerator` and `LessonGenerator` options MUST accept `ToolEventBus` instead of `EventBus`.
- **FR-008**: `createMissionChatService` MUST accept both `ToolEventBus` and `WorkflowEventBus` (or an intersection type) since it passes events to both `conversationLoop` and `WorkflowStateManager`.
- **FR-009**: `src/index.ts` MUST continue to work with a single `createEventBus()` call whose return value satisfies both interfaces.
- **FR-010**: The `src/types.ts` `AppVariables.events` field MUST be updated to reflect the correct interface.
- **FR-011**: All existing tests MUST pass without modification, except where imports or type references to `EventBus` need updating.
- **FR-012**: The barrel export in `src/ai/index.ts` MUST export both `ToolEventBus` and `WorkflowEventBus` types.
- **FR-013**: Test files using `createEventBus()` for integration test setup MUST continue to work without changes.
- **FR-014**: Test files implementing fake or spy `EventBus` implementations MUST be updated to implement the appropriate sub-interface.

### Key Entities

- **ToolEventBus**: Interface for mission-scoped tool execution progress events. Methods: `subscribe(missionId, callback)`, `emit(missionId, event)`. Associated types: `ToolEvent`, `ToolEventCallback`.
- **WorkflowEventBus**: Interface for user-scoped workflow lifecycle events. Methods: `subscribeUser(userId, callback)`, `emitUser(userId, event)`. Associated types: `WorkflowEvent`, `WorkflowEventCallback`.
- **createEventBus()**: Factory function returning an object that satisfies both `ToolEventBus` and `WorkflowEventBus`. Maintains backward compatibility for call sites that need both interfaces.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every consumer module (conversation loop, workflow state manager, lesson generator, mission chat service, home SSE route) is parameterized with the narrower of the two interfaces — no consumer receives methods it never calls.
- **SC-002**: The `EventBus` identifier (the old combined interface) does not appear anywhere in the codebase as a type reference to the combined interface type. (The old name may remain as an alias or be removed entirely.)
- **SC-003**: All existing tests pass with zero changes to test logic — only import and type-reference updates in test files that directly reference `EventBus`.
- **SC-004**: TypeScript compilation (`tsc --noEmit`) passes with no errors.
- **SC-005**: A developer can create a fake implementing only `ToolEventBus` and pass it to `conversationLoop` without implementing any `WorkflowEventBus` methods, and vice versa.

## Assumptions

- The `LessonGenerator` only passes events to `conversationLoop` and does not emit workflow events directly; therefore it only needs `ToolEventBus`.
- `createMissionChatService` needs both event domains because it creates both a `conversationLoop` (tool events) and manages workflow lifecycle via `WorkflowStateManager` (workflow events).
- The home route SSE endpoint only subscribes to workflow events and never emits or subscribes to tool events.
- No external consumers of `EventBus` exist outside the `src/` directory.
- The factory function `createEventBus()` will continue to return a single object that satisfies both interfaces, avoiding the need to create two separate event bus instances.
