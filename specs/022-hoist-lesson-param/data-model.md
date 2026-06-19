# Data Model: parseLessonParam

## Overview

This feature introduces no new data entities, tables, or persistent state. The hoisted function is a pure transformation — string in, plain object out. This document defines its contract.

## Function Contract

### `parseLessonParam(param: string): ParseResult`

**Source location**: `src/shared/lesson-numbers.ts`

```typescript
function parseLessonParam(param: string): { number: number; subNumber: number | null }
```

### Input

| Field | Type | Description |
|-------|------|-------------|
| `param` | `string` | A lesson number from the URL route parameter. Examples: `"1"`, `"1.2"`, `"42.7"` |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `number` | `number` | The primary lesson number. May be `NaN` for unparseable input. |
| `subNumber` | `number \| null` | The optional sub-lesson number. `null` when only a single segment is present. May be `NaN` for malformed sub-segments. |

### Behavior

1. Split `param` on `"."` (period) — maximum 2 significant segments.
2. Parse the first segment as an integer via `parseInt(parts[0], 10)`.
3. If a second segment exists, parse it as an integer; otherwise set `subNumber` to `null`.
4. Return `{ number, subNumber }`.

### Edge Case Matrix

| Input | `number` | `subNumber` | Notes |
|-------|----------|-------------|-------|
| `"1"` | `1` | `null` | Single segment, no dot |
| `"1.2"` | `1` | `2` | Standard sub-lesson |
| `"42"` | `42` | `null` | Double digits |
| `"42.7"` | `42` | `7` | Double-digit with sub |
| `""` | `NaN` | `null` | Empty string, `parts = [""]` |
| `"."` | `NaN` | `null` | `parts = ["", ""]`, `parseInt("")` = `NaN` |
| `"1.2.3"` | `1` | `2` | Extra segments ignored |
| `"abc"` | `NaN` | `null` | Non-numeric, `parseInt("abc")` = `NaN` |
| `"1."` | `1` | `NaN` | `parts = ["1", ""]`, sub-number is `NaN` |
| `".1"` | `NaN` | `1` | `parts = ["", "1"]`, number is `NaN` |

### Error Handling

The function does **not** throw. Malformed inputs produce `NaN` values rather than exceptions. Callers are responsible for checking validity if needed (e.g., `isNaN(result.number)`).

## No New Data Entities

No tables, no ORM models, no database migrations. This is a pure utility function refactoring.
