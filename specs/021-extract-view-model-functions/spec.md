# Feature Specification: Extract View-Model Functions

**Feature Branch**: `021-extract-view-model-functions`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Extract pure data transformation functions from route handlers into testable view-model modules. Specifically: (a) The lesson grouping computation in src/routes/missions.ts GET /:missionId (lines 169-200) — parentNums Set, lastSubs Set, maxSubByNum Map computation — extract to a pure function lessonGrouping(rows: LessonSummary[]) that returns enriched lesson data with hasSubLessons and isLastSub flags. (b) The chat message rendering loop in src/routes/missions.ts GET /:missionId/chat (lines 280-295) — extract to renderChatMessages(rows: ChatMessageRow[]) that returns HTML string. (c) The prev/next lesson navigation computation in src/routes/lessons.ts GET /:number (lines 52-58). These are pure functions taking data, returning data or HTML — no Hono context needed. Tests can verify them without HTTP. Routes become thin coordinators: fetch data, call view model, return HTML."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View-model functions are independently testable (Priority: P1)

A developer working on the lesson grouping logic or chat message rendering should be able to verify those computations in isolation without spinning up an HTTP server, setting up session cookies, or navigating through the route handler. Each extracted function accepts plain data and returns plain data or HTML, making unit tests fast and reliable.

**Why this priority**: This is the core motivation for the feature. Without independent testability, these computations can only be exercised through slow HTTP integration tests that cover many layers at once.

**Independent Test**: Run the unit tests for each extracted function against known inputs and assert on the returned data or HTML. No test app, no auth, no store.

**Acceptance Scenarios**:

1. **Given** a list of lesson summary rows with various parent-sub relationships, **When** `lessonGrouping()` is called, **Then** the returned enriched rows include correct `hasSubLessons` and `isLastSub` flags for every row.
2. **Given** an empty list of lesson summaries, **When** `lessonGrouping()` is called, **Then** an empty array is returned.
3. **Given** chat message rows with user and assistant roles, **When** `renderChatMessages()` is called, **Then** HTML bubbles are returned with the correct role classes and formatted markdown content.
4. **Given** an empty list of chat messages, **When** `renderChatMessages()` is called, **Then** a default assistant greeting bubble is returned.
5. **Given** chat messages with empty or whitespace-only content, **When** `renderChatMessages()` is called, **Then** those messages are skipped in the output.
6. **Given** a list of all lessons in the mission, **When** computing prev/next navigation for a specific lesson, **Then** the previous and next lesson references are correct based on their position in the ordered list.
7. **Given** the first lesson in the list, **When** computing navigation, **Then** there is no previous lesson.
8. **Given** the last lesson in the list, **When** computing navigation, **Then** there is no next lesson.

---

### User Story 2 - Route handlers become thin coordinators (Priority: P2)

When a developer opens a route handler to make changes, the handler should contain only the orchestration logic: fetch data from the store, call a view-model function, return HTML. This makes the route predictable and the data transformation logic easy to find.

**Why this priority**: While less immediately impactful than testability, this improves long-term maintainability by enforcing a clear separation of concerns.

**Independent Test**: Verification is by inspection and comparison — the route handler's data transformation code is replaced with calls to extracted functions, but the rendered output is identical for the same inputs.

**Acceptance Scenarios**:

1. **Given** the mission detail route handler, **When** rendering the lesson list, **Then** it calls a `lessonGrouping()` function instead of computing parentNums/lastSubs/maxSubByNum inline.
2. **Given** the mission chat route handler, **When** rendering chat messages, **Then** it calls a `renderChatMessages()` function instead of building HTML inline.
3. **Given** the lesson view route handler, **When** computing prev/next navigation, **Then** it calls a dedicated function instead of computing inline via `findIndex`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A pure function `lessonGrouping(rows: LessonSummary[])` MUST compute the `hasSubLessons` and `isLastSub` enrichment flags for each lesson row based on parent-sub relationships, returning the enriched data.
- **FR-002**: A pure function `renderChatMessages(rows: ChatMessageRow[])` MUST render chat message rows into HTML string, with correct role-based CSS classes, formatted markdown content, and a default greeting bubble when the list is empty.
- **FR-003**: A pure function MUST compute prev/next lesson navigation references from a flat list of all lesson summaries, given the current lesson's number and sub-number.
- **FR-004**: The mission detail route handler (GET /:missionId) MUST call the extracted `lessonGrouping` function instead of computing the enrichment inline.
- **FR-005**: The mission chat route handler (GET /:missionId/chat) MUST call the extracted `renderChatMessages` function instead of building HTML inline.
- **FR-006**: The lesson view route handler (GET /:number) MUST call the extracted navigation computation instead of computing prev/next inline.
- **FR-007**: The extracted functions MUST NOT depend on any Hono context, request object, or database store — they MUST be pure functions operating solely on their input parameters.
- **FR-008**: Unit tests MUST exist for each extracted function covering: empty input, single-item input, multi-item input with various relationships, and boundary cases (first/last position, single sub-lesson, multiple sub-lessons).

### Key Entities *(include if feature involves data)*

- **LessonSummary**: Projection of lesson data used for listing and grouping — includes lesson number, sub-number, and title fields.
- **EnrichedLessonSummary**: LessonSummary with added `hasSubLessons` and `isLastSub` boolean flags used for rendering lesson cards with grouping indicators.
- **ChatMessageRow**: A persisted chat message with role, content (structured), and timestamp fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three extracted functions have passing unit tests covering normal cases, empty input, and boundary conditions.
- **SC-002**: The mission detail lesson grouping, chat message rendering, and lesson prev/next navigation produce identical output before and after extraction (existing integration tests pass without modification).
- **SC-003**: Each extracted function can be imported and called in a test file without any Hono or database setup — zero dependencies beyond plain TypeScript data types.
- **SC-004**: The route handlers contain no inline data-transformation loops or HTML-building for these three responsibilities — logic is replaced by function calls.

## Assumptions

- The extracted functions will live in a new module separate from both routes and views (e.g., `src/view-models/` or similar), keeping the view rendering functions in `src/views/` unchanged.
- `LessonSummary[]` type is already defined by the store layer and does not need modification.
- `ChatMessageRow[]` type is already defined and includes `role`, `content`, and any needed metadata fields.
- The existing `contentToText()` and `formatMarkdown()` utility functions used during chat rendering will remain as shared helpers — the extracted `renderChatMessages` function will import them rather than duplicating their logic.
- The prev/next navigation computation is simple enough that it may remain part of the lesson route module as a module-level function rather than a separate module, provided it is extracted from inline route handler code.
- No user-facing behavior changes — this is a pure refactoring with no new features or visible differences.
