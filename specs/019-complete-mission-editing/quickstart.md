# Quickstart: Complete Mission Editing Coverage

**Feature**: 019-complete-mission-editing
**Date**: 2026-06-18

## Prerequisites

- Node.js 22, `npm install` complete
- Database migrated: `npm run db:migrate`
- All existing tests pass: `npm test`

## Validation Scenarios

### 1. Mission content is available in chat context

```bash
npm test -- --run src/test/chat.test.ts
```

Verify the test "AI receives mission content in conversation context for active missions" passes.

### 2. Cross-user scoping is enforced

```bash
npm test -- --run src/test/chat.test.ts
```

Verify the test "read_mission_content returns empty for another user's mission" passes.

### 3. Remaining sidebar tabs all work

```bash
npm test -- --run src/test/missions.test.ts
```

Verify the test "remaining sidebar tabs return 200" passes.

### 4. Edge cases are handled

```bash
npm test -- --run src/test/chat.test.ts
```

Verify all five edge-case tests pass:
- Archived mission declines goal changes
- Tool error preserves previous content
- Vague requests get clarifying questions or reasonable defaults
- Fresh mission content creation via upsert
- Contradictory change resolution

### 5. Full test suite

```bash
npm test
```

Verify zero failures across the entire test suite.

## Manual Smoke Test (optional)

1. `npm run dev`
2. Create a mission, set goals during onboarding, activate it
3. Open Chat tab — the AI should reference the mission goals without being asked
4. Ask "What are my mission goals?" — the AI should respond with the stored content
5. Ask "Change my goals to focus on practical exercises" — the AI should confirm the update
