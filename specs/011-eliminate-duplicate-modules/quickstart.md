# Quickstart: Eliminate Duplicate Modules

## Prerequisites

- Node.js 22, npm install complete
- All existing tests passing: `npm test`

## Validation Checklist

### 1. Run full test suite

```bash
npm test
```

Expected: All tests pass (same count as before refactor). The `mission-conversation.test.ts` file no longer exists — those tests have been migrated into the existing test suite.

### 2. Verify inline code is removed

```bash
# Onboarding helpers removed from routes
grep -c "function getOnboardingPrompt" src/routes/missions.ts  # → 0
grep -c "function generateMissionTitle" src/routes/missions.ts  # → 0
grep -c "function runConversationLoop" src/routes/missions.ts   # → 0

# Browse constants removed from routes  
grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts             # → 0
grep -c "FALLBACK_OPTIONS" src/routes/browse.ts                 # → 0
grep -c "parseBrowseResponse" src/routes/browse.ts              # → 0
```

### 3. Verify module imports exist

```bash
grep -r "createOnboarding" src/routes/     # → at least 1 match
grep -r "createTopicExplorer" src/routes/  # → at least 1 match
```

### 4. Verify third module is deleted

```bash
ls src/ai/mission-conversation.ts          # → file not found
ls src/ai/mission-conversation.test.ts     # → file not found
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
