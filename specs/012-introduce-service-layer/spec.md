# Feature Specification: Introduce Service Layer

**Feature Branch**: `012-introduce-service-layer`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Introduce Service Layer — extract a thin service layer between route handlers and the AI/database modules. Route handlers currently do everything directly: construct AI prompts, call `conversationLoop()`, access DB, manage workflow state, format errors, generate URL slugs, and render HTML."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Route Handlers Delegate to a Mission Service for Teaching Interactions (Priority: P1)

A developer adding a new chat-like endpoint (e.g., lesson chat, mission chat, or a future Q&A flow) currently has to copy the conversation-loop wrapper pattern from one of the three existing route handlers — constructing the system prompt, calling `conversationLoop()`, handling `AIError`, saving messages, and formatting the result. After this story, the developer calls a single `MissionChatService` method that encapsulates all of that orchestration, and the route handler only parses the HTTP request and renders the HTML fragment.

**Why this priority**: The conversation-loop wrapper pattern is the highest-value extraction because AI orchestration is the most complex and error-prone logic in the route handlers. Every new AI endpoint currently requires duplicating ~25 lines of boilerplate with subtle variations (error message wording, context injection). Centralizing this eliminates a source of bugs and review friction.

**Independent Test**: After the service is extracted, a developer can add a new chat endpoint by writing approximately 10 lines in a route handler (parse request, call service, render response) and the existing chat tests in `chat.test.ts` and `lessons.test.ts` continue to pass without modification to the test setup.

**Acceptance Scenarios**:

1. **Given** a route handler that currently calls `conversationLoop()` directly (e.g., `chat.ts` POST handler, `lessons.ts` lesson chat POST handler, `missions.ts` onboarding and chat handlers), **When** the service layer is introduced, **Then** each handler's orchestration logic (system prompt construction, `conversationLoop()` invocation, tool hook setup, message persistence, error handling) is extracted into a shared service module, and the route handler contains only HTTP-parsing and HTML-rendering code.
2. **Given** the existing test suite for chat endpoints (`chat.test.ts`, `lessons.test.ts`), **When** the service layer is introduced, **Then** all existing tests pass without changes to their setup (test DB, FakeAiClient, app factory).
3. **Given** a new chat endpoint (e.g., a hypothetical "ask a question about a resource" endpoint), **When** a developer implements it using the service, **Then** the route handler is no more than 15 lines of HTTP-specific code.

---

### User Story 2 - Shared Utilities Eliminate Duplicated Error Handling, Slug Generation, and Ownership Checks (Priority: P1)

A developer reviewing a PR that modifies a route handler currently has to verify that each of the 5+ `store.getMission(missionId, user.id)` calls is paired with a correct 404 response, that error catch blocks use the same `AIError instanceof` check with consistent user-facing messages, and that slug generation follows the same regex. After this story, these patterns are centralized in `src/shared/` utilities with unit tests.

**Why this priority**: These are the most frequently duplicated patterns (3 copies of slug generation, 4 copies of AIError handling, 20+ ownership checks) and each duplication is a maintenance hazard — a future developer might change the error message in one handler but forget the others, or introduce a subtle bug in one slug generator. Centralizing them eliminates that risk at the lowest cognitive cost.

**Independent Test**: Each shared utility can be unit-tested independently of the Hono app: `missionExists(store, missionId, userId)` can be tested by calling it with a known mission and user, and the result checked for the expected value or 404 behavior.

**Acceptance Scenarios**:

1. **Given** the three copies of slug generation (in `missions.ts:161`, `missions.ts:211`, `browse.ts:80`), **When** they are centralized into a single `generateSlug(title: string): string` utility in `src/shared/`, **Then** all three call sites use the same function, and the regex pattern `/[^a-z0-9]+/g` with leading/trailing dash removal is defined in exactly one place.
2. **Given** the four copies of AIError catch blocks (in `chat.ts:77`, `missions.ts:130`, `lessons.ts:407`, `browse.ts:197`), **When** they are centralized into a single `formatAIError(err: unknown, fallback?: string): string` utility, **Then** all four call sites use the same function, and the `err instanceof AIError ? ... : "Something went wrong..."` pattern is defined in exactly one place.
3. **Given** the 5+ ownership check patterns (`const mission = await store.getMission(missionId, user.id); if (!mission) return c.text("Not found", 404);`), **When** they are centralized into a single `requireMissionAccess(store, missionId, userId, c): Promise<Mission>` utility, **Then** the ownership check + 404 response is a single function call.
4. **Given** the unit tests for each shared utility, **When** `npm test` is run, **Then** the new utility tests pass in isolation without any HTTP fixture or app factory.

