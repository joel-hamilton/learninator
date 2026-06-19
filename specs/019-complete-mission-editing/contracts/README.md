# Contracts: Complete Mission Editing Coverage

**Feature**: 019-complete-mission-editing

No new external interfaces. This feature:

1. Adds no new HTTP routes (sidebar tab verification tests existing routes).
2. Adds no new AI tools (the `read_mission_content` and `write_mission_content` tools already exist in `src/ai/teacher.ts`).
3. Modifies no existing tool signatures.

The only behavioral change is injecting `mission_content` text into the system
prompt in `src/ai/mission-conversation.ts` for active-mission chats. This is an
internal implementation detail, not a contract.
