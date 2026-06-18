# Feature Specification: Mission Tab Routes

**Feature Branch**: `005-mission-tab-routes`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Add two routes to fix the 404 on the Mission tab in the mission sidebar: GET /missions/:missionId/mission and POST /missions/:missionId/mission/refine"

## User Scenarios & Testing

### User Story 1 - View mission overview (Priority: P1)

As a user with an active mission, I want to click the "Mission" tab in the sidebar so that I can see the MISSION.md content and request AI-driven refinements.

**Why this priority**: This is a bug fix -- the sidebar tab currently returns 404, making the Mission tab unusable.

**Independent Test**: Can be fully tested by clicking the "Mission" tab in any active/archived mission's sidebar and verifying the MISSION.md content displays.

**Acceptance Scenarios**:

1. **Given** I am viewing a mission, **When** I click the "Mission" tab in the sidebar, **Then** I see the mission's MISSION.md content rendered as formatted markdown text.
2. **Given** the mission has no MISSION.md content yet, **When** I click the "Mission" tab, **Then** I see a "No mission statement yet" message.
3. **Given** I am on the Mission tab, **When** I look at the sidebar, **Then** the "Mission" tab is highlighted as active.

---

### User Story 2 - Refine the mission via AI (Priority: P1)

As a user viewing the Mission tab, I want to type a refinement request and submit it so that the AI updates the MISSION.md (and optionally other content documents) based on my feedback.

**Why this priority**: The refine form is already rendered in the view but submits to a nonexistent route, making it non-functional.

**Independent Test**: Can be tested by submitting a refinement request on the Mission tab and verifying the mission content updates with a confirmation message.

**Acceptance Scenarios**:

1. **Given** I am on the Mission tab, **When** I type a refinement request and click "Refine", **Then** the AI processes my request and the mission content updates accordingly, showing a confirmation message.
2. **Given** the AI encounters an error during refinement, **When** I submit a request, **Then** an error message is displayed on the Mission tab.

---

### Edge Cases

- What happens when the mission is in "onboarding" status? The tab should still render content if available, or show an empty state.
- What happens when the form is submitted with an empty message? Re-render the current content without changes.
- What happens if the AI's refinement partially succeeds (some content updated before error)? The latest available content is displayed along with the error message.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a GET route at `/missions/:missionId/mission` that returns the mission tab HTML with MISSION.md content rendered as formatted markdown.
- **FR-002**: The GET route MUST use `missionTabContent()` from `src/views/mission.ts` to render the tab content.
- **FR-003**: The GET route MUST wrap content in `missionLayout()` with `activeTab: "mission"`.
- **FR-004**: The GET route MUST return 404 if the mission does not exist or does not belong to the authenticated user.
- **FR-005**: System MUST provide a POST route at `/missions/:missionId/mission/refine` that accepts a `message` field from the form body.
- **FR-006**: The POST route MUST save the user's refinement message and run an AI conversation loop to process the refinement.
- **FR-007**: On successful refinement, the POST route MUST re-fetch the mission content and re-render the mission tab with a confirmation message.
- **FR-008**: On AI error, the POST route MUST display an error message on the mission tab along with the latest content.

### Key Entities

- **Mission**: Learning mission with associated content documents (MISSION.md, NOTES.md, etc.)
- **MissionContent**: Key-value store for mission documents identified by content type ("mission", "notes", etc.)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can view the mission overview without encountering a 404 error.
- **SC-002**: Users can submit refinement requests and receive visual feedback (confirmation or error).
- **SC-003**: The existing mission tab view and refine form work end-to-end without client-side changes.

## Assumptions

- The existing `missionTabContent()`, `missionLayout()`, `formatMarkdown()`, and `conversationLoop()` functions are correct and will be reused as-is.
- The AI has appropriate tools (`read_mission_content`, `write_mission_content`) to read and update mission content during refinement.
- The existing authentication middleware (`auth.requireAuth`) and route patterns (store usage, error handling) will be followed.
