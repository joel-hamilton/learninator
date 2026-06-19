# Quickstart: Chat-Based Mission Editing

## Prerequisites

- Repo at `main` with feature branch checked out
- `npm install` completed
- A user account with at least one **active** mission that has some existing
  mission content (created by the onboarding flow)

## Setup

```bash
npm run dev
```

Open the app in a browser and log in.

## Verification scenarios

### Scenario 1: Sidebar tab is gone (User Story 1)

1. Navigate to any active mission: `/missions/<id>`.
2. Inspect the left sidebar.
3. **Expected**: the sidebar shows exactly five tabs — Lessons, Chat,
   Reference, Learning Records, Resources. No "Mission" tab.
4. Click each remaining tab. **Expected**: every tab loads without error.

### Scenario 2: Edit mission goals via chat (User Story 2)

1. From the mission page, open the Chat tab.
2. Send: *"I want to focus more on practical examples instead of theory.
   Please update the mission to reflect that."*
3. **Expected**: the AI replies confirming the update, and uses
   `write_mission_content` server-side (visible in tool-call events / logs).
4. Reload the page, return to Chat, and ask *"What are my current mission
   goals?"*.
5. **Expected**: the AI's reply reflects the practical-examples focus from
   step 2.

### Scenario 3: View current goals (User Story 3)

1. In Chat, ask: *"What are my current mission goals?"*.
2. **Expected**: the AI calls `read_mission_content` and replies with the
   stored mission text.

## Test commands

```bash
npm test -- chat
```

All chat tests must pass — including the new tests that:
- Assert the active-mission sidebar does not include a "Mission" tab.
- Assert the AI invokes `write_mission_content` when asked to change goals.
- Assert the AI invokes `read_mission_content` when asked about current goals.

## Rollback

This feature is additive (test-only) plus a sidebar entry deletion. To roll
back, restore the `{ key: "mission", label: "Mission", ... }` entry in
`src/views/mission.ts`.
