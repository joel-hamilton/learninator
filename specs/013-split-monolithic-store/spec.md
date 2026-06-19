# Feature Specification: Split Monolithic MissionStore

**Feature Branch**: `013-split-monolithic-store`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Split Monolithic MissionStore — the `MissionStore` interface at `src/db/store.ts` has ~45 methods spanning 8 domain concepts (missions, lessons, chat messages, guided questions, reference docs, learning records, mission content, users). The 'compatibility aliases' at lines 476-533 are thin wrappers added because interface method names don't match what callers need. Callers that only need chat messages must know about lesson queries. Every new feature requires additions to the interface + both implementations (DrizzleMissionStore + InMemoryMissionStore)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decouple Lesson Logic from Chat Logic (Priority: P1)

A developer working on the chat feature opens `ai/conversation.ts` to fix a bug in the conversation loop. The function signature only accepts a `MissionStore`, which has 45 methods including lesson numbering, learning record management, and reference doc lookups. The developer must understand the entire store API to pass the type check, even though conversation.ts only needs `saveChatMessage` and `getChatMessages`. After the split, the conversation loop accepts a focused `ChatStore` interface with exactly the 2-3 methods it needs, making the dependency clear from the signature.

**Why this priority**: This is the root problem — every caller currently pays the cognitive cost of the full interface. Tight coupling means a change to lesson method signatures could force recompilation of chat-related files. Fixing the interface boundaries unlocks all downstream improvements.

**Independent Test**: Verify that `ai/conversation.ts` imports `ChatStore` instead of `MissionStore`, that the `createStandardHooks` function accepts `ChatStore` instead of `MissionStore`, and that no chat-related file imports the full `MissionStore` interface.

**Acceptance Scenarios**:

1. **Given** the `ai/conversation.ts` file, **When** the developer inspects its imports, **Then** it imports `ChatStore` (not `MissionStore`) and the dependency interface contains only chat message methods (`saveChatMessage`, `getChatMessages`).
2. **Given** the `src/shared/messages.ts` file, **When** the developer inspects its function signatures, **Then** they accept `ChatStore` instead of `MissionStore`.
3. **Given** a change to the lesson numbering logic, **When** the developer rebuilds, **Then** no chat-related files are flagged as needing recompilation or type-check updates.

---

### User Story 2 - Add a New Reference Doc Feature Without Touching Store Scaffolding (Priority: P1)

A developer is adding a new feature that searches reference docs by keyword. Currently, they must add the method to `MissionStore` interface, implement it in `DrizzleMissionStore`, implement it in `InMemoryMissionStore`, and re-test all 45 existing methods to ensure nothing broke. After the split, they add the method to the focused `RefDocStore` interface (or an extended variant) and its two adapter implementations. The mission, lesson, chat, and user stores are untouched.

**Why this priority**: This is the maintainability pain point described in the feature request. Every new feature currently requires touching the same three files (interface + two implementations), and the `InMemoryMissionStore` growing out of sync with `DrizzleMissionStore` is a demonstrated risk.

**Independent Test**: Implement a hypothetical `searchReferenceDocs(keyword: string)` method. Before the split it requires modifying 3 files; after the split it requires modifying only the `RefDocStore` interface (+ implementations), and the other store files are unchanged. Verify the diff is strictly scoped.

**Acceptance Scenarios**:

1. **Given** the current `MissionStore` interface, **When** adding a new domain-specific query method, **Then** only the focused interface for that domain (plus its two implementations) must be modified.
2. **Given** the `InMemoryMissionStore` class, **When** examining which compatibility aliases it implements, **Then** every method corresponds to a method on the focused interface(s) it implements — no orphaned or untested aliases.
3. **Given** the project's test suite, **When** running all tests after the split, **Then** all existing tests pass without modification to test logic (test setup may import different store types).

---

### User Story 3 - Route Handlers Depend Only on What They Need (Priority: P2)

