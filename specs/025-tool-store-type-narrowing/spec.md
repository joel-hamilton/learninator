# Feature Specification: Tool Store Type Narrowing

**Feature Branch**: `025-tool-store-type-narrowing`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Narrow the store type in each tool handler's ToolHandlerContext to only the store interface it actually uses."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer reads handler code with clear type contracts (Priority: P1)

As a developer working on the AI tool system, I want each tool handler function to declare only the store interface it actually uses, so that I can immediately understand which data access capabilities each handler requires without scanning its implementation.

**Why this priority**: This is the primary value — improved developer clarity. Every handler currently accepts the entire `ToolStore` (6 interfaces combined), obscuring its actual dependencies.

**Independent Test**: Can be verified by inspecting each handler's function signature — the `store` parameter type must be narrowed to only the store interface(s) used by that handler.

**Acceptance Scenarios**:

1. **Given** a tool handler that only calls `ContentStore` methods (e.g., `readMissionContent`), **When** its function signature is inspected, **Then** its `store` parameter type is `ContentStore` (not `ToolStore`).
2. **Given** a tool handler that only calls `LessonStore` methods (e.g., `createLesson`), **When** its function signature is inspected, **Then** its `store` parameter type is `LessonStore`.
3. **Given** a tool handler that calls methods from multiple store interfaces (e.g., `regenerateLesson` uses `LessonStore` for `getLesson` and `updateLessonContent`), **When** its function signature is inspected, **Then** its `store` parameter type is the intersection of only the interfaces it uses.

---

### User Story 2 - TypeScript catches accidental store misuse (Priority: P2)

As a developer modifying a tool handler, I want TypeScript to prevent me from accidentally using a store method that the handler's narrow type doesn't include, so that cross-interface coupling is prevented at compile time.

**Why this priority**: This is a secondary benefit — compile-time enforcement of dependency boundaries. While the concrete store always satisfies all interfaces, the narrowed type signature documents and enforces the intended scope.

**Independent Test**: Can be verified by attempting to use a store method from an interface not included in the handler's narrowed type — TypeScript compilation must fail.

**Acceptance Scenarios**:

1. **Given** a handler typed with only `LessonStore`, **When** a developer attempts to call a `ContentStore` method inside it, **Then** TypeScript reports a type error.
2. **Given** a handler typed with only `ChatStore`, **When** a developer attempts to call a `RefDocStore` method inside it, **Then** TypeScript reports a type error.

---

### User Story 3 - createToolExecutor passes store without type errors (Priority: P1)

As a developer, I want `createToolExecutor` to pass the concrete `ToolStore` to each handler without any type errors, adapter functions, or other runtime overhead.

**Why this priority**: This is essential for zero-runtime-cost — the factory must work with the narrowed handler signatures while passing the full concrete store. TypeScript's structural typing allows this since `ToolStore` (the concrete type) satisfies each narrowed interface.

**Independent Test**: Can be verified by running `npx tsc --noEmit` — compilation must succeed with no errors.

**Acceptance Scenarios**:

1. **Given** the `createToolExecutor` factory, **When** it calls each handler with the concrete `store: ToolStore`, **Then** TypeScript must accept the call because `ToolStore` satisfies each narrowed interface.
2. **Given** all handler signatures narrowed, **When** running the TypeScript compiler, **Then** no type errors must be reported.

---

### Edge Cases

