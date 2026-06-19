# Quickstart: Consolidate Activation Bootstrap

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- Working test suite (`npm test` passes on `main`)

## Validation Scenarios

### Scenario 1: Existing tests pass (regression guard)

Run the existing test suite to confirm the refactor introduces no behavioral changes:

```bash
npm test
```

**Expected**: All tests pass. The five activation paths (mission creation, chat, guided start, guided answer, guided skip) are covered by existing HTTP-level tests in `missions.test.ts`, `chat.test.ts`, and `onboarding.test.ts`.

### Scenario 2: grep verification (no leftover duplication)

Confirm that the duplicated pattern has been fully extracted:

```bash
grep -rn "result.didActivate" src/routes/
```

**Expected**: Zero occurrences in `src/routes/` — the pattern is handled entirely within the shared helper `src/shared/activate-mission.ts`.

### Scenario 3: Helper unit behavior

Verify the helper handles edge cases correctly:

1. **Non-activation**: `handleActivation({ didActivate: false }, 1, svc, c)` returns `undefined` without calling `svc.generateTitle` or modifying headers.
2. **Error propagation**: When `svc.generateTitle` throws, the error propagates uncaught (not swallowed).

These can be validated via the existing HTTP tests, which already cover activation and non-activation flows through `FakeAiClient`.

### Scenario 4: Single point of change (maintainability)

After the refactor, adding a post-activation log line should touch only `src/shared/activate-mission.ts`. Verify by inspection:

```bash
grep -n "generateTitle" src/shared/activate-mission.ts
```

**Expected**: Exactly one occurrence of `generateTitle` in the helper (plus zero in route files besides the helper import).

## Deployment Notes

- No database migration needed
- No environment variable changes
- No frontend changes
- Deploy via normal process: `docker compose up --build`
