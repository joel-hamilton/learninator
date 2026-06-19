# Research: Deduplicate Guided-Question JavaScript

## Scope

Pure JavaScript/rendering refactor in `src/views/shared.ts`. No new dependencies, no data model changes, no AI client changes.

## Decisions

### Decision: How to eliminate the duplication

**Decision**: Refactor `GUIDED_QUESTION_SCRIPT` to export raw JS (no `<script>` wrapper) and create a wrapper function in `onboarding.ts`. The inline script in shared.ts will interpolate the raw JS constant directly.

**Rationale**: The `GUIDED_QUESTION_SCRIPT` constant contains `<script>` tags because it's rendered via `onboarding.ts` in an HTML context. However, the `pageHead()` template literal is already inside a `<script>` tag, so interpolating `GUIDED_QUESTION_SCRIPT` as-is would produce nested `<script>` tags. The cleanest approach is to separate the script wrapper concern from the JS body.

**Alternatives considered**:
1. **String manipulation at interpolation site**: Use `.replace('<script>', '').replace('</script>', '')` when interpolating in the inline script. Rejected because it's fragile (depends on exact tag format) and hides the intent.
2. **Extract a separate `GUIDED_QUESTION_JS` constant and keep `GUIDED_QUESTION_SCRIPT` unchanged**: More explicit about the separate concerns but adds an additional named export.
3. **Refactor GUIDED_QUESTION_SCRIPT to be script-tag-free and update all callers**: The chosen approach. Keeps the single source of truth as pure JS, and the presentation concern (wrapping in `<script>` tags) is handled by each rendering context.

## Findings

- The inline guided-question functions (lines ~635-676) are byte-for-byte identical to the functions inside `GUIDED_QUESTION_SCRIPT` (lines ~731-773).
- The `addFollowupMessage()` and `cleanupThinking()` functions (lines ~677-693) exist only in the inline script and are NOT part of `GUIDED_QUESTION_SCRIPT`. They must remain in the inline script after refactoring.
- No other files or functions reference the inline guided-question functions directly -- they are only called via onclick/onsubmit attributes in the guided question HTML.
- `GUIDED_QUESTION_SCRIPT` is imported by `onboarding.ts` (line 1) and used at line 184 in the onboarding page template.
