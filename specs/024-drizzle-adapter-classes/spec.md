# Feature Specification: Drizzle Adapter Classes

**Feature Directory**: `specs/024-drizzle-adapter-classes`

**Created**: 2026-06-19

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Drizzle Changes Affect Only One Domain (Priority: P1)

A developer needs to fix a bug in the `upsertMissionContent` method. Currently, the bug lives inside `DrizzleMissionStore` — a 406-line class that implements 8 unrelated interfaces. The developer must scan through user queries, lesson queries, learning record queries, and session queries just to find the right section. Every query in the file shares the same `this.db` field, making it impossible to tell at a glance which tables each method touches.

After the refactor, the developer opens `DrizzleContentAdapter.ts` — a focused class with exactly 2 methods (`getMissionContent`, `upsertMissionContent`) that operates on the `missionContent` table. The file is self-contained, ~30 lines, and the dependency on the `MissionContentStore` interface is explicit in the class declaration.

**Why this priority**: This is the core problem. The size and scope of `DrizzleMissionStore` makes it harder to reason about, test, and maintain. Every method in the monolith is one `this.db` away from any other, and accidental cross-table operations in a single transaction are not structurally prevented. Splitting by domain makes each adapter independently understandable.

**Acceptance Scenarios**:

1. **Given** the `DrizzleMissionStore` class, **When** the refactor is complete, **Then** it no longer exists (it is replaced by 8 focused Drizzle adapter classes).
2. **Given** any Drizzle adapter class (e.g., `DrizzleLessonAdapter`), **When** inspecting its `implements` clause, **Then** it implements exactly one store interface.
3. **Given** any Drizzle adapter class, **When** inspecting its methods, **Then** every method operates only on the table(s) logically associated with that domain (e.g., `DrizzleLessonAdapter` only touches the `lessons` table).
4. **Given** the `src/db/store.ts` file, **When** the refactor is complete, **Then** it exports the 8 focused store interfaces, the 8 InMemory* stores, and optionally the 8 Drizzle adapter classes — but no composite class that implements multiple interfaces.

---

### User Story 2 — Wiring a New Store Adapter Is a One-Line Change (Priority: P1)

A developer adds a new domain store interface (e.g., `ProgressStore`). Currently, they must add the new methods to `DrizzleMissionStore` (which already has 30+ methods) and hope the class doesn't grow past a maintainable size. After the refactor, they create `DrizzleProgressAdapter` in its own file, wire it in `createApp()` alongside the other adapters, and each adapter constructor cleanly receives only the database handle.

**Why this priority**: The current pattern of endlessly adding methods to a single class is not scalable. Separating per-adapter instantiation in `createApp()` makes the dependency graph explicit and makes it trivial to see what the application depends on.

**Acceptance Scenarios**:

1. **Given** the `createApp()` function in `src/index.ts`, **When** inspecting how stores are created, **Then** each Drizzle adapter is instantiated separately (e.g., `new DrizzleMissionAdapter(db)`, `new DrizzleLessonAdapter(db)`, etc.) rather than one composite constructor.
2. **Given** a new store adapter needs to be added, **When** a developer follows the existing pattern, **Then** they only need to create the adapter class and add one line to `createApp()` — no existing adapter is modified.

---

### User Story 3 — Tool Executor and Services Receive Only What They Need (Priority: P2)

A developer opens `src/ai/tools.ts` to understand the AI tool execution. The `createToolExecutor` function currently takes a single `DrizzleMissionStore` instance that implements all 8 interfaces. The function's signature does not reveal which interfaces it actually uses. The developer must read the entire tools implementation to discover that it uses `MissionStore`, `LessonStore`, `ContentStore`, `RefDocStore`, `LearningRecordStore`, and `ChatStore`.

After the refactor, `createToolExecutor` accepts an object with named adapters, or the individual interface types are passed directly — making the dependency on each domain explicit in the function signature.

**Why this priority**: This improves code readability and maintainability. Explicit dependencies document themselves and prevent accidental coupling. The function signature becomes a reliable source of truth.

**Acceptance Scenarios**:

1. **Given** the `createToolExecutor` function, **When** reading its parameters, **Then** each store interface it depends on is listed explicitly (either as separate parameters or as named properties of a parameter object).
2. **Given** any service factory (e.g., `createMissionChatService`, `createLessonGenerator`), **When** reading its parameters, **Then** each store interface it depends on is listed explicitly — no service receives an object implementing interfaces it does not use.
3. **Given** the `AppVariables` type in `src/types.ts`, **When** inspecting the `store` property, **Then** it is typed as an intersection of all 8 store interfaces (or as a concrete composite type) so that existing `c.get("store")` call sites continue to compile.

---

### User Story 4 — InMemoryToolStore Removed, Tests Use Individual Stores (Priority: P2)

