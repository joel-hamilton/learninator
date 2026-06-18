# Feature Specification: Agentic Workflow Visibility

**Feature Branch**: `001-agentic-workflow-visibility`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Display in-progress agentic workflows to the user at all times."

## Clarifications

### Session 2026-06-18

- Q: How should site-wide status (banner) and page-local progress (detail panels) coexist? → A: Two-level approach — site-wide banner shows summary of all running workflows, page-local panels show detailed step-by-step progress for the current page's workflow. Page-local panels must also persist across page reloads.
- Q: Should workflow progress state survive a full logout/login cycle, or only within-session navigation? → A: Same-session only — state persists across page navigation, reloads, and tab-restores within one login session, but does not survive logout or login.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See AI Teacher's Real-Time Actions (Priority: P1)

As a student chatting with the AI teacher, I want to see what the AI is doing
step by step — which tools it's using, what it's looking up, what it's creating
— so I understand why responses take time and can follow the AI's reasoning
process.

**Why this priority**: This is the core interaction. Chat is the primary
interface between student and AI. Every chat message that triggers tool use
currently shows a generic loading spinner, leaving students in the dark about
what's happening.

**Independent Test**: Start a chat with the AI teacher, ask a question that
triggers tool use (e.g., "create a lesson about X"), and observe that each step
of the AI's workflow appears in the UI as it happens, with visible updates for
each tool call and its result.

**Acceptance Scenarios**:

1. **Given** a student is in an active mission chat, **When** the student sends
   a message that causes the AI to use tools, **Then** the UI shows each tool
   being invoked in real time (not just a generic spinner), with the tool name
   and a brief description of what it's doing.

2. **Given** the AI is executing a multi-step workflow (e.g., lookup mission,
   create lesson, add sub-lessons), **When** each step completes and the next
   begins, **Then** the UI updates to show the current step without requiring
   page refresh.

3. **Given** the AI tool workflow completes, **When** the final text response
   arrives, **Then** the step-by-step display transitions cleanly to show the
   final response alongside the completed steps.

---

### User Story 2 - Site-Wide Workflow Status Indicator (Priority: P2)

As a student using any part of the app, I want a persistent status indicator
visible on every page that shows me what the AI is currently doing on my behalf
— so that I can navigate freely (e.g., go to the dashboard while a lesson
generates) and still see that work is in progress, without having to remember
which page I started from.

**Why this priority**: The user's example — leaving the lesson page while a
lesson generates, then not knowing if it's still running — is a real
abandonment scenario. A site-wide indicator prevents confusion when navigating
away from the page that triggered a workflow. It also fixes the existing buggy
banner that partially attempted this.

**Independent Test**: Trigger lesson generation from a mission page, then
navigate to the dashboard. Observe that a site-wide banner or indicator appears
showing "Lesson generation in progress" (or similar). Navigate to other pages
— the indicator remains visible. Return to the original mission page and
confirm the page-local detail panel also shows the workflow state.

**Acceptance Scenarios**:

1. **Given** a workflow is running (chat tools, lesson generation, or mission
   activation), **When** the user navigates to any page in the app, **Then** a
   site-wide status indicator is visible showing a summary of all active
   workflows.

2. **Given** a site-wide indicator shows an active workflow, **When** the user
   clicks on it, **Then** the user is taken to the relevant page where the
   page-local detail panel shows the full step-by-step progress for that
   workflow.

3. **Given** all workflows have completed or failed, **When** the last workflow
   finishes, **Then** the site-wide indicator dismisses or shows a brief
   "complete" state before disappearing.

4. **Given** a user has a page-local detail panel open for a workflow, **When**
   the user reloads the page or navigates away and back, **Then** the detail
   panel re-renders with the current workflow state (still running, completed,
   or failed) — not a blank slate.

---

### User Story 3 - Track Lesson Generation Progress (Priority: P3)

