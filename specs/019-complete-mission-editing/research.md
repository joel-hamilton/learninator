# Research: Complete Mission Editing Coverage

**Feature**: 019-complete-mission-editing
**Date**: 2026-06-18

## Decision 1: How to inject mission content into chat context

**Decision**: Prepend mission content to the system prompt in `createMissionConversation()` when the mission is active and has stored content.

**Rationale**:
- The `TEACHER_SYSTEM_PROMPT` already includes instructions about using `read_mission_content`. Adding the content directly to the prompt avoids an extra AI tool-call round-trip on every new chat session.
- The existing `store.getMissionContent(missionId, "mission")` call is cheap (single indexed SQLite query).
- The `mission-conversation.ts` file already loads the mission and builds the system prompt — adding content is a one-line change.

**Alternatives considered**:
- Force the AI to call `read_mission_content` on first turn: adds latency (extra tool-call round-trip) and token cost. Rejected.
- Add content as a separate `user` message before the first user message: works but clutters the chat UI in some renderings. Rejected.
- Only inject when the user asks about goals: defeats FR-006 (AI should always know current goals). Rejected.

## Decision 2: How to verify cross-user scoping

**Decision**: Write an integration test that seeds two users each with their own mission, authenticates as user A, and verifies that `read_mission_content` returns empty/error when pointed at user B's mission ID.

**Rationale**:
- The chat route (`src/routes/chat.ts`) enforces user scoping via `store.getMission(missionId, user.id)` before any tool executes. A 404 is returned if the mission doesn't belong to the authenticated user. The test verifies this at the integration level.
- The store's `getMissionContent(missionId, contentType)` itself does NOT scope by userId — it relies on the route-level access check. This is acceptable because tool execution uses the route-verified missionId, not user-supplied input.
- `FakeAiClient` can simulate a `read_mission_content` tool call targeting a different mission ID.
- No code change needed — this is purely a test verifying existing behavior.

**Alternatives considered**:
- Unit test the store method directly: violates Principle II (HTTP-level integration testing). Rejected.
- Add explicit mission-ownership check in the tool handler: unnecessary given the route-level enforcement; the missionId is always route-verified before tools run. Rejected.

## Decision 3: How to test remaining sidebar tab routes

**Decision**: Add an HTTP-level test that iterates over the five remaining tab URLs for an active mission and asserts each returns HTTP 200.

**Rationale**:
- Simple, fast, and directly verifies SC-004.
- The tab URL pattern is predictable: `/missions/:id/lessons`, `/missions/:id/chat`, etc.
- Uses `app.request()` — no browser needed.

## Decision 4: How to test edge cases

**Decision**: Use `FakeAiClient` sequences to simulate each edge case scenario:
- **Archived mission**: Queue a tool-use rejection; assert the AI declines.
- **Tool error**: Queue a tool-use that returns an error string; assert error handling.
- **Vague request**: Queue a text response asking for clarification; assert AI handles ambiguity.
- **Fresh content**: Queue a `write_mission_content` tool use for a mission with no prior content; verify upsert works.
- **Contradictory changes**: Queue a text response that picks one interpretation; assert reasonable handling.

**Rationale**:
- `FakeAiClient` already supports `toolUseResponse()` and `textResponse()` — no new test infrastructure needed.
- Each edge case is independently testable as a separate `it()` block.
- The existing test patterns in `chat.test.ts` provide a template for all five scenarios.

## Decision 5: No new dependencies or infrastructure

**Decision**: No new npm packages, no new test utilities, no new directories.

**Rationale**:
- All needed infrastructure exists: `createTestApp()`, `createTestDb()`, `FakeAiClient`, `seedUser()`, `login()`, `authedReq()`.
- The feature is purely verification and one context-injection change.