A developer opens `routes/lessons.ts` to understand the lesson completion flow. The route handler calls `c.get("store")` and gets back the full `MissionStore`. Reading the code, they must mentally filter out the 37 irrelevant methods to understand that only `getMission`, `getLesson`, `listLessonSummaries`, `updateLessonStatus`, and `updateLessonFeedback` are used. After the split, the route file imports and uses `MissionStore` (for getMission check) and `LessonStore` (for lesson operations), with each type imported from a focused module.

**Why this priority**: This improves day-to-day developer ergonomics. Clear, narrow dependencies make code self-documenting and reduce the surface area for accidental misuse (e.g., calling a chat method from a lesson route by mistake).

**Independent Test**: For each route file, verify the set of store methods used matches only the focused store interfaces it imports. Specifically verify that `routes/lessons.ts` uses only `MissionStore` and `LessonStore`, and `routes/settings.ts` uses only `UserStore`.

**Acceptance Scenarios**:

1. **Given** `routes/lessons.ts`, **When** listing its imports from the store module, **Then** it imports only `LessonStore` and (optionally) `MissionStore`, not `ChatStore`, `ContentStore`, `RefDocStore`, or `UserStore`.
2. **Given** `routes/settings.ts`, **When** listing its imports from the store module, **Then** it imports only `UserStore`.
3. **Given** `routes/missions.ts`, **When** listing its imports, **Then** it imports `MissionStore`, `LessonStore`, `ChatStore`, `RefDocStore`, `LearningRecordStore`, and `ContentStore` as needed — but only the ones actually used by the route handlers in that file.
4. **Given** the `AppVariables` type in `src/types.ts`, **When** inspecting the `store` property, **Then** it references the composed `DrizzleMissionStore` class (which implements all focused interfaces) or a union/intersection type, not a single monolithic `MissionStore` interface.

---

### User Story 4 - In-Memory Store Implements Only What Tests Need (Priority: P2)

A developer writing unit tests for a chat feature creates a test instance. Currently they must use `InMemoryMissionStore` which has stubs for all 45 methods, many of which are irrelevant to chat testing. If they forget to stub a lesson method, the class still compiles (it is already implemented). After the split, they use `InMemoryChatStore` which implements `ChatStore` — a focused interface with 2-3 methods. The test setup is simpler, and the test reader immediately understands what data layer the test interacts with.

**Why this priority**: Improving test clarity and simplicity reduces the barrier to writing focused tests. Currently, tests that only need chat replay to the same class as tests that need full mission CRUD. Split stores make the test's data dependencies explicit.

**Independent Test**: Create a test that only needs chat message persistence. Before the split it must instantiate `InMemoryMissionStore` (with 45 methods); after the split it instantiates `InMemoryChatStore` (with ~2-3 methods). Verify the test setup is simpler and the store type is the minimal required interface.

**Acceptance Scenarios**:

1. **Given** a test for `ai/conversation.ts`, **When** creating a store instance, **Then** the test can use `InMemoryChatStore` instead of the full `InMemoryMissionStore`.
2. **Given** a test for `routes/settings.ts`, **When** creating a store instance, **Then** the test can use `InMemoryUserStore` instead of the full `InMemoryMissionStore`.
3. **Given** the existing `InMemoryMissionStore` class, **When** the refactor is complete, **Then** it is either replaced by separate focused in-memory classes (e.g., `InMemoryMissionStore` implements `MissionStore`, `InMemoryLessonStore` implements `LessonStore`, etc.), or kept as a composite that composes the focused in-memory stores.

---

### User Story 5 - Compatibility Aliases Removed (Priority: P3)

A developer migrating a caller from the compatibility method `readMissionContent(missionId, contentType)` to the direct method `getMissionContent(missionId, contentType)` discovers both methods exist in the same interface, doing the same thing with different naming conventions. After the split, each focused interface uses consistent naming. No alias methods exist.