- What happens when a handler's implementation changes to use additional store interfaces? Its narrowed type must be updated to include the new interfaces — TypeScript will enforce this.
- What happens to `readResources` and `writeResources` which delegate to `readMissionContent` and `writeMissionContent`? Their store type must be compatible with the delegated call — likely they need the same narrowed type as the delegation target.
- What happens to tests that create mock stores? If tests construct minimal mocks, they only need to satisfy the narrowed interfaces used by the handler under test — a benefit of the narrowing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each tool handler function in `src/ai/tools.ts` MUST have its `ctx.store` parameter typed to only the store interface(s) it actually uses, rather than the full `ToolStore`.
- **FR-002**: A new parameter type or inline type alias SHOULD be created for each handler (e.g., `{ store: ContentStore; missionId: number; input: Record<string, unknown> }`) rather than modifying the shared `ToolHandlerContext` interface in `src/ai/types.ts`.
- **FR-003**: The `ToolHandler` type alias in `src/ai/types.ts` MAY be kept or removed as appropriate — handlers no longer need to conform to a single `ToolHandlerContext` signature.
- **FR-004**: No runtime behavior changes are permitted — the concrete `store` object passed to all handlers remains the full `ToolStore` instance from `createToolExecutor`.
- **FR-005**: The `createToolExecutor` factory in `src/ai/tools.ts` MUST pass the concrete `store: ToolStore` to each handler, relying on TypeScript's structural typing for compatibility.
- **FR-006**: The `buildHandlerMap()` function MUST continue to work — the `Map` may need to be typed with a union of all handler signatures or use `as any` cast if TypeScript cannot narrow the map lookup.
- **FR-007**: All existing tests MUST pass without modification, as no runtime behavior changes are introduced.
- **FR-008**: TypeScript compilation (`npx tsc --noEmit`) MUST succeed with zero errors.

### Key Entities *(include if feature involves data)*

- **ToolStore**: The full intersection type combining MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, and LearningRecordStore. This is the concrete store type passed by the factory.
- **ToolHandlerContext**: The current shared parameter interface (to be superseded by per-handper types). Contains `store: ToolStore`, `missionId`, and `input`.
- **ContentStore**: Store interface providing `getMissionContent` and `upsertMissionContent` methods. Used by: `readMissionContent`, `writeMissionContent`, `readResources`, `writeResources`.
- **LessonStore**: Store interface providing `getMainLessonCount`, `createLesson`, `getLesson`, `getSubLessonCount`, `listLessons`, `updateLessonContent` methods. Used by: `createLesson`, `createSubLesson`, `readLesson`, `listLessons`, `regenerateLesson`.
- **ChatStore**: Store interface providing `createGuidedQuestion` method. Used by: `askGuidedQuestion`.
- **RefDocStore**: Store interface providing `createReferenceDoc`, `listReferenceDocs` methods. Used by: `createReferenceDoc`, `listReferenceDocs`.
- **LearningRecordStore**: Store interface providing `getLearningRecordCount`, `createLearningRecord`, `listLearningRecords`, `updateLearningRecord` methods. Used by: `createLearningRecord`, `listLearningRecords`, `updateLearningRecord`.
- **MissionStore**: Store interface providing `updateMissionStatus` method. Used by: `markMissionActive`.
- **LessonStore & ContentStore**: Combined by `regenerateLesson` (uses `getLesson`, `updateLessonContent` from LessonStore).
- **LessonStore & ChatStore**: Combined by `listFeedbackHistory` (uses `listLessonFeedback` from LessonStore).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every tool handler function signature explicitly narrows its store parameter to only the interfaces it uses — verifiable by code review.
- **SC-002**: TypeScript compilation completes with zero errors — verifiable by running `npx tsc --noEmit`.
- **SC-003**: All existing unit tests pass with no modifications — verifiable by running `npm test`.
- **SC-004**: No new runtime code (wrappers, adapters, conditionals) is introduced — verifiable by review of the diff.

## Assumptions

- The concrete `ToolStore` instance created by `DrizzleMissionStore` satisfies all 6 individual store interfaces, so TypeScript's structural typing will accept passing `ToolStore` where a narrower interface is expected.
- The `buildHandlerMap()` function uses runtime string-to-function lookup, so the `Map<string, ToolHandler>` type may need adjustment — a minimal cast or union type may be required since handlers no longer share a single signature.
- The existing test suite uses `FakeAiClient` which independently sequences responses — test behavior is unchanged because the concrete store passed to handlers hasn't changed, only the type annotation.
- This feature is purely about type safety and developer clarity — it delivers no user-facing changes.
