# Quickstart: 021-deepen-ai-error

## Prerequisites

- Node.js 22, `npm install` completed
- All existing tests pass: `npm test`

## Validation Scenarios

### 1. Unit test migration

```bash
# The old test file should no longer exist
test ! -f src/shared/errors.test.ts

# The new test file should exist and pass
npx vitest run src/ai/errors.test.ts
```

Expected: tests pass, covering all acceptance scenarios from the spec
(non-recoverable returns message only, recoverable appends hint, non-AIError
falls through to fallback, never throws).

### 2. No dead code

```bash
# formatAIError should not exist anywhere in production code
grep -rn 'formatAIError' src/ --include='*.ts' | grep -v '.test.ts'
# Expected: no output (exit code 1 from grep)

# src/shared/errors.ts should be gone
test ! -f src/shared/errors.ts

# No route file imports from the deleted module
grep -rn '../shared/errors' src/routes/ --include='*.ts'
# Expected: no output
```

### 3. Full test suite regression

```bash
npm test
```

Expected: all tests pass. No test assertions were modified — only import
references changed.

### 4. Message identity verification

For each of the six call sites in `src/routes/`, confirm the catch block
pattern matches:

```text
err instanceof AIError ? err.toUserMessage() : "Something went wrong. Please try again."
```

The routes to check:
- `src/routes/browse.ts` (line ~91)
- `src/routes/chat.ts` (line ~58)
- `src/routes/lessons.ts` (line ~198)
- `src/routes/missions.ts` (line ~348)
- `src/routes/onboarding.ts` (lines ~54, ~111)

### 5. Build check

```bash
npx tsc --noEmit
```

Expected: no type errors.