A developer writing a test for chat functionality currently has multiple options: use `InMemoryChatStore` directly (which already works), or use `InMemoryToolStore` (the delegation composite at lines 624-680). The `InMemoryToolStore` adds unnecessary indirection — it wraps individual InMemory* stores and delegates every method call.

After the refactor, `InMemoryToolStore` is deleted. Tests that pass multiple stores to a function simply pass the individual InMemory* instances they need. Test setup is slightly more verbose (passing 2-3 stores instead of 1 composite) but each store is independently verifiable.

**Why this priority**: The `InMemoryToolStore` adds zero value beyond what the individual InMemory* stores already provide. Every method is a one-line delegation. Removing it reduces total lines of code and eliminates a code path that could diverge from the underlying stores.

**Acceptance Scenarios**:

1. **Given** the `InMemoryToolStore` class, **When** the refactor is complete, **Then** it no longer exists in the codebase.
2. **Given** existing test files, **When** the refactor is complete, **Then** all tests that previously used `InMemoryToolStore` now use individual InMemory* stores directly.
3. **Given** any test that needs multiple store interfaces, **When** the test sets up its stores, **Then** it creates individual InMemory* instances rather than a single composite.

---

### Edge Cases

- **What about the `deleteMission` method that cascades across multiple tables?** This method (on the `MissionStore` interface) deletes rows from chat_messages, guided_questions, lessons, reference_docs, learning_records, mission_content, and missions. In the split, it must remain on `DrizzleMissionAdapter` — that class is the only one that knows about all tables for cascading deletes. This cross-domain behavior is an explicit exception to the "one table per adapter" rule.
- **What about the `getLearningRecordCount` method?** This is already on `LearningRecordStore`. No change needed — it stays there.
- **Do existing callers need to change their `c.get("store")` usage?** No. The `store` property on `AppVariables` can be typed as an intersection of all 8 store interfaces (or the concrete composite class if one is retained for convenience). Callers that use `c.get("store")` will continue to work.
- **Do we need a convenience composite class for `createApp()`?** No — `createApp()` can pass multiple adapter instances to the services and tool executor that need them. The `store` context variable can be retained as an intersection type for middleware and route handlers that access it through context.
- **What about the `InMemorySessionStore` (lines 682-699)?** No Drizzle adapter for sessions is needed — sessions are managed directly by the auth middleware through `InMemorySessionStore` in tests and through the Drizzle adapter in production. This is already clean.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `DrizzleMissionStore` class MUST be replaced with 8 focused adapter classes, one per store interface: `DrizzleMissionAdapter` (implements `MissionStore`), `DrizzleLessonAdapter` (implements `LessonStore`), `DrizzleChatAdapter` (implements `ChatStore`), `DrizzleContentAdapter` (implements `ContentStore`), `DrizzleRefDocAdapter` (implements `RefDocStore`), `DrizzleLearningRecordAdapter` (implements `LearningRecordStore`), `DrizzleUserAdapter` (implements `UserStore`), `DrizzleSessionAdapter` (implements `SessionStore`).
- **FR-002**: Each Drizzle adapter class MUST take a `BetterSQLite3Database<typeof schema>` in its constructor and store it as a private field.
- **FR-003**: Each Drizzle adapter class MUST be placed in its own file under `src/db/adapters/` (e.g., `src/db/adapters/drizzle-mission-adapter.ts`, `src/db/adapters/drizzle-lesson-adapter.ts`, etc.).
- **FR-004**: Each Drizzle adapter class MUST implement exactly one store interface — no adapter implements multiple interfaces.
- **FR-005**: The `InMemoryToolStore` delegation composite class MUST be deleted. All tests that used it MUST be updated to pass individual InMemory* stores instead.
- **FR-006**: The `deleteMission` method (cross-table cascade) MUST remain on `DrizzleMissionAdapter` as an explicit cross-domain exception.
- **FR-007**: The `createApp()` function in `src/index.ts` MUST instantiate each Drizzle adapter separately and pass them to the services and tool executor that need them.
- **FR-008**: The `createToolExecutor` function signature MUST be updated to accept the specific store interfaces it needs, listed explicitly rather than accepting a single composite object.
- **FR-009**: The `createMissionChatService` function signature MUST accept the specific store interfaces it needs.
- **FR-010**: The `createLessonGenerator` function signature MUST accept the specific store interfaces it needs.
- **FR-011**: The `AppVariables` type in `src/types.ts` MUST define `store` as an intersection of all 8 store interfaces (so existing `c.get("store")` call sites compile without changes).
- **FR-012**: All existing tests MUST pass without changes to test logic. The only modifications allowed are: (a) removing `InMemoryToolStore` imports and using individual InMemory* stores, and (b) updating type annotations where needed.
- **FR-013**: The `src/db/store.ts` file MUST continue to export all 8 store interfaces and all 8 InMemory* stores after the refactor. The Drizzle adapter classes MAY be exported from `store.ts` (re-exported from adapter files) or imported from their individual files.
- **FR-014**: No changes to the store interfaces themselves — `MissionStore`, `LessonStore`, `ChatStore`, `ContentStore`, `RefDocStore`, `LearningRecordStore`, `UserStore`, and `SessionStore` MUST remain exactly as they are in the current codebase.
- **FR-015**: No changes to the InMemory* stores (`InMemoryMissionStore`, `InMemoryLessonStore`, `InMemoryChatStore`, `InMemoryContentStore`, `InMemoryRefDocStore`, `InMemoryLearningRecordStore`, `InMemoryUserStore`, `InMemorySessionStore`) — they already exist individually per interface and require no modification.
- **FR-016**: A convenience composite class MAY be created in `src/db/store.ts` (e.g., `DrizzleStoreAdapter` or keep the name `DrizzleMissionStore`) that implements all 8 interfaces by composing the individual Drizzle adapters, for use as the `store` context value. This is optional — the individual adapters can be wired directly.

