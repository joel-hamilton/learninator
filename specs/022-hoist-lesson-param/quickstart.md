# Quickstart: Hoist Duplicate parseLessonParam

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- Git branch: `022-hoist-lesson-param`

## Validation Scenarios

### Scenario 1: No behavioral regression

```bash
npm test
```

**Expected**: All existing tests pass. No test modifications required — the refactoring preserves exact behavior.

### Scenario 2: parseLessonParam unit tests pass

The new unit tests (added to `src/test/lessons.test.ts` or a dedicated file) verify:

| Test case | Input | Expected `number` | Expected `subNumber` |
|-----------|-------|-------------------|----------------------|
| Single digit | `"1"` | `1` | `null` |
| With sub-number | `"1.2"` | `1` | `2` |
| Double digit | `"42"` | `42` | `null` |
| Double with sub | `"42.7"` | `42` | `7` |
| Empty string | `""` | `NaN` | `null` |
| Just dot | `"."` | `NaN` | `null` |
| Multiple dots | `"1.2.3"` | `1` | `2` |
| Non-numeric | `"abc"` | `NaN` | `null` |
| Trailing dot | `"1."` | `1` | `NaN` |
| Leading dot | `".1"` | `NaN` | `1` |

Run with:
```bash
npm test
```

### Scenario 3: Verify hoist

Check that `parseLessonParam` is imported from the shared module, not defined locally:

```bash
# Should show no local function definition in lessons.ts
grep -c "function parseLessonParam" src/routes/lessons.ts
# Expected output: 0

# Should show no local function definition in lesson-generation.ts
grep -c "function parseLessonParam" src/routes/lesson-generation.ts
# Expected output: 0

# Should show the export in the shared module
grep -c "export function parseLessonParam" src/shared/lesson-numbers.ts
# Expected output: 1
```

### Scenario 4: Manual smoke test

```bash
npm run dev
```

Navigate to any lesson page in the app. Lesson viewing, generation, and navigation should work exactly as before.

## Data Model

See [data-model.md](./data-model.md) for the full function contract.

## No Deployment Changes

- No database migrations
- No environment variable changes
- No Docker rebuild required for logic changes (only if adding test dependencies, which is not the case)
