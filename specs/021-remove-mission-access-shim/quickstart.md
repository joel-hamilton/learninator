# Quickstart: Remove Mission Access Pass-Through

## Prerequisites

- Node.js 22+
- `npm install` completed
- All existing tests passing before the change

## Setup

```bash
cd /path/to/learninator
npm install
npm test            # Verify baseline: all tests pass
```

## Validation Scenarios

### 1. File deletion confirmed

```bash
# The module file must no longer exist
test ! -f src/shared/require-mission-access.ts
# The test file must no longer exist
test ! -f src/shared/require-mission-access.test.ts
```

### 2. No remaining imports

```bash
grep -rn "requireMissionAccess\|require-mission-access" src/ --include='*.ts'
# Expected: no output (exit code 1)
```

### 3. TypeScript compiles cleanly

```bash
npx tsc --noEmit
# Expected: exit code 0, no errors
```

### 4. All existing tests pass

```bash
npm test
# Expected: all tests pass (same as baseline)
# Specifically: the NaN guard behavior continues to work because
# integration tests exercise it end-to-end
```

### 5. NaN guard behavior (manual smoke test)

If the dev server is running, these requests should return 404:

```bash
# Non-numeric mission ID
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/missions/abc/lessons
# Expected: 404

# Negative mission ID
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/missions/-1/lessons
# Expected: 404

# Zero mission ID
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/missions/0/lessons
# Expected: 404
```

### 6. Normal access still works (requires seeded data)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/missions/1/lessons
# Expected: 200 (with valid session cookie for user who owns mission 1)
```

## Expected Outcomes

| Check | Expected | How to verify |
|-------|----------|---------------|
| Module file deleted | File not found | `ls src/shared/require-mission-access.ts` fails |
| Test file deleted | File not found | `ls src/shared/require-mission-access.test.ts` fails |
| No imports remain | Zero matches | `grep -r require-mission-access src/` returns nothing |
| TypeScript compiles | Clean compile | `npx tsc --noEmit` exits 0 |
| Tests pass | All green | `npm test` exits 0 |
| NaN guard preserved | 404 on bad IDs | curl with non-numeric or negative mission ID |
| Normal access preserved | 200 on valid IDs | curl with valid mission ID + auth |
