# Feature Specification: Complete Mission Editing Coverage

**Feature Branch**: `019-complete-mission-editing`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Fix all gaps found in the 007-chat-based-mission-editing analysis: missing test coverage for FR-006 (mission content at conversation start), FR-008 (cross-mission scoping), SC-004 (remaining tab functionality), all five edge cases, and explicit edit confirmation in chat replies."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mission Content Is Available in Every Chat (Priority: P1)

When a user opens a chat for an active mission, the AI teacher can immediately reference the current mission goals without the user having to restate them. The mission content is provided in the conversation context so the AI's teaching stays aligned with the mission's purpose from the first message.

**Why this priority**: This is the CRITICAL gap from the analysis — FR-006 has zero coverage. Without this, the AI teaches blind until the user explicitly asks about goals, undermining the core value of mission-scoped tutoring.

**Independent Test**: Seed a mission with known mission content, open a chat and send any message, verify the AI's system prompt or initial context includes the mission content.

**Acceptance Scenarios**:

1. **Given** an active mission with stored mission content ("Learn Rust by building a CLI tool"), **When** the user sends any chat message, **Then** the AI's conversation context includes the mission content so it can reference the goals in its reply.
2. **Given** an active mission with no stored mission content (fresh mission), **When** the user sends a chat message, **Then** the AI operates normally without stale or missing content — it acknowledges no goals are set yet.
3. **Given** mission content was updated via `write_mission_content` in a previous chat turn, **When** a new chat session starts, **Then** the AI sees the updated content, not the original.

---

### User Story 2 - Mission Editing Is Scoped to the Correct User (Priority: P2)

A user can only read and update mission content for their own missions. The AI tools for reading and writing mission content are scoped to the authenticated user's missions — a user cannot access or modify another user's mission goals, even if they somehow obtained the mission ID.

**Why this priority**: FR-008 is a HIGH gap. Cross-user data leakage is a security and correctness concern even in a single-user-dominant tutoring app.

**Independent Test**: Seed two users each with their own mission. Authenticate as user A, attempt to read mission content for user B's mission via the chat tool path, and verify the request is rejected or returns empty.

**Acceptance Scenarios**:

1. **Given** user A and user B each have a mission with distinct mission content, **When** user A's chat session attempts to call `read_mission_content` for user B's mission ID, **Then** the tool returns an error or empty result (does not leak user B's content).
2. **Given** user A has an active mission, **When** user A's chat session calls `write_mission_content` for their own mission, **Then** the update succeeds normally — scoping does not block legitimate use.

---

### User Story 3 - Remaining Sidebar Tabs All Work (Priority: P2)

After removing the broken "Mission" tab, the remaining five sidebar tabs (Lessons, Chat, Reference, Learning Records, Resources) all navigate to functioning pages without errors.

**Why this priority**: SC-004 requires no regressions. The current test (T003) only checks tab presence in HTML, not that each tab route responds correctly.

**Independent Test**: For each of the five remaining tab URLs, make an HTTP request and verify the response status is 200 (not 404 or 500).

**Acceptance Scenarios**:

1. **Given** an active mission, **When** the user clicks each remaining sidebar tab, **Then** each page loads with a 200 status and renders content (not an error page).
2. **Given** a mission in onboarding status, **When** the sidebar renders, **Then** the tabs that are applicable to that status render correctly.

---

### User Story 4 - Edge Cases Are Handled Gracefully (Priority: P3)

All five edge cases identified in the original spec are covered: archived mission editing decline, contradictory changes, tool errors, vague requests, and fresh mission content creation.

**Why this priority**: Edge cases are important for robustness but don't block the core feature — they can be verified and documented after the primary flows work.

**Independent Test**: Each edge case can be tested independently by setting up the specific scenario and verifying the system's response.

**Acceptance Scenarios**:

1. **Given** an archived mission, **When** the user asks the AI to change mission goals, **Then** the AI declines and explains the mission is archived (does not call `write_mission_content`).
2. **Given** an active mission with existing content, **When** the user sends a vague request like "make it better", **Then** the AI either asks a clarifying question or applies a reasonable interpretation and confirms what it changed.
3. **Given** a mission where `write_mission_content` fails (e.g., store error), **When** the user requests a goal change, **Then** the AI reports the failure to the user and the previous content is preserved.
4. **Given** a mission with no stored mission content, **When** the user asks the AI to "update the goals to focus on X", **Then** the AI creates the content fresh (upsert) and confirms the new goals.
5. **Given** an active mission, **When** the user sends contradictory changes in the same message (e.g., "make it harder but also easier"), **Then** the AI resolves the contradiction by picking the clearest intent or asking for clarification.

---

### Edge Cases

- What happens when the store is unavailable during a `read_mission_content` call? The tool returns an error string; the AI reports the issue in chat.
- What happens when the conversation loop fails mid-tool-call (network error, timeout)? The error is caught by the existing conversation loop error handling and surfaced to the user.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mission content MUST be included in the AI's conversation context for active mission chats so the AI can reference current goals without the user explicitly asking.
- **FR-002**: The `read_mission_content` and `write_mission_content` tools MUST enforce user scoping — they MUST NOT return or modify content for missions belonging to a different user.
- **FR-003**: All five remaining sidebar tabs (Lessons, Chat, Reference, Learning Records, Resources) MUST return HTTP 200 when navigated to from an active mission.
- **FR-004**: The AI MUST decline goal-change requests for archived missions with a message explaining the mission is read-only.
- **FR-005**: When `write_mission_content` fails, the AI MUST report the failure to the user and the previous content MUST remain unchanged.
- **FR-006**: The AI MUST handle vague goal-change requests by either asking a clarifying question or applying the best interpretation with explicit confirmation of what was changed.
- **FR-007**: The AI MUST confirm any mission content change in its chat reply so the user knows exactly what was updated.
- **FR-008**: When a mission has no stored content, the AI MUST be able to create it fresh when the user requests a goal change.

### Key Entities

- **Mission Content**: Already exists in the data model. This feature adds no new entities — it ensures the existing entity is properly scoped, context-injected, and edge-case-handled.
- **Mission**: Already exists. The `status` field (onboarding, active, archived) gates whether content editing is allowed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A test verifies that mission content is available in the AI's conversation context for active mission chats (FR-001 covered).
- **SC-002**: A test verifies that cross-user mission content access is blocked (FR-002 covered).
- **SC-003**: All five remaining sidebar tab URLs return HTTP 200 for an active mission (FR-003 covered).
- **SC-004**: All five edge cases from the original 007 spec have at least one test each verifying expected behavior.
- **SC-005**: The full test suite (`npm test`) passes with zero failures after all new tests are added.

## Assumptions

- The existing `mission_content` table and store methods (`getMissionContent`, `upsertMissionContent`) are correct and do not require schema changes.
- The existing `mission-conversation.ts` already loads `TEACHER_TOOLS` for active missions; injecting mission content into context is a configuration change, not an architectural one.
- The sidebar tabs already have working route handlers — the test verifies they haven't regressed, not that they need to be built.
- Edge case handling is primarily verified through integration tests using `FakeAiClient` with appropriate tool-use sequences, not manual testing.
- The `FakeAiClient` test helper is sufficient for simulating tool errors, missing content, and archived mission scenarios.
