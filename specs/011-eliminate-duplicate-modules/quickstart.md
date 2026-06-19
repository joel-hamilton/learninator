# Quickstart: Eliminate Duplicate Modules

## Prerequisites

- Node.js 22, npm install complete
- Database migrated: `npm run db:migrate`

## Validation Checklist

### 1. Run full test suite

```bash
npm test
```

Expected: All tests pass. The `onboarding/index.test.ts` file no longer exists — the same scenarios are covered by HTTP-level integration tests (`missions.test.ts`, `chat.test.ts`).

### 2. Verify dead code is removed

```bash
# The dead onboarding module is deleted
ls src/onboarding/index.ts    # → file not found
ls src/onboarding/index.test.ts  # → file not found

# The third implementation is deleted
ls src/ai/mission-conversation.ts       # → file not found
ls src/ai/mission-conversation.test.ts  # → file not found
```

### 3. Verify no inline code in routes

```bash
# No inline onboarding helpers in routes
grep -c "function getOnboardingPrompt" src/routes/missions.ts  # → 0
grep -c "function generateMissionTitle" src/routes/missions.ts  # → 0
grep -c "function runConversationLoop" src/routes/missions.ts   # → 0

# No inline browse constants in routes  
grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts             # → 0
grep -c "FALLBACK_OPTIONS" src/routes/browse.ts                 # → 0
grep -c "parseBrowseResponse" src/routes/browse.ts              # → 0
```

### 4. Verify service imports in routes

```bash
grep -c "missionChatService" src/routes/missions.ts   # → at least 1
grep -c "missionChatService" src/routes/onboarding.ts # → at least 1
grep -c "missionChatService" src/routes/chat.ts       # → at least 1
grep -c "createTopicExplorer" src/routes/browse.ts    # → at least 1
```

### 5. Boot check

```bash
npx tsx src/index.ts &
sleep 2
curl -s http://localhost:3000/ | head -20
kill %1
```

Expected: Server starts without module resolution errors. Home page renders HTML.

### 6. Type check

```bash
npx tsc --noEmit
```

Expected: No type errors.
