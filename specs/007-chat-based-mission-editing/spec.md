# Feature Specification: Chat-Based Mission Editing

**Feature Branch**: `007-chat-based-mission-editing`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "I don't like the 'Mission' thing in the sidebar (and it's broken anyway, it goes to a 404 page). We delete it and come up with a better way to 'Edit' the mission? Basically we want to be able to make shifts to the mission goals/params after it has begun. This should mostly be a chat-based thing, not sure where it should live."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Broken Mission Sidebar Link (Priority: P1)

A user opens an active mission and sees the sidebar navigation. The broken "Mission" tab (which currently links to a 404 page) is gone. The remaining sidebar tabs (Lessons, Chat, Reference, Learning Records, Resources) are untouched and continue to work.

**Why this priority**: The broken link is a dead end that frustrates users and makes the app feel unfinished. Removing it is a simple, standalone fix with immediate UX improvement.

**Independent Test**: Navigate to any active mission, verify the sidebar no longer shows a "Mission" tab, and verify all remaining tabs still work correctly.

**Acceptance Scenarios**:

1. **Given** a user viewing an active mission, **When** the sidebar renders, **Then** the "Mission" tab is not present, and the remaining five tabs (Lessons, Chat, Reference, Learning Records, Resources) display correctly.
2. **Given** a user viewing an active mission, **When** they click any remaining sidebar tab, **Then** the correct page loads without errors.
3. **Given** a user viewing a mission in onboarding status, **When** the sidebar renders, **Then** the "Mission" tab is not present (consistent behavior regardless of mission status).

---

### User Story 2 - Edit Mission Goals via Chat (Priority: P2)

A user is in an active mission and realizes the original goals or parameters need adjusting — perhaps the scope was too broad, or they want to focus on a specific subtopic. They go to the Chat tab, describe what they want to change, and the AI teacher updates the mission content accordingly through the conversation. The AI confirms the changes and the updated mission goals are reflected in future lessons and chat context.

**Why this priority**: This is the core replacement for the broken Mission page. Users need a way to refine mission goals after the mission has started, and chat is the natural interface for an AI-native app.

**Independent Test**: Open the Chat tab for an active mission, send a message like "I want to focus more on practical examples instead of theory", and verify the AI teacher acknowledges and updates the mission content.

**Acceptance Scenarios**:

1. **Given** a user in the Chat tab of an active mission, **When** they send a message requesting a change to mission goals, **Then** the AI teacher understands the request, uses a tool to update the mission content, and confirms the change in its reply.
2. **Given** a user in the Chat tab of an active mission, **When** they send a message that is a normal learning question (not a goal change), **Then** the AI responds normally without modifying mission content.
3. **Given** mission content that was updated via chat, **When** the user continues with lessons or future chat messages, **Then** the AI's teaching reflects the updated goals.

---

### User Story 3 - View Current Mission Goals in Chat Context (Priority: P3)

A user wants to check what the current mission goals are without leaving the chat. The AI teacher has access to the mission content and can reference it in conversation. If the user asks "what are my current mission goals?", the AI responds with the stored mission description.

**Why this priority**: Enables transparency — users can verify what the AI thinks the mission is before and after making changes. Without this, users are editing blind.

**Independent Test**: In the Chat tab, ask "What are the current mission goals for this mission?" and verify the AI responds with the stored mission content.

**Acceptance Scenarios**:

1. **Given** a mission with stored mission content, **When** the user asks "What are my mission goals?" in chat, **Then** the AI teacher responds with the current mission content.
2. **Given** mission content was just updated via chat, **When** the user asks about current goals, **Then** the AI responds with the newly updated content, not stale data.

---

### Edge Cases

- What happens when a user asks to change mission goals for an archived mission? The AI should decline and explain the mission is archived.
- What happens when a user requests contradictory changes (e.g., "make it harder" then immediately "make it easier")? The AI applies the latest change; each update overwrites the previous mission content.
- What happens when the AI fails to update mission content (tool error)? The AI reports the failure to the user and the previous content is preserved unchanged.
- What happens when the user sends a very long or vague goal-change request? The AI uses its judgment to extract and apply the core intent, or asks clarifying questions if the intent is genuinely unclear.
- What happens when a mission has no stored mission content yet? The AI acknowledges there's no existing content to update and creates it fresh.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The "Mission" tab link MUST be removed from the sidebar navigation in the mission layout.
- **FR-002**: The AI teacher MUST have access to a tool that can read the current mission content (the stored mission statement/goals).
- **FR-003**: The AI teacher MUST have access to a tool that can update (upsert) the mission content based on user requests in chat.
- **FR-004**: After updating mission content, the AI teacher MUST confirm the changes to the user in its chat reply.
- **FR-005**: The mission content update tool MUST store changes persistently so they survive page reloads and new chat sessions.
- **FR-006**: The mission content read tool MUST provide the current mission content to the AI at the start of each chat conversation, so the AI's teaching is always aligned with current goals.
- **FR-007**: Users MUST be able to see the current mission goals by asking the AI in chat (no separate UI page needed).
- **FR-008**: Mission content updates MUST be scoped to the current mission — the AI MUST NOT be able to modify another user's mission content.

### Key Entities

- **Mission Content**: The stored statement of mission goals and parameters. Written in plain text/markdown. Each mission has one mission content record. Editing via chat updates this record in place.
- **Mission**: The learning mission itself. Has a status (onboarding, active, archived). Mission content editing via chat is only meaningful for active missions — onboarding missions use their own goal-setting flow, and archived missions are read-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The broken "Mission" sidebar link is gone — navigating to any mission page no longer shows a 404-bound link in the sidebar.
- **SC-002**: A user can describe a goal change in chat and see the AI confirm the update within a single conversation turn (no multi-step form or separate page navigation required).
- **SC-003**: 100% of mission content updates made via chat persist across page reloads — reloading the chat page and asking "what are my goals?" returns the updated content.
- **SC-004**: The remaining five sidebar tabs (Lessons, Chat, Reference, Learning Records, Resources) continue to work correctly with no regressions.

## Assumptions

- Mission content storage already exists — this feature adds the ability to read and update it through chat, not new storage infrastructure.
- The AI teacher can be given new tools (read mission content, update mission content) within the existing tool framework without architectural changes.
- The chat interface already loads mission context; this feature adds a read tool for user-facing transparency and an update tool for mutation.
- Mission content editing via chat is only available for missions in "active" status. Onboarding missions use the guided flow or onboarding chat, which has its own goal-setting mechanism. Archived missions are read-only.
- The sidebar removal is a simple removal of the broken link and its associated display code — no redirect or data migration needed since the link was always a 404.
