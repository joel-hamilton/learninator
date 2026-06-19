# Tasks: Chat-Based Mission Editing

**Feature**: 007-chat-based-mission-editing
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

## Phase 1: Setup

(No setup tasks — no new dependencies, no new directories.)

## Phase 2: Foundational

(No foundational tasks — the `mission_content` table and both AI tools already exist.)

## Phase 3: User Story 1 — Remove Broken Mission Sidebar Link (P1)

**Story goal**: The "Mission" tab is gone from the mission layout sidebar; the
remaining five tabs work unchanged.

**Independent test**: Navigate to any active mission, confirm the sidebar
shows exactly Lessons, Chat, Reference, Learning Records, Resources, and that
each loads without error.

- [ ] T001 [US1] Remove the `{ key: "mission", label: "Mission", href: ... }` entry from the `tabs` array in src/views/mission.ts
- [ ] T002 [US1] Remove the now-unused `missionTabContent` function and any related helpers (refine form, confirmation message) in src/views/mission.ts; if `case "mission"` exists in the sidebar icon helper and is no longer referenced, prune it too
- [ ] T003 [P] [US1] Add a test in src/test/chat.test.ts (or a new src/test/mission-layout.test.ts if cleaner) asserting that GET /missions/:id (active mission) HTML does NOT include `href="/missions/<id>/mission"` and DOES include the five remaining tabs

## Phase 4: User Story 2 — Edit Mission Goals via Chat (P2)

**Story goal**: A user can describe a change in chat and the AI updates
mission content via `write_mission_content`, confirming the change in its reply.

**Independent test**: Open Chat on an active mission, send "I want to focus
more on practical examples"; verify the AI calls `write_mission_content` and
confirms the update in its text reply.

- [ ] T004 [US2] Verify in src/ai/teacher.ts that the `write_mission_content` tool description makes clear the AI should use it for user-driven goal changes during chat (read-only review; no code change unless the wording is unclear)
- [ ] T005 [US2] Add a test in src/test/chat.test.ts: POST a chat message requesting a goal change to /missions/:id/chat (active mission). Queue a `FakeAiClient` sequence of `toolUseResponse("write_mission_content", { content_type: "mission", markdown_content: "..." })` followed by `textResponse("Updated your mission to focus on practical examples.")`. Assert (a) the response HTML contains the confirmation text, (b) `store.getMissionContent(missionId, "mission")` returns the new markdown
- [ ] T006 [P] [US2] Add a test in src/test/chat.test.ts asserting that a normal learning question (no goal-change intent) does NOT cause `write_mission_content` to be called — queue only a `textResponse`, send the message, assert the stored mission_content row is unchanged

## Phase 5: User Story 3 — View Current Mission Goals in Chat Context (P3)

**Story goal**: The AI can answer "what are my current mission goals?" by
calling `read_mission_content` and including the stored text in its reply.

**Independent test**: Seed a mission with known mission_content, ask the AI
about current goals in chat, verify the reply reflects the stored content.

- [ ] T007 [US3] Add a test in src/test/chat.test.ts: seed `mission_content` for the mission via `store.upsertMissionContent`. Queue a `FakeAiClient` sequence of `toolUseResponse("read_mission_content", { content_type: "mission" })` followed by `textResponse("Your current goals are: <stored content>")`. POST "What are my current mission goals?" to /missions/:id/chat, assert the reply text references the seeded content

## Phase 6: Polish & Cross-Cutting

- [ ] T008 Run `npm test` and confirm all suites pass (including the three new tests)
- [ ] T009 Manual smoke test via `npm run dev`: open an active mission, verify the sidebar has only five tabs and that chat-driven goal updates persist across reload (see quickstart.md scenarios)

## Dependencies

- US1 is independent of US2 and US3 — can ship as MVP on its own.
- US2 and US3 share zero source-code edits with US1; their tests are independent.
- US2 and US3 do not depend on each other.
- Polish tasks (T008, T009) run after all story tasks complete.

## Parallel Execution Opportunities

- T003, T006, T007 can be authored in parallel (different test cases, same file `src/test/chat.test.ts`, but they don't conflict if added as separate `it(...)` blocks — coordinate the merge order).
- T001 and T002 touch the same file (`src/views/mission.ts`) and must run sequentially.

## Implementation Strategy

**MVP scope**: User Story 1 alone — removing the broken tab — already delivers
the most visible user-facing fix and is the spec's P1.

**Increment 2**: User Story 2 (write tool wired through chat) makes the
replacement editing flow work. The tool already exists; this is verification.

**Increment 3**: User Story 3 (read tool exercised by chat) closes the loop
for transparency.
