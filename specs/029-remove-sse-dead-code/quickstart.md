# Quickstart Validation: Remove SSE Dead Code

## Prerequisites
- Node.js 22 installed
- `npm install` completed
- No active changes to working tree (start from clean state)

## Validation Scenarios

### 1. TypeScript compilation
```bash
npx tsc --noEmit
```
Expected: No compilation errors. Exit code 0.

### 2. Full test suite
```bash
npm test
```
Expected: All tests pass. Same number of tests as before the removal. Exit code 0.

### 3. Dead code verification
```bash
# No subscribe calls in non-test source
grep -rn "\.subscribe(" src/ --include="*.ts" | grep -v "\.test\." | grep -v node_modules; echo "Exit: $?"
# No subscribeUser calls in non-test source
grep -rn "subscribeUser" src/ --include="*.ts" | grep -v "\.test\." | grep -v node_modules; echo "Exit: $?"
# No SSE endpoint
grep -rn "/workflows/events" src/ --include="*.ts" | grep -v node_modules; echo "Exit: $?"
# No client stubs
grep -n "addWorkflow\|updateStep\|markComplete\|markError" src/shared/sse-poller.ts; echo "Exit: $?"
```
Expected: All grep commands return empty / exit code 1 (no matches).

### 4. Manual workflow progress check
```bash
npm run dev
```
1. Open browser to http://localhost:3000
2. Sign in with valid credentials
3. Navigate to a mission
4. Click "Generate Next Lesson"
5. Observe the workflow progress indicator in the header
Expected: Progress indicator shows "Generating..." status while generation runs. Workflow indicator goes away when generation completes.

### 5. API smoke test
```bash
# Verify polling endpoint (with valid session cookie)
curl -s -b <session-cookie> http://localhost:3000/workflows/state
```
Expected: Returns JSON with workflows array (possibly empty). No 404 or 500 errors.

```bash
# Verify SSE endpoint returns 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/workflows/events
```
Expected: 404 Not Found (endpoint removed).

## Rollback
If any validation step fails:
1. `git checkout -- src/` to restore original files
2. Investigate the compilation or test failure
3. Re-apply removals with corrections