**Why this priority**: The compatibility aliases at lines 476-533 exist solely because the original `MissionStore` method names didn't match callers' expectations. Removing them eliminates this historical debt. Developers no longer wonder "which version should I call?"

**Independent Test**: Search the codebase for calls to each compatibility alias (`readMissionContent`, `upsertMissionContentPos`, `getMainLessonByNumber`, `getMaxSubNumber`, `insertLesson`, `insertReferenceDoc`, `insertLearningRecord`, `insertGuidedQuestion`, `updateLearningRecordPos`) and verify zero calls remain — all callers have been migrated to the corresponding direct method on the appropriate focused store.

**Acceptance Scenarios**:

1. **Given** the `src/db/store.ts` file, **When** searching for the string "Compatibility aliases", **Then** no such section exists in the codebase after the refactor.
2. **Given** all callers, **When** searching for any of the 9 compatibility alias method names, **Then** no call sites exist (the aliases have been fully removed).
3. **Given** the `InMemoryMissionStore` (or its replacements), **When** inspecting its method list, **Then** no compatibility alias methods exist — only the canonical method name on each focused interface.

---

### Edge Cases

- **What happens when a single transaction needs to write to both MissionStore and LessonStore?** The `DrizzleMissionStore` composite class receives the same `BetterSQLite3Database` instance for all focused interfaces, so operations naturally share the same connection and transaction context. Callers performing multi-store operations use the composite class.
- **How does the existing `createApp()` injection point change?** `createApp()` still creates a single `DrizzleMissionStore` instance (which now implements N focused interfaces via composition). Callers use `c.get("store")` and the type narrowing happens at the import level (i.e., `const store = c.get("store") as DrizzleMissionStore` or each caller requests only the interface it needs).
- **What about callers that need access to multiple stores (e.g., a route handler that checks mission ownership and then creates a lesson)?** The `DrizzleMissionStore` composite implements all focused interfaces, so the same object satisfies all type constraints. A route handler can destructure or pass the object as any of its interfaces.
- **How do existing tests that use `c.get("store")` across multiple domains work?** The `DrizzleMissionStore` composite implements all focused interfaces, so existing tests that do not import a specific focused type continue to work unchanged. New tests can opt into narrow interfaces.
- **What about the `AppVariables` type — does `store` change type?** Yes, the `store` property in `AppVariables` changes from `MissionStore` to `DrizzleMissionStore` (which implements all focused interfaces). This is the minimal change that preserves backward compatibility while allowing narrow imports. Alternatively, it could be typed as an intersection type or a union of all focused interfaces.
- **What if a caller currently uses a method that would logically belong to two different stores (e.g., `getLearningRecordCount` sits on the LessonStore because lessons need it, but it queries learning records)?** This method queries a different table than lessons. In the split, `getLearningRecordCount` belongs on `LearningRecordStore`, and the lesson caller must import both `LessonStore` and `LearningRecordStore`.
- **Is backward compatibility required for the `MissionStore` interface name?** Yes — to minimize diff size, the `MissionStore` interface is retained for mission-only methods. Files that currently import `MissionStore` and use only mission methods continue to compile without changes.
- **What happens to the existing `store.test.ts` file?** It should be split into per-store test files (e.g., `mission-store.test.ts`, `lesson-store.test.ts`, `chat-store.test.ts`, etc.) that test each focused interface independently. The old `store.test.ts` can be removed once coverage is confirmed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `MissionStore` interface MUST be split into focused interfaces: `MissionStore` (missions), `LessonStore` (lessons), `ChatStore` (chat messages + guided questions), `ContentStore` (mission content read/write), `UserStore` (user profile), `RefDocStore` (reference docs), and `LearningRecordStore` (learning records).
- **FR-002**: Each focused interface MUST be exported from `src/db/store.ts` (or from individual files if extracted to separate modules).
- **FR-003**: `DrizzleMissionStore` MUST implement all focused interfaces simultaneously (composition, not inheritance). It may be renamed to `DrizzleStore` if it no longer represents a single "mission store."
- **FR-004**: `InMemoryMissionStore` MUST be replaced with separate focused in-memory implementations (e.g., `InMemoryChatStore implements ChatStore`), one per focused interface. Each MUST be independently instantiable and testable.
- **FR-005**: All 9 compatibility alias methods (`readMissionContent`, `upsertMissionContentPos`, `getMainLessonByNumber`, `getMaxSubNumber`, `insertLesson`, `insertReferenceDoc`, `insertLearningRecord`, `insertGuidedQuestion`, `updateLearningRecordPos`) MUST be removed. Callers MUST be migrated to the canonical method names.
- **FR-006**: Each focused interface MUST use consistent naming conventions within its domain. No method on `LessonStore` should be named `insertLesson` — it should use the stored interface's naming (e.g., `createLesson`).
- **FR-007**: The `AppVariables` type in `src/types.ts` MUST be updated so that `c.get("store")` returns a type that satisfies all focused interfaces (either an intersection type or the concrete `DrizzleStore`/`DrizzleMissionStore` class type).
- **FR-008**: The `createToolExecutor` function in `src/ai/tools.ts` MUST accept the specific store interfaces it needs (currently: `MissionStore`, `LessonStore`, `ContentStore`, `RefDocStore`, `LearningRecordStore`, `ChatStore`) rather than a monolithic `MissionStore`.
- **FR-009**: The `createStandardHooks` function in `src/ai/conversation.ts` MUST accept `ChatStore` instead of `MissionStore`.
- **FR-010**: The `createOnboarding` factory in `src/onboarding/index.ts` MUST accept the specific store interfaces it needs (`ChatStore`, `MissionStore`, and `GuidedQuestionStore` or `ChatStore` if guided questions are included there).
- **FR-011**: The `saveMessage` and `loadMessages` functions in `src/shared/messages.ts` MUST accept `ChatStore` instead of `MissionStore`.
- **FR-012**: The `auth/index.ts` session middleware and auth routes MUST use `UserStore` instead of `MissionStore`.
- **FR-013**: `src/db/store.test.ts` MUST be split into per-interface test files (e.g., `src/db/__tests__/mission-store.test.ts`, `src/db/__tests__/lesson-store.test.ts`, etc.) with independent test suites for each focused interface. The old `store.test.ts` file MAY be removed once all tests are migrated.
- **FR-014**: Each focused interface MUST have its own `InMemory*` implementation. The `InMemoryMissionStore` class MUST be removed or replaced with focused equivalents.
- **FR-015**: The `DrizzleMissionStore` composite class MUST remain as a single class that receives one `BetterSQLite3Database` instance and delegates to focused private query helpers or inline query logic organized by domain. [ALTERNATIVE: If moved to separate files, see FR-016.]
- **FR-016**: Consider extracting each focused store interface + its Drizzle adapter into its own file (e.g., `src/db/stores/lesson-store.ts`, `src/db/stores/chat-store.ts`, etc.) for better discoverability and shorter files. The `DrizzleStore` composite may re-import these and delegate, or callers may compose them directly. [ALTERNATIVE to FR-015 — spec needs single-file vs. multi-file decision.]
- **FR-017**: All existing tests MUST pass without changes to test logic. The only modifications to test files are import paths and variable types (changing `MissionStore` to the appropriate focused store type).
- **FR-018**: The `getLearningRecordCount` method (currently on the mission store, queries the learning_records table) MUST be moved to `LearningRecordStore`. Callers that need both lesson and learning record operations (e.g., the AI tools `createLearningRecord`) MUST import both interfaces.
- **FR-019**: The guided questions methods (`createGuidedQuestion`, `getPendingQuestion`, `answerQuestion`, `skipPendingQuestions`) MUST belong to `ChatStore` (since guided questions are part of the chat/onboarding flow and share the same mission context).

