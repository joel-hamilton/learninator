# Feature Specification: Decouple Conversation Hooks

**Feature Branch**: `021-decouple-conversation-hooks`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Untie the conversation hook knot — move event emission out of createStandardHooks and into conversationLoop itself, simplifying the hooks interface and removing duplicated event wiring in LessonGenerator."

## User Scenarios & Testing

### User Story 1 — Conversation Loop Emits Events Directly (Priority: P1)

A developer integrating a new feature that uses `conversationLoop` observes that `tool_start` and `tool_end` events fire automatically during tool execution, without needing to wire them manually. The `ConversationHooks` interface no longer requires event-related callbacks.

**Why this priority**: This is the core change. Event emission is a framework concern that every caller benefits from; moving it into `conversationLoop` eliminates duplication at the source.

**Independent Test**: A test using a real `EventEmitter` connected to `conversationLoop` observes `tool_start` and `tool_end` events emitted for each tool execution step, without any hooks configuration.

**Acceptance Scenarios**:

1. **Given** a `conversationLoop` invocation with an `EventEmitter` and tool blocks, **When** the loop executes a tool, **Then** a `tool_start` event is emitted before execution and a `tool_end` event after execution.
2. **Given** a `conversationLoop` invocation without an `EventEmitter`, **When** the loop executes a tool, **Then** no events are emitted (no crash, no undefined errors).
3. **Given** a `conversationLoop` invocation with no tool blocks in the AI response, **When** the loop processes the response, **Then** no `tool_start` or `tool_end` events are emitted.

---

### User Story 2 — createStandardHooks Only Persists to DB (Priority: P1)

A developer examining `createStandardHooks` sees that it only saves assistant messages and tool results to the database via `saveMessage()`. It no longer contains event emission wiring.

**Why this priority**: Simplifying `createStandardHooks` is the direct beneficiary of the refactor. All existing chat routes that use it continue to work unchanged.

**Independent Test**: `createStandardHooks` can be unit-tested by calling it and verifying the returned hooks object contains only the DB-saving callbacks, with no event emission logic.

**Acceptance Scenarios**:

1. **Given** a call to `createStandardHooks(emitter, saveMessage)`, **When** inspecting the returned hooks object, **Then** it contains only the domain callbacks (no event emission logic integrated into the hooks).
2. **Given** a refactored call to `createStandardHooks(saveMessage)` (emitter removed from parameter), **When** the returned hooks are invoked, **Then** no events are emitted — only DB saves occur.

---

### User Story 3 — LessonGenerator Reuses Framework Event Emission (Priority: P1)

A developer implementing lesson generation progress sees that `LessonGenerator.runConversation` no longer manually wires `tool_start`/`tool_end` events. Instead, it relies on `conversationLoop` to emit events, and only provides a domain-specific callback to append tool labels to `job.messages`.

**Why this priority**: Removing the duplicated event wiring from `LessonGenerator` is the main motivator for this refactor. This proves the new design works for both callers.

**Independent Test**: A lesson generation job running through `conversationLoop` emits events visible to the job progress UI, and tool labels correctly appear in `job.messages`, without any event emission code inside `LessonGenerator`.

**Acceptance Scenarios**:

1. **Given** a `LessonGenerator` invocation, **When** the AI calls a tool, **Then** a `tool_start` event with the tool name is emitted by `conversationLoop`, and a `tool_end` event is emitted after.
2. **Given** a `LessonGenerator` invocation, **When** the AI calls a tool, **Then** the tool label is appended to `job.messages` via the `onAfterToolExecution` callback.
3. **Given** a `LessonGenerator` invocation, **When** no events are wired (no `EventEmitter`), **Then** the lesson generation still completes successfully and tool labels still appear in `job.messages`.

---

### User Story 4 — New Callers Get Event Emission for Free (Priority: P2)

A developer adds a new feature that uses `conversationLoop` with tool execution. They notice that progress events appear in the UI automatically, without needing to study how `createStandardHooks` works or reimplement event wiring.

**Why this priority**: This demonstrates the long-term maintainability win, but is not needed for the initial refactor to deliver value.

**Independent Test**: A new `conversationLoop` caller with an `EventEmitter` sees `tool_start`/`tool_end` events without importing or configuring any event-related code in their hook callbacks.

