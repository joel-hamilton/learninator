# Quickstart: Eliminate Duplicate Modules

## Prerequisites

- Node.js 22, npm install complete
- All existing tests passing: `npm test`

## Validation Checklist

### 1. Run full test suite

```bash
npm test
```

Expected: All tests pass. No `onboarding/index.test.ts` or `mission-conversation.test.ts` exist — those tests were either migrated to HTTP-level tests or deleted along with dead modules.

### 2. Verify inline code is removed from routes

```bash
# Onboarding helpers removed from routes
grep -c "function getOnboardingPrompt" src/routes/missions.ts  # → 0
grep -c "function generateMissionTitle" src/routes/missions.ts  # → 0
grep -c "function runConversationLoop" src/routes/missions.ts   # → 0

# Browse constants removed from routes
grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts             # → 0
grep -c "parseBrowseResponse" src/routes/browse.ts              # → 0
grep -c "FALLBACK_OPTIONS" src/routes/browse.ts                 # → 0
```

### 3. Verify canonical service exists and is wired

```bash
# MissionChatService exists and is the canonical implementation
test -f src/services/mission-chat.service.ts                    # → exists

# Used by route files
grep -c "missionChatService" src/routes/missions.ts             # → ≥ 2
grep -c "missionChatService" src/routes/onboarding.ts           # → ≥ 3

# TopicExplorer wired to browse routes
grep -c "createTopicExplorer" src/routes/browse.ts              # → ≥ 1
grep -c "TopicExplorer" src/routes/browse.ts                    # → ≥ 1
```

### 4. Verify dead code is removed

```bash
# Third onboarding implementation deleted
test -f src/ai/mission-conversation.ts                          # → file not found (exit 1)

# Dead onboarding module deleted
test -f src/onboarding/index.ts                                 # → file not found (exit 1)
test -f src/onboarding/index.test.ts                            # → file not found (exit 1)
```

### 5. Verify exactly one implementation survives

```bash
# Only one onboarding/chat conversation service
grep -rl "conversationLoop\|createStandardHooks" src/ --include="*.ts" | grep -v test | grep -v node_modules
# Expected results:
#   src/services/mission-chat.service.ts
#   src/onboarding/index.ts  ← TO DELETE (dead code)
#   src/ai/conversation.ts   ← library, not a duplicate
```

### 6. Boot check

```bash
npx tsx src/index.ts &
sleep 2
curl -s http://localhost:3000/ | head -20
kill %1
```

Expected: Server starts without module resolution errors. Home page renders HTML.

### 7. Type check

```bash
npx tsc --noEmit
```

Expected: No type errors.
