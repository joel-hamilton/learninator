# Quickstart: Deduplicate Tool Display Labels

**Phase**: 1 (Design & Contracts)

## Prerequisites

- Node.js 22
- `npm install` completed
- All existing tests pass before starting

## Validation scenarios

### 1. Verify merged TOOL_DISPLAY_NAMES contains all entries

Run this check to confirm all 3 missing entries were added:

```bash
grep -cE '(search_web|read_reference_doc|read_learning_record)' src/ai/tools.ts
```

Expected: count of 3 lines matched (one per entry).

### 2. Verify TOOL_LABELS is deleted

```bash
grep -c 'TOOL_LABELS' src/ai/workflow-state.ts
```

Expected: 0 (no references to `TOOL_LABELS` remaining).

### 3. Run existing tests

```bash
npm test
```

Expected: all tests pass. The refactoring must not change any tool label string values.

### 4. Verify toolDisplayLabel returns correct labels

```bash
npx tsx -e "
import { TOOL_DISPLAY_NAMES } from './src/ai/tools.js';
import { toolDisplayLabel } from './src/ai/workflow-state.js';

const names = Object.keys(TOOL_DISPLAY_NAMES);
let ok = true;
for (const name of names) {
  const actual = toolDisplayLabel(name);
  const expected = TOOL_DISPLAY_NAMES[name];
  if (actual !== expected) {
    console.error('MISMATCH:', name, '->', actual, '!==', expected);
    ok = false;
  }
}
if (ok) console.log('All', names.length, 'labels match.');
"
```

Expected: "All 20 labels match."

### 5. Verify generator toolLabel produces correct labels

This is harder to test in isolation since `toolLabel` is a private method on the `LessonGenerator` class. However, the generator is only invoked during lesson generation, which is tested through integration tests. The integration tests in `src/test/lessons.test.ts` should serve as this validation.