### Key Entities

- **MissionStore (focused)**: Represents the missions table. Methods: `createMission`, `getMission`, `listMissions`, `updateMissionTitle`, `updateMissionOnboardingMode`, `updateMissionStatus`, `deleteMission`. Ownership-scoped to userId.
- **LessonStore**: Represents the lessons table. Methods: `createLesson`, `getLesson`, `getLatestLesson`, `listLessons`, `listLessonSummaries`, `getMaxLessonNumber`, `getSubLessonCount`, `getLessonCount`, `getMainLessonCount`, `findLessonBySlug`, `updateLessonStatus`, `updateLessonFeedback`, `listLessonFeedback`, `updateLessonContent`.
- **ChatStore**: Represents the chat_messages and guided_questions tables. Methods: `saveChatMessage`, `getChatMessages`, `createGuidedQuestion`, `getPendingQuestion`, `answerQuestion`, `skipPendingQuestions`.
- **ContentStore**: Represents the mission_content table. Methods: `getMissionContent`, `upsertMissionContent`.
- **RefDocStore**: Represents the reference_docs table. Methods: `createReferenceDoc`, `getReferenceDoc`, `listReferenceDocs`.
- **LearningRecordStore**: Represents the learning_records table. Methods: `createLearningRecord`, `listLearningRecords`, `updateLearningRecord`, `getLearningRecordCount`.
- **UserStore**: Represents the users table. Methods: `getUser`, `getUserByEmail`, `createUser`, `updateUser`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `MissionStore` interface in `src/db/store.ts` has no more than 8 methods (mission CRUD, archive, ownership). All lesson, chat, content, reference doc, learning record, and user methods are removed from it.
- **SC-002**: Zero compatibility alias methods exist in the codebase — all 9 aliases are removed and their callers migrated.
- **SC-003**: Every callers' import from the store module imports only the focused interface(s) it actually uses. No caller imports the full `MissionStore` when it only needs chat methods.
- **SC-004**: Each focused interface has a corresponding `InMemory*` implementation that can be independently instantiated and tested.
- **SC-005**: All existing tests pass without changes to test logic (import paths and type annotations may change). `npm test` exits with code 0.
- **SC-006**: The `src/db/store.ts` file is reduced from ~610 lines to less than 400 lines (or the domain logic is extracted to separate files each under 150 lines).
- **SC-007**: A developer can read any single focused store interface and understand its full API in under 30 seconds, because it contains only related methods.