---

### User Story 3 - Route Handler Complexity Is Reduced (Line Count and Responsibility) (Priority: P2)

A developer maintaining `src/routes/missions.ts` (716 lines) needs to understand onboarding flow, mission CRUD, reference docs, learning records, and resources — all in a single file. After this story, the file no longer directly orchestrates AI conversations or constructs prompts inline; those concerns live in `MissionChatService` or similar service modules. The route file shrinks to roughly half its current size and each handler has a single clear responsibility.

**Why this priority**: File size and cognitive load directly affect maintenance cost. A 716-line file mixing 6 distinct concerns makes it harder to find bugs, harder to test individual flows, and harder to onboard new developers. This is the culminating outcome of the first two stories.

**Independent Test**: A developer can read a single route handler in `missions.ts` and describe its complete responsibility in one sentence (e.g., "This handler parses the user message, calls the chat service, and renders the chat bubble.") without needing to understand the details of conversation loop internals, tool execution, or AI error handling.

**Acceptance Scenarios**:

1. **Given** `src/routes/missions.ts` (currently 716 lines), **When** onboarding orchestration, mission chat orchestration, and activation logic are extracted into service modules, **Then** the file is reduced to no more than 400 lines.
2. **Given** `src/routes/lessons.ts` (currently 413 lines), **When** lesson chat orchestration is extracted into a service module, **Then** the file is reduced to no more than 300 lines.
3. **Given** any route handler in the refactored codebase, **When** inspected, **Then** it does not directly call `conversationLoop()`, `createStandardHooks()`, or `loadMessages()` — those are called from service modules.

---

### User Story 4 - The `db` Middleware Variable Is Either Removed or Properly Wired (Priority: P3)

The `AppVariables` type includes a `db` property (`src/types.ts`), but the middleware never sets it — only `store` is used by route handlers. After this story, either the `db` variable is removed from the type (making the type accurate) or it is properly set by middleware and used by service modules for direct DB access when needed (clarifying the store-vs-db boundary).

**Why this priority**: Dead or misleading type declarations create confusion during development. A developer new to the codebase might try to use `c.get("db")` and be surprised it is undefined at runtime. Cleaning this up removes a subtle trap. However, it has no user-facing impact, hence P3.

**Independent Test**: After the change, attempting to access `c.get("db")` from any route handler either (a) causes a TypeScript compile error (if removed from the type), or (b) returns a valid `BetterSqlite3` instance whose methods can be called without error.

**Acceptance Scenarios**:

1. **Given** the `AppVariables` type definition in `src/types.ts`, **When** inspected, **Then** either the `db` property is absent, or it is documented and set by middleware.
2. **Given** a route handler that calls `c.get("db")`, **When** the project is compiled with `tsc --noEmit`, **Then** if `db` was removed from the type, compilation fails with a type error; if `db` was wired, compilation succeeds and the value is defined at runtime.

---

### Edge Cases

- What happens when a service method throws an unexpected error (not an `AIError`)? The service should catch and wrap the error in a known error type, or the centralized error format utility should handle the fallback. The route handler should never need a try/catch of its own for AI-related errors.
- What happens when a mission is accessed concurrently (two simultaneous chat requests)? The service layer should not introduce any new locking or serialization; existing per-request isolation should be preserved. The service methods are stateless with respect to request lifecycle.
- What happens when a shared utility receives an invalid mission ID (NaN, negative)? The `requireMissionAccess` utility should handle edge cases: NaN from `parseInt()` returns NaN, `store.getMission(NaN, userId)` should return null/false, producing a 404. Document this behavior.
- What happens when `generateSlug` receives an empty string? The existing `|| "new-mission"` fallback (used in browse.ts:80) should be preserved in the utility or at the call site.
- What happens when the `formatAIError` utility receives a non-Error value (e.g., a string or `null`)? The utility must handle `unknown` type and not throw — it should always return a string.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `MissionChatService` (or equivalent named service) MUST encapsulate the common conversation-loop wrapper pattern: building the system prompt (with mission context), calling `conversationLoop()`, setting up tool hooks, and handling save-message-on-exit. Route handlers call this service instead of orchestrating the loop directly.
- **FR-002**: A `generateSlug(title: string): string` utility MUST be extracted into `src/shared/` and replace all three inline slug-generation regex calls. It MUST handle empty input by returning `"new-mission"`.
- **FR-003**: A `formatAIError(err: unknown, fallback?: string): string` utility MUST be extracted into `src/shared/` and replace all four inline AIError catch blocks. It MUST return a user-facing error string and never throw.
- **FR-004**: A `requireMissionAccess(store, missionId, userId): Promise<Mission>` utility function MUST be available in `src/shared/` (or as a service method) that encapsulates the `store.getMission(missionId, userId)` lookup and throws a known error (e.g., `NotFoundError`) or returns the mission. Route handlers can either let a global error handler catch the throw or check the return — the key requirement is that the ownership check + not-found handling is defined in exactly one place, not 20+.
- **FR-005**: All existing route handler tests MUST pass without modification to their test setup (test DB creation, FakeAiClient queue setup, app factory invocation, login/authentication helpers). The only changes to tests SHOULD be additions (e.g., new unit tests for shared utilities) or minor refactors to route handler assertions if the returned HTML changes in a non-functional way.
- **FR-006**: The `db` property in `AppVariables` MUST be either removed or properly wired through middleware. If removed, a TypeScript compile check MUST confirm no code references `c.get("db")`. If wired, the middleware MUST set it and a test MUST confirm it is defined at runtime.
- **FR-007**: The existing onboarding flow in `missions.ts` (guided questions, chat onboarding, activation) MUST continue to work identically after extraction. The integration tests in `missions.test.ts` serve as the regression guard.
- **FR-008**: The service layer modules MUST be importable and testable without creating a full Hono app. Unit tests for utility functions (`generateSlug`, `formatAIError`, `requireMissionAccess`) MUST work with plain function calls and a mock store.