As a student waiting for a lesson to be generated, I want to see the generation
progress (e.g., "creating outline", "writing section 1 of 5", "generating
quiz") so I know how much longer it will take and that the system hasn't
stalled.

**Why this priority**: Lesson generation is the longest-running background
workflow. A student who clicks "Generate Lesson" and sees only a spinner may
leave or re-click, creating duplicate work. Progress visibility directly
reduces support burden and duplicate generations.

**Independent Test**: Request lesson generation from a mission page, observe
that progress updates appear showing which phase of generation is active and
how many sub-lessons have been created.

**Acceptance Scenarios**:

1. **Given** a student requests lesson generation, **When** the background
   generation job starts, **Then** the UI immediately shows a progress display
   with the current phase (e.g., "Planning lesson structure...").

2. **Given** lesson generation is in progress, **When** each sub-lesson is
   created, **Then** the progress display updates to reflect completed vs.
   remaining sub-lessons.

3. **Given** lesson generation completes, **When** all sub-lessons are ready,
   **Then** the progress display shows completion and the lesson list updates
   with the new content.

---

### User Story 4 - Visibility During Mission Activation (Priority: P4)

As a student completing onboarding for a new mission, I want to see the steps
the AI takes to set up my mission (analyzing my answers, generating a title,
activating the mission) so I understand what's happening after I finish the
onboarding questionnaire.

**Why this priority**: Onboarding is the first experience a new user has with
the AI's agentic behavior. Setting expectations early builds trust. However,
onboarding is a one-time-per-mission flow, making it lower volume than chat.

**Independent Test**: Complete the guided onboarding questionnaire, observe
that after the final answer the UI shows the activation steps (title
generation, mission activation) as they happen rather than a generic loading
state.

**Acceptance Scenarios**:

1. **Given** a student has just answered the final onboarding question, **When**
   the AI begins mission activation, **Then** the UI shows "Creating your
   mission..." with step indicators.

2. **Given** mission activation is in progress, **When** the title is generated
   and the mission is marked active, **Then** each step appears in the UI as it
   completes.

---

### Edge Cases

- What happens when a workflow step fails (e.g., tool call returns an error)?
  The user should see which step failed and receive a clear error message, not
  a frozen spinner.
- What happens when the user navigates away mid-workflow? The site-wide
  indicator MUST remain visible on every page. When the user returns to the
  origin page, the page-local detail panel MUST render with the current
  workflow state (still running, completed, or failed) — not a blank or stale
  view.
- What happens when the user reloads the page mid-workflow? Both the site-wide
  indicator and the page-local detail panel MUST re-render showing current
  state, not start from blank.
- What happens when two workflows overlap (e.g., lesson generation starts while
  a chat response is still streaming)? Each workflow's progress should be
  independently visible — the site-wide indicator shows both, and the
  page-local panel on each relevant page shows its workflow's detail.
- What happens when a workflow completes very quickly (sub-second)? The UI
  should still show completion briefly — avoiding a flash that the user can't
  read.
- What happens if the SSE connection drops? The UI should indicate the
  disconnection and attempt to recover, rather than silently freezing.
- What happens when the existing (buggy) banner conflicts with the new site-wide
  indicator? The old banner MUST be replaced or repaired as part of this
  feature — no duplicate or conflicting indicators.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display real-time progress of AI tool calls during
  chat, including the tool name and a human-readable description of what each
  tool is doing.
- **FR-002**: System MUST update the progress display incrementally as each
  workflow step starts and completes, without requiring page refresh.
- **FR-003**: System MUST show lesson generation progress including the current
  phase and a count of completed vs. total sub-lessons.
- **FR-004**: System MUST display mission activation steps (title generation,
  mission activation) as they occur during the onboarding-to-active transition.
- **FR-005**: System MUST show an error state with the failed step name and a
  description when a workflow step fails, rather than a frozen loading
  indicator.
- **FR-006**: System MUST display a site-wide status indicator on every page
  that summarizes all currently active workflows, showing at minimum the
  workflow type (chat, lesson generation, activation) and status (running,
  completed, failed).
- **FR-007**: The site-wide indicator MUST be clickable and link the user to the
  relevant page where the page-local detail panel shows full step-by-step
  progress for that workflow.
- **FR-008**: System MUST preserve workflow progress visibility when the user
  navigates to a different page and returns, showing the current state (running,
  completed, or failed) in both the site-wide indicator and the page-local
  detail panel.
- **FR-009**: System MUST preserve workflow progress state across page reloads
  — when the user refreshes the browser, the site-wide indicator and page-local
  detail panels MUST re-render with current state, not show a blank slate.
- **FR-010**: System MUST handle multiple concurrent workflows by displaying
  each independently in the site-wide indicator, without one workflow's
  progress display interfering with another's.
- **FR-011**: System MUST indicate when the connection to progress updates is
  lost and attempt to re-establish it automatically.
- **FR-012**: System MUST show immediate visual feedback when a workflow is
  initiated — the trigger element (button, send message) dims or changes before
  the first progress event arrives.
- **FR-013**: Workflow step descriptions MUST be written in plain,
  student-friendly language (e.g., "Looking up your progress..." not
  "Executing get_mission_lessons tool").
- **FR-014**: The existing buggy workflow status banner MUST be repaired or
  replaced — the new site-wide indicator must not coexist with or duplicate a
  broken older version.

### Key Entities

- **Workflow Run**: Represents a single execution of an agentic workflow
  (chat tool-use loop, lesson generation job, mission activation). Tracks
  current status (running, completed, failed), start time, and the sequence of
  steps within it.
- **Workflow Step**: A single action within a workflow run — a tool call, a
  generation phase, or a processing step. Has a label, status (pending, active,
  completed, failed), and optional detail text (e.g., "Sub-lesson 3 of 7").
- **Workflow Event**: A real-time update pushed to the UI when a step starts,
  completes, or fails. Lightweight, carrying only the changed step data plus the
  workflow run identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Students see the first workflow progress update within 1 second of
  triggering an AI action (button click or message send).
- **SC-002**: 100% of AI tool calls during chat are accompanied by a visible
  progress step in the UI — no tool execution happens "in the dark."
- **SC-003**: During lesson generation, progress updates appear at least every 3
  seconds, so students never wait longer than 3 seconds without visible change.
- **SC-004**: When a workflow step fails, the error is displayed within 2
  seconds of the failure occurring.
- **SC-005**: Students can distinguish between "workflow still running" and
  "workflow has stalled/frozen" without guessing — the UI makes the distinction
  clear.

## Assumptions

- The existing SSE event infrastructure (`ai/events.ts`) will serve as the
  transport for workflow progress events. If a different transport is chosen,
  the requirements above still hold.
- A "workflow" is any multi-step AI-driven process: tool-calling loops in chat,
  lesson generation jobs, and mission activation sequences. Single-step
  operations (e.g., a simple chat reply with no tools) do not require step
  display but still require the immediate visual feedback from FR-009.
- The progress display uses a two-level approach: a site-wide status indicator
  (visible on every page) shows a summary of all active workflows, while
  page-local detail panels (on chat, lesson, and mission pages) show full
  step-by-step progress for the workflow relevant to that page. The site-wide
  indicator links to the relevant page — it is not a separate "jobs dashboard"
  page, but rather a persistent element in the app chrome.
- Workflow progress state persists for the duration of the user's login session
  — it survives page navigation, browser reloads, and tab-restores, but does
  NOT survive explicit logout or session expiration. Completed workflow results
  (e.g., generated lessons) are already persisted in the database; only the
  live progress display state is session-scoped.
- Student-friendly language means at roughly a middle-school reading level,
  avoiding technical jargon like "tool," "execute," or "API."
