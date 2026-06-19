# Quickstart: Remove No-Op Function

## Prerequisites

- Node.js 22, `npm install` completed
- Working directory: repo root

## Validation Scenarios

### Scenario 1: Dead function and call sites removed

```bash
# Confirm no trace of the function remains
grep -r hideBannerOnSettle src/
```

**Expected**: Zero results (exit code 1 from grep, no output).

---

### Scenario 2: All 6 affected template strings are clean

```bash
# Inspect the affected region of the source file
sed -n '130,240p' src/views/fragments.ts | grep -n 'hideBannerOnSettle'
```

**Expected**: Zero results. No `${hideBannerOnSettle()}` interpolation expressions remain.

---

### Scenario 3: Full test suite passes

```bash
npm test
```

**Expected**: All tests pass with zero failures (exit code 0).

---

### Scenario 4: Rendered HTML is identical (regression check)

Compare pre- and post-change rendering by running the existing test suite, which exercises all view functions through `app.request()`.

```bash
npm test
```

**Expected**: No test changes needed — tests pass because HTML output is byte-identical. No view function's rendered output changes.
