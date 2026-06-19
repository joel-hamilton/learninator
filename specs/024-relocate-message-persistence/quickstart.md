# Quickstart Validation Guide: Relocate Message Persistence

## Prerequisites

- Working development environment (Node.js 22, npm dependencies installed)
- All existing tests pass before starting this feature: `npm test`

## Validation Scenarios

### 1. Codebase Integrity Check

Run the following checks to confirm the relocation is complete:

```bash
# Confirm old file is deleted
test ! -f src/shared/messages.ts && echo "OK: messages.ts deleted"

# Confirm new files exist
test -f src/ai/persistence.ts && echo "OK: persistence.ts created"
grep -q "contentToText" src/views/shared.ts && echo "OK: contentToText in shared.ts"

# Confirm no stale imports remain
! grep -rn "../shared/messages" src/ --include="*.ts" && echo "OK: no stale imports"
```

### 2. Test Suite

```bash
# Run full test suite
npm test
```

**Expected**: All tests pass. Since this is a pure relocation, test failures indicate an issue with the move.

### 3. Manual Smoke Test

```bash
# Start the app
npm run dev
```

1. Create a new mission — verify onboarding renders correctly
2. Send a chat message — verify user message appears and AI responds
3. Reload the mission page — verify chat history is preserved
4. Verify lesson page displays correctly (contentToText used for rendering)

## Expected Outcomes

| Check | Expected Result |
|-------|----------------|
| TypeScript compilation | No errors, no unused import warnings |
| `npm test` | All tests pass |
| New files exist | `src/ai/persistence.ts` created |
| Old file deleted | `src/shared/messages.ts` does not exist |
| Stale imports | Zero imports from `../shared/messages.js` |
| Unused imports | No `eq` or `asc` imports in new files |
| App behavior | Identical to pre-refactor — no regression |
