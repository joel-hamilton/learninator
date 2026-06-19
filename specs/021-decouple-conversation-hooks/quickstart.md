# Quickstart: Validate Conversation Hook Decoupling

## Prerequisites

- Node.js 22, npm installed
- Working test suite (`npm test` passes on `main`)
- Feature branch created from `main`

## Setup

```bash
git checkout -b 021-decouple-conversation-hooks
npm install
```

## Validation Scenarios

### Scenario 1: Existing tests pass (regression check)

```bash
npm test
```

**Expected**: All existing tests pass without modification. This proves backward compatibility (SC-003).

**Key test files to watch**:
- `src/test/chat.test.ts` — chat reply, tool-using chat, activation
- `src/test/missions.test.ts` — mission creation, guided onboarding
- `src/test/lessons.test.ts` — lesson completion, feedback
- `src/test/onboarding.test.ts` — guided onboarding HTTP flow

---

### Scenario 2: Unit test — conversationLoop emits tool_start/tool_end

```bash
npx vitest run src/test/conversation.test.ts
```

**Expected**: A new test verifies:
1. Given a `conversationLoop` with an `EventBus` and tool blocks, `tool_start` is emitted before tool execution and `tool_end` after.
2. Given a `conversationLoop` without an `EventBus`, no events are emitted (no crash).
3. Given a `conversationLoop` with no tool blocks in the AI response, no events are emitted.

**See**: `src/test/conversation.test.ts` (to be created as part of implementation).

---

### Scenario 3: Manual SSE smoke test

```bash
npm run dev
```

1. Open the app in a browser. Start a new mission.
2. Send a chat message that triggers a tool call (e.g., "Create a lesson about X").
3. Observe the job progress UI — tool labels should appear as the AI works.
4. Confirm the UI does NOT hang with a perpetual spinner.

**Expected**: Tool progress events appear in the UI identically to before the refactor. No visual regression.

---

### Scenario 4: Static analysis — no event emission in hook factories

```bash
# Verify createStandardHooks no longer references emit
grep -n "emit" src/ai/conversation.ts | grep -v "events?.emit" | grep -v "EventBus"
```

**Expected**: Only the new `events?.emit(...)` calls in `conversationLoop` appear. No `emit` calls inside `createStandardHooks`.

```bash
# Verify LessonGenerator no longer references events.emit
grep -n "events?.emit\|events\.emit" src/lessons/generator.ts
```

**Expected**: No matches (after refactoring).

---

## Rollback

If any validation scenario fails:
1. `git checkout main specs/021-decouple-conversation-hooks/` (revert spec artifacts)
2. `git checkout main src/ai/conversation.ts src/services/mission-chat.service.ts src/lessons/generator.ts` (revert code)
3. Investigate and fix before re-applying.

## Reference

- [Data Model](../data-model.md) — type/interface changes
- [Contracts](../contracts/conversation-loop.md) — conversationLoop contract
- [Contracts](../contracts/create-standard-hooks.md) — createStandardHooks contract
- [Contracts](../contracts/lesson-generator-hooks.md) — LessonGenerator contract
