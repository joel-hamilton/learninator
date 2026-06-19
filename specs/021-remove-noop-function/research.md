# Research: Remove No-Op Function

## Unknowns Resolution

All areas were already clarified by the feature spec. No NEEDS CLARIFICATION items arose during technical context evaluation.

## Confirmations

### Function is a pure no-op

- **Function signature**: `function hideBannerOnSettle(): string { return ""; }`
- **Return value**: Always `""` under all code paths (single-line, hardcoded `return ""`)
- **No side effects**: No DOM access, no state mutation, no console output, no exceptions

### Call site inventory

Confirmed 6 call sites, all within `src/views/fragments.ts`, all of the form `` `${hideBannerOnSettle()}` `` inside template literals:

1. Line 132 — within a template string
2. Line 138 — within a template string
3. Line 183 — within a template string
4. Line 189 — within a template string
5. Line 230 — within a template string
6. Line 236 — within a template string

At every call site, removing the interpolation expression produces identical concatenated output because the expression evaluates to an empty string.

### No other references

`grep -r hideBannerOnSettle` across the entire `src/` directory returns matches only within `src/views/fragments.ts`. No other files define, import, or call this function.

### Verification strategy

| Check | Method |
|-------|--------|
| Definition removed | `grep -r hideBannerOnSettle src/` returns zero results |
| All call sites removed | Visual inspection of lines 132, 138, 183, 189, 230, 236 |
| Tests pass | `npm test` exits with code 0 |

## Decision

Proceed with mechanical removal. No design work required — this is purely a find-and-delete operation.

- **Decision**: Remove function definition and all 6 call sites
- **Rationale**: Dead code scaffolding increases cognitive load and suggests nonexistent functionality
- **Alternatives considered**: Leaving the function in place (rejected — violates YAGNI, see Constitution Principle "No speculative features")
