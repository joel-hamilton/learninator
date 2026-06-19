# Quickstart: Extract View-Model Functions

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- Existing tests pass: `npm test`

## Validation Approach

This is a pure refactoring with no user-facing changes. Validation is two-pronged:

### 1. Unit tests for extracted functions

```bash
npx vitest run src/test/view-models/
```

Expected: All view-model unit tests pass, covering:
- `lessonGrouping()` with empty, single, parent-sub, and multiple sub-lesson inputs
- `renderChatMessages()` with empty, single, multi-role, and empty-content inputs
- `computeLessonNavigation()` with first, middle, last, and single-item lesson lists

### 2. Existing integration tests (regression guard)

```bash
npm test
```

Expected: All existing tests pass without modification. This proves rendered output is unchanged.

### 3. Manual smoke test (optional)

```bash
npm run dev
```

- Navigate to a mission with lessons → verify lesson cards show sub-lesson grouping correctly
- Navigate to a mission chat → verify messages render correctly
- Navigate between lessons → verify prev/next navigation works
