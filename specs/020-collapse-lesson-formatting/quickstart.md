# Quickstart: Collapse Duplicate Lesson Formatting

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- No database setup needed -- tests use pure functions only

## Validation Scenarios

### 1. Unit tests pass for both functions

```bash
npx vitest run src/shared/lesson-numbers.test.ts
```

**Expected result**: All tests pass (5-8 test cases covering single/double digit, sub-lesson, null sub, zero sub).

### 2. Full test suite has no regressions

```bash
npm test
```

**Expected result**: All existing tests pass alongside the new tests. No integration test flakiness from the import changes.

### 3. TypeScript compiles without errors

```bash
npx tsc --noEmit
```

**Expected result**: No type errors. All call sites have valid imports with matching function signatures.

### 4. Visual regression check (lesson display)

Run the app and navigate to a lesson page:

```bash
npm run dev
# Open http://localhost:3000, log in, open a mission, click a lesson
```

**Expected result**: Lesson numbers display correctly (e.g., "0001", "0001.3", etc.). No rendering differences from before the refactor.

## Test Data

For the shared module tests, no database records are needed. The functions are purely deterministic. See `data-model.md` for the full input/output contract.

Expected test count in `lesson-numbers.test.ts`:

| Test Case | Input | Expected (formatLessonNumber) | Expected (lessonIdStr) |
|-----------|-------|------------------------------|------------------------|
| Single digit, null sub | `(1, null)` | `"0001"` | `"1"` |
| Single digit, with sub | `(1, 3)` | `"0001.3"` | `"1.3"` |
| Double digit, null sub | `(12, null)` | `"0012"` | `"12"` |
| Double digit, with sub | `(12, 3)` | `"0012.3"` | `"12.3"` |
| Zero sub | `(1, 0)` | `"0001.0"` | `"1.0"` |

## If Something Goes Wrong

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Test in `fragments.test.ts` or `lesson.test.ts` fails | Missed a call site that still uses the local function | Run grep for `formatLessonNumber` and `lessonIdStr` in `src/views/` to find remaining local uses |
| `TypeError: this.formatLessonNumber is not a function` in generator | Generator call site not updated from `this.` to bare function | Update the call to not use `this.` |
| Type error in generator (`formatLessonNumber` not found) | Import missing from `generator.ts` | Add `import { formatLessonNumber } from "../shared/lesson-numbers.js"` |
