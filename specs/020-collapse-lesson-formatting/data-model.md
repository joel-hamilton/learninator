# Data Model: Collapse Duplicate Lesson Formatting

## Overview

No new domain entities. This feature involves two pure (deterministic) functions that transform numeric lesson identifiers into display and ID strings.

## Function Contracts

### `formatLessonNumber(num: number, sub: number | null): string`

**Purpose**: Produce a zero-padded display string for a lesson number.

**Logic**:
1. Convert `num` to string, zero-pad left to 4 characters using `String(num).padStart(4, "0")`
2. If `sub` is not null, append `".${sub}"`
3. Return the result

**Examples**:
| Input | Output |
|-------|--------|
| `(1, null)` | `"0001"` |
| `(12, null)` | `"0012"` |
| `(1, 3)` | `"0001.3"` |
| `(99, 0)` | `"0099.0"` |
| `(12345, null)` | `"12345"` (no truncation -- padStart only pads up to target length) |

### `lessonIdStr(number: number, subNumber: number | null): string`

**Purpose**: Produce an un-padded identifier string for a lesson number (used in URLs and references).

**Logic**:
1. Convert `number` to string (no padding)
2. If `subNumber` is not null, append `".${subNumber}"`
3. Return the result

**Examples**:
| Input | Output |
|-------|--------|
| `(1, null)` | `"1"` |
| `(12, null)` | `"12"` |
| `(1, 3)` | `"1.3"` |
| `(99, 0)` | `"99.0"` |

## Validation & Edge Cases (from spec)

These are the required test inputs per FR-005:

| Input | formatLessonNumber Expected | lessonIdStr Expected |
|-------|---------------------------|---------------------|
| Single-digit number, null sub: `(1, null)` | `"0001"` | `"1"` |
| Single-digit number, with sub: `(1, 3)` | `"0001.3"` | `"1.3"` |
| Double-digit number, null sub: `(12, null)` | `"0012"` | `"12"` |
| Double-digit number, with sub: `(12, 3)` | `"0012.3"` | `"12.3"` |
| Number with sub-lesson of 0: `(1, 0)` | `"0001.0"` | `"1.0"` |

## State Transitions

None. Both functions are read-only transformations with no side effects and no state.
