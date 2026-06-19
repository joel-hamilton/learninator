# Feature Specification: Type the InMemory Store Adapters

**Feature Branch**: `021-type-inmemory-stores`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Feature: Type the InMemory store adapters. In `src/db/store.ts`, the `DrizzleMissionStore` class implements 8 typed interfaces ... The InMemory store classes at the bottom of the file use `any[]` for all internal collections ... The fix: replace all `any[]` collections with the Drizzle-inferred row types already exported from `store.ts`."

## User Scenarios & Testing

### User Story 1 - Developer writes tests with type-safe InMemory stores (Priority: P1)

As a developer writing tests, I want the InMemory store implementations to use typed collections so that the TypeScript compiler catches incorrect field values (e.g., invalid enum strings, missing required fields) at compile time rather than at runtime when the Drizzle store processes them.

**Why this priority**: This is the core problem being solved. Without typed InMemory stores, tests pass against invalid data shapes that would fail in production, undermining the value of the test suite.

**Independent Test**: Can be verified by checking that each InMemory store class uses typed collections with the correct row types, and that compiling a test that passes an invalid value (e.g., wrong mission status) produces a type error.

**Acceptance Scenarios**:

1. **Given** an InMemory store class, **When** a collection is declared, **Then** it must use the corresponding exported row type instead of `any[]`.
2. **Given** a test that writes an invalid enum value to a typed InMemory store, **When** TypeScript compiles it, **Then** a compile-time error is produced.

---

### User Story 2 - InMemory mutation methods return properly typed objects (Priority: P1)

As a developer, I want InMemory store mutation methods (create, update, find) to return properly typed row objects so that callers get full autocompletion and type safety when working with the results, matching the behavior of DrizzleMissionStore.

**Why this priority**: Alongside story 1, this is the second half of the fix. Typed return values ensure all code paths that touch InMemory store results benefit from type checking.

**Independent Test**: Can be verified by checking that each mutation method's return type matches the corresponding row type, and that TypeScript compilation succeeds without `any` escaping from store methods.

**Acceptance Scenarios**:

1. **Given** an InMemory store method that returns a mission/lesson/message, **When** TypeScript infers the return type, **Then** it must match the corresponding row type exactly (not `any`).
2. **Given** a caller that accesses a returned object's property, **When** the property enum value is typed, **Then** only valid enum values are allowed.

---

### User Story 3 - Existing tests continue to pass (Priority: P2)

As a developer, I want all existing tests to pass without modification after the InMemory stores are typed, so that the change is strictly additive type enforcement with no behavioral change.

**Why this priority**: Ensuring no regressions is important, but the primary value is in stories 1 and 2. This is a verification requirement.

**Independent Test**: Can be verified by running `npm test` and confirming all tests pass.

**Acceptance Scenarios**:

1. **Given** the current test suite, **When** the typed InMemory stores are applied, **Then** all existing tests pass without source code changes.

---

### Edge Cases

- What happens when a field is optional in the row type? The InMemory store should accept `undefined` or missing values for optional fields, matching the row type's optional markers.
- How does the system handle type-compatible but different row types (e.g., a field that is `string` in both but semantically different)? The compiler will not catch semantic mismatches, only structural ones — this is acceptable since it matches DrizzleMissionStore behavior.

## Requirements

### Functional Requirements

- **FR-001**: Each InMemory store collection MUST use its corresponding exported row type (MissionRow, LessonRow, ChatMessageRow, GuidedQuestionRow, ReferenceDocRow, LearningRecordRow, MissionContentRow, UserRow, SessionRow) instead of `any[]`.
- **FR-002**: All InMemory store mutation methods (create, update, set, push, etc.) MUST accept and return properly typed row objects, not `any`.
- **FR-003**: The TypeScript compiler MUST catch invalid field values (e.g., wrong enum strings, missing required fields) in InMemory store operations at compile time.
- **FR-004**: All 8 store interfaces (MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore, UserStore, SessionStore) implemented by InMemory stores MUST be fully supported with typed collections.
- **FR-005**: No existing test source code MAY require modification as a result of this change.
- **FR-006**: All existing behavioral contracts of InMemory stores MUST be preserved — only internal storage types and method signatures change.

### Key Entities

- **MissionRow**: Represents a mission record with fields including status (enum: "active" | "inactive" | "complete" etc.), title, and user association.
- **LessonRow**: Represents a lesson record with fields including status (enum), associated mission, and content.
- **ChatMessageRow**: Represents a chat message record with role, content, and associated mission/lesson.
- **GuidedQuestionRow**: Represents a guided onboarding question record.
- **ReferenceDocRow**: Represents an uploaded or linked reference document.
- **LearningRecordRow**: Represents a learning record entry associated with a mission/lesson.
- **MissionContentRow**: Represents content associated with a mission.
- **UserRow**: Represents a user account record.
- **SessionRow**: Represents an authenticated session record.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Compilation with `--strict` produces zero type errors in InMemory store code after the change.
- **SC-002**: Substituting an invalid enum string (e.g., `"inactive"` instead of `"active"`) in any InMemory store method produces a TypeScript compile-time error.
- **SC-003**: All existing tests pass (`npm test` exits with code 0) without any modifications to test files.
- **SC-004**: No `any` type remains in any InMemory store collection declaration or method return type.
- **SC-005**: A developer can inspect any InMemory store method and see the exact row type used, with full property autocompletion in their editor.

## Assumptions

- The row types exported from `src/db/store.ts` (lines 10-26) are correctly defined and sufficient for all InMemory store use cases.
- The existing InMemory store method signatures (parameter shapes, method names) remain structurally unchanged — only the internal collection types and explicit return types change.
- All 9 row types (MissionRow, LessonRow, ChatMessageRow, GuidedQuestionRow, ReferenceDocRow, LearningRecordRow, MissionContentRow, UserRow, SessionRow) are needed to fully type all InMemory store collections.
- No behavioral change is introduced — the runtime values stored and returned by InMemory stores are identical before and after the change.