**Acceptance Scenarios**:

1. **Given** a new caller that invokes `conversationLoop` with an `EventEmitter`, **When** any tool block is executed, **Then** events fire without the caller implementing any event emission logic.

---

### Edge Cases

- What happens when `conversationLoop` is called with an `EventEmitter` that was already disposed or closed? The loop should not crash — it should catch errors from `emit` calls gracefully (e.g., if listeners have been removed).
- How does the system handle a tool that fails during execution? The `tool_end` event should still be emitted (with an error indicator), so the UI does not hang with a perpetual "tool running" spinner.
- What happens when `conversationLoop` processes a response with no tool blocks? No events are emitted.

## Requirements

### Functional Requirements

- **FR-001**: `conversationLoop` MUST emit `tool_start` before executing each tool block, containing the tool name as payload.
- **FR-002**: `conversationLoop` MUST emit `tool_end` after executing each tool block (regardless of success or failure), containing the tool name and result or error as payload.
- **FR-003**: `conversationLoop` MUST accept an optional `EventEmitter` parameter. If absent, no events are emitted.
- **FR-004**: The `ConversationHooks` type MUST be simplified by removing event emission callbacks. Hooks become pure domain callbacks.
- **FR-005**: The `ConversationHooks` type MUST provide `onBeforeToolExecution` (receives content blocks) and `onAfterToolExecution` (receives results) as the only hook points.
- **FR-006**: `createStandardHooks` MUST only perform DB persistence via `saveMessage()`. It MUST NOT contain event emission logic.
- **FR-007**: `LessonGenerator.runConversation` MUST NOT contain event emission wiring. It MUST rely on `conversationLoop` for events.
- **FR-008**: `LessonGenerator.runConversation` MUST provide only the `job.messages` update logic in its `onAfterToolExecution` callback.
- **FR-009**: All existing callers of `createStandardHooks` (chat routes, mission routes) MUST continue to work without changes to their invocation.
- **FR-010**: All existing callers of `conversationLoop` that pass an `EventEmitter` MUST see events emitted at the same points as before.
- **FR-011**: If event emission fails (e.g., emitter error), `conversationLoop` MUST NOT crash — the error MUST be caught and logged, and tool execution MUST continue.

### Key Entities

- **ConversationHooks (type)**: The interface defining domain callbacks for the conversation loop. After refactor: contains `onBeforeToolExecution` and `onAfterToolExecution` as the only callback keys.
- **conversationLoop (function)**: The core multi-turn AI conversation driver. After refactor: directly emits `tool_start`/`tool_end` events via an injected `EventEmitter`.
- **createStandardHooks (factory)**: Produces a `ConversationHooks` object for standard chat flows. After refactor: contains only `saveMessage` persistence logic.
- **LessonGenerator (class)**: Generates lessons using AI conversation. After refactor: provides only domain-specific `job.messages` update in hooks, receiving event emission from `conversationLoop`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `createStandardHooks` loses all event emission logic — the function body shrinks by removing the `emit` calls and `pendingToolNames` tracking.
- **SC-002**: `LessonGenerator.runConversation` loses all event emission wiring — the duplicated `pendingToolNames` tracking and `emit` calls are removed.
- **SC-003**: All existing tests pass without modification (chat tests, mission tests, lesson tests) — proving backward compatibility.
- **SC-004**: A new test exists that verifies `conversationLoop` emits `tool_start`/`tool_end` events without any hooks configuration.
- **SC-005**: Code reviewers can confirm the `ConversationHooks` type no longer contains event-related callbacks — it is purely about domain persistence callbacks.

## Assumptions

- The existing `EventEmitter` implementation (from `src/ai/events.ts`) will be reused — no new event infrastructure is needed.
- `conversationLoop` already accepts an optional parameters bag that can be extended with an optional `EventEmitter` field.
- The `saveMessage` function signature does not change — `createStandardHooks` continues to accept it as a dependency.
- The `LessonGenerator`'s `job.messages` array is a synchronous in-memory data structure — the `onAfterToolExecution` callback can push to it without async coordination.
- No database schema changes are required — this is a pure code refactoring.
- No new npm dependencies are required.
- The refactor does not change any visible user behavior — it is entirely internal to the AI conversation loop plumbing.