### Key Entities

- **DrizzleMissionAdapter**: Implementation of `MissionStore` for the missions table. Methods: `createMission`, `getMission`, `listMissions`, `updateMissionTitle`, `updateMissionOnboardingMode`, `updateMissionStatus`, `deleteMission` (with cascading deletes).
- **DrizzleLessonAdapter**: Implementation of `LessonStore` for the lessons table. Methods: `createLesson`, `getLesson`, `getLatestLesson`, `listLessons`, `listLessonSummaries`, `getMaxLessonNumber`, `getSubLessonCount`, `getLessonCount`, `getMainLessonCount`, `getMaxSubNumber`, `findLessonBySlug`, `updateLessonStatus`, `updateLessonFeedback`, `listLessonFeedback`, `updateLessonContent`.
- **DrizzleChatAdapter**: Implementation of `ChatStore` for the chat_messages and guided_questions tables. Methods: `saveChatMessage`, `getChatMessages`, `createGuidedQuestion`, `getPendingQuestion`, `answerQuestion`, `skipPendingQuestions`.
- **DrizzleContentAdapter**: Implementation of `ContentStore` for the mission_content table. Methods: `getMissionContent`, `upsertMissionContent`.
- **DrizzleRefDocAdapter**: Implementation of `RefDocStore` for the reference_docs table. Methods: `createReferenceDoc`, `getReferenceDoc`, `listReferenceDocs`.
- **DrizzleLearningRecordAdapter**: Implementation of `LearningRecordStore` for the learning_records table. Methods: `createLearningRecord`, `listLearningRecords`, `updateLearningRecord`, `getLearningRecordCount`.
- **DrizzleUserAdapter**: Implementation of `UserStore` for the users table. Methods: `getUser`, `getUserByEmail`, `createUser`, `updateUser`.
- **DrizzleSessionAdapter**: Implementation of `SessionStore` for the sessions table. Methods: `createSession`, `getSessionByToken`, `deleteSession`, `deleteExpiredSessions`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `DrizzleMissionStore` class no longer exists. Every Drizzle adapter implements exactly one store interface.
- **SC-002**: No composite class exists in `src/db/store.ts` that implements more than one store interface. If a convenience composite is created, it lives in its own file and composes the individual adapters.
- **SC-003**: `InMemoryToolStore` is deleted and no tests reference it.
- **SC-004**: `npm test` exits with code 0 — all existing tests pass with only the permitted modifications (import changes, type annotation updates).
- **SC-005**: The `src/db/store.ts` file is reduced from ~700 lines to approximately 200 lines (interfaces + InMemory stores + re-exports). Adapter files are each under 80 lines.
- **SC-006**: Every service or function that receives store interfaces receives only the ones it uses — no function receives interfaces it does not call.
- **SC-007**: A developer can open a single Drizzle adapter file and understand its full database surface area in under 30 seconds.

## Assumptions

- The existing interfaces at the top of `src/db/store.ts` already define clean domain boundaries. No interface changes are needed or requested.
- The individual InMemory* stores are correct and already tested. They serve as the reference implementation for each Drizzle adapter.
- All services and tools that use `c.get("store")` through Hono context will continue to work because `AppVariables.store` will be typed as the intersection of all store interfaces.
- Shared database connection across adapters is fine — they all receive the same `BetterSQLite3Database<typeof schema>` instance, so transactions spanning multiple adapters work naturally.
- The `deleteMission` cascade is the only cross-table operation in the `MissionStore` interface. All other methods touch exactly one table (or one domain's set of tables, like chat_messages + guided_questions for ChatStore).
- No production code imports `InMemoryToolStore` — it is only used in test files. Its deletion affects only tests.