### Key Entities *(include if feature involves data)*

- **MissionChatService**: A service encapsulating the "do a teaching interaction" flow. Accepts mission ID, user ID, user message (and optionally context/lesson info), handles system prompt construction, conversation loop execution, tool hook setup, message persistence, and error formatting. Returns a result object with the AI's reply text.
- **Shared Utilities Module** (`src/shared/`): A collection of standalone utility functions (`generateSlug`, `formatAIError`, `requireMissionAccess`) with no side effects and zero or minimal imports. Each utility has its own unit tests.
- **NotFoundError** (optional): A typed error class that `requireMissionAccess` throws when a mission is not found or does not belong to the user. Route handlers can catch it via Hono's `onError` handler for a consistent 404 response, or handle it inline if they need custom behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `src/routes/missions.ts` is reduced from 716 lines to 400 or fewer.
- **SC-002**: `src/routes/lessons.ts` is reduced from 413 lines to 300 or fewer.
- **SC-003**: Zero route handlers directly import or call `conversationLoop`, `createStandardHooks`, or `loadMessages` from `ai/` modules — all AI orchestration goes through the service layer.
- **SC-004**: The slug-generation regex pattern exists in exactly one source file and zero copies elsewhere.
- **SC-005**: The `err instanceof AIError ? ... : "Something went wrong..."` pattern exists in exactly one utility function, with zero inline copies in route handlers.
- **SC-006**: All existing integration tests pass without changes to test setup (test DB, FakeAiClient, app factory, login helpers). Any new utility unit tests also pass.
- **SC-007**: The `db` property in `AppVariables` is either removed (verified by `tsc --noEmit`) or properly wired (verified by a passing test that calls `c.get("db")` and gets a defined value).
- **SC-008**: A developer can read any route handler in `src/routes/` and identify its complete responsibility in one sentence without needing to understand `conversationLoop` internals.

## Assumptions

- The existing `createMissionConversation` in `ai/mission-conversation.ts` already partially encapsulates onboarding chat orchestration. The new `MissionChatService` may build on or supersede this module — the spec does not prescribe whether to refactor the existing module or create a new one, only that the service boundary exists.
- Route handlers will continue to render HTML directly (using existing view functions). The service layer returns data objects (text, redirect URLs, error info), not rendered HTML. Templates/views remain in `src/views/`.
- Error responses for mission-not-found (404) and AI errors (500-style with user message) may change from `c.text("Not found", 404)` to a uniform response format if a global error handler is introduced. This is acceptable as long as the user-visible behavior (404 status, readable error message) is preserved.
- The service layer introduces no new runtime dependencies. It reuses existing types (`AiClient`, `MissionStore`, `ToolExecutor`, `Logger`) and existing module imports.
- No data model changes are required. The service layer is purely a code organization improvement.
- Performance impact is negligible — the service layer is a thin wrapper over the same function calls currently made directly from route handlers. Latency profiles remain identical.
- The existing test structure (Vitest, in-memory SQLite, `app.request()` HTTP testing, `FakeAiClient` queue pattern) is adequate for testing the service layer and shared utilities without modification.
