# Quickstart: Parameterize Generation Progress Bars

**Date**: 2026-06-19

## Prerequisites

- Node.js 22+
- `npm install` completed
- Project builds and tests pass before starting (`npm test`)

## Validation Steps

### 1. TypeScript Compilation

Ensure the refactored code compiles without errors:

```bash
npx tsc --noEmit
```

Expected: exit code 0, no type errors.

### 2. Existing Tests Pass

Run the full test suite:

```bash
npm test
```

Expected: all tests pass. Since this is a pure refactoring with no behavior change, no tests should need modification.

### 3. HTML Output Verification (Manual)

Start the dev server:

```bash
npm run dev
```

Then verify each generation flow in the browser:

1. **Generate next lesson**: Complete a lesson, click "Continue Learning" — verify the polling bar shows "Generating" badge with "Creating your next lesson..."
2. **Generate sub-lesson**: Click "Dive Deeper" — verify the polling bar shows "Generating" badge with "Creating sub-lesson..."
3. **Regenerate lesson**: Rate a lesson "Too Easy" or "Too Hard", click "Make Harder"/"Make Easier" — verify the polling bar shows "Regenerating" badge
4. **Bridging lesson**: Rate a lesson "Too Hard", click "Bridge First" — verify the polling bar shows "Generating" badge with "Creating bridging lesson..."
5. **Error state**: Simulate a failure (e.g., stop the AI service) — verify error bar renders with correct error prefix text
6. **Done state**: Wait for generation to complete — verify done bar shows correct badge text ("Ready" or "Updated") and correct link color

### 4. Import Verification

Confirm that `src/routes/lesson-generation.ts` compiles without import changes:

```bash
grep -c "from.*fragments" src/routes/lesson-generation.ts
```

Expected: all existing named imports still resolve correctly.

## Files Changed

- `src/views/fragments.ts` — only file modified

## Files NOT Changed

- `src/routes/lesson-generation.ts` — imports and call sites unchanged
- Any test files
- Any CSS files
- Any other files in the project