## Assumptions

- The existing `DrizzleMissionStore` class is the only production implementation; no other production store implementations exist that would need parallel splitting.
- The `InMemoryMissionStore` class is only used in tests — no production code depends on it.
- All focused interfaces share the same `BetterSQLite3Database` instance and database connection. No distributed transactions or cross-database challenges exist.
- The existing `deleteMission` method performs cascading deletes across all tables (chat_messages, guided_questions, lessons, reference_docs, learning_records, mission_content, missions). This cross-domain behavior must be retained, likely on `MissionStore` (or as a method on the composite class that delegates to the individual focused stores).
- No caller currently depends on the monolith's method names via reflection or dynamic dispatch — all call sites are statically typed and can be mechanically refactored.
- The `AppVariables.store` property can change type from `MissionStore` to `DrizzleMissionStore` (the concrete class) without breaking middleware or route handler `c.get("store")` call sites, because TypeScript structural typing allows any interface implemented by the class to be assigned from it.
- The guided questions domain is tightly coupled to the onboarding/chat flow, so grouping it under `ChatStore` is a pragmatic choice. If guided questions later need an independent lifecycle (e.g., surveys not tied to chat), they can be extracted to a separate `GuidedQuestionStore`.
- The `.claude/settings.json` permissions file may need updates if the refactored test files require new file system permissions (e.g., creating new test files in the `db/` directory).
