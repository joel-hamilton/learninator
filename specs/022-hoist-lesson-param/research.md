# Research: Hoist Duplicate parseLessonParam

## Overview

Investigation into the current state of `parseLessonParam` in the codebase to inform the refactoring plan.

## Current State

### Duplicate Definitions

**File: `src/routes/lessons.ts` (line 34-40)**
```typescript
function parseLessonParam(param: string): { number: number; subNumber: number | null } {
  const parts = param.split(".");
  return {
    number: parseInt(parts[0], 10),
    subNumber: parts.length > 1 ? parseInt(parts[1], 10) : null,
  };
}
```

**File: `src/routes/lesson-generation.ts` (line 26-32)**
```typescript
function parseLessonParam(param: string): { number: number; subNumber: number | null } {
  const parts = param.split(".");
  return {
    number: parseInt(parts[0], 10),
    subNumber: parts.length > 1 ? parseInt(parts[1], 10) : null,
  };
}
```

The two implementations are byte-for-byte identical.

### Call Sites

- `src/routes/lessons.ts`: 6 call sites (lines 48, 88, 112, 129, 151, 176)
- `src/routes/lesson-generation.ts`: 5 call sites (lines 39, 76, 119, 151, 188)

### Existing Shared Module

`src/shared/lesson-numbers.ts` already exports:
- `formatLessonNumber(num: number, sub: number | null): string` — formats a lesson number for display/storage
- `lessonIdStr(number: number, subNumber: number | null): string` — converts to string ID

This is the natural home for `parseLessonParam`.

### Test Coverage

No existing tests for `parseLessonParam`. The test file `src/test/lessons.test.ts` covers lesson routes via HTTP-level `app.request()` but does not directly test the parsing function.

### Edge Cases Identified

| Input | number | subNumber |
|-------|--------|-----------|
| `"1"` | 1 | null |
| `"1.2"` | 1 | 2 |
| `"42"` | 42 | null |
| `"42.7"` | 42 | 7 |
| `""` (empty) | NaN | null |
| `"."` (just dot) | NaN | null |
| `"1.2.3"` (multi-dot) | 1 | 2 (extra dot ignored) |
| `"abc"` (non-numeric) | NaN | null |
| `"1."` (trailing dot) | 1 | NaN |
| `".1"` (leading dot) | NaN | 1 |

## Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Hoist to `src/shared/lesson-numbers.ts` | Follows existing pattern (`formatLessonNumber`, `lessonIdStr`) | Creating a new `src/shared/parse-lesson-param.ts` file — unnecessarily granular; the existing module is the right namespace |
| Export the function with same signature | Zero behavioral change requirement | Changing the return type (e.g. throwing on invalid input) would break callers |
| Add unit tests in same test file as lessons tests | Tests belong with the feature they validate | Separate test file — unnecessary since lessons.test.ts already covers the route |
| Use `describe`/`it` blocks for edge cases | Vitest idiomatic structure | Table-driven tests via `it.each` — cleaner for the many edge cases |

## Dependencies

- `src/shared/lesson-numbers.ts` — must exist (it does)
- No new npm packages required
- No database schema changes
- No migration steps
