# Quickstart Validation Guide: Tool Store Type Narrowing

## Prerequisites

- Node.js 22+
- Dependencies installed (`npm install`)
- No prior code changes needed — start from `main` branch

## Validation Steps

### 1. Verify TypeScript compilation

```bash
npx tsc --noEmit
```

**Expected**: Zero errors. All handler signatures accept the concrete `ToolStore` via structural typing.

### 2. Run existing test suite

```bash
npm test
```

**Expected**: All tests pass. No test modifications were made — this confirms zero runtime impact.

### 3. Verify handler signatures (manual code review)

Check that each handler in `src/ai/tools.ts` has a narrowed store parameter type:

| Handler | Expected Store Type | Key Method(s) |
|---|---|---|
| `readMissionContent` | `ContentStore` | `getMissionContent` |
| `writeMissionContent` | `ContentStore` | `upsertMissionContent` |
| `readResources` | `ContentStore` | delegates to `readMissionContent` |
| `writeResources` | `ContentStore` | delegates to `writeMissionContent` |
| `createLesson` | `LessonStore` | `getMainLessonCount`, `createLesson` |
| `createSubLesson` | `LessonStore` | `getLesson`, `getSubLessonCount`, `createLesson` |
| `readLesson` | `LessonStore` | `getLesson` |
| `listLessons` | `LessonStore` | `listLessons` |
| `listFeedbackHistory` | `LessonStore` | `listLessonFeedback` |
| `regenerateLesson` | `LessonStore` | `getLesson`, `updateLessonContent` |
| `createReferenceDoc` | `RefDocStore` | `createReferenceDoc` |
| `listReferenceDocs` | `RefDocStore` | `listReferenceDocs` |
| `createLearningRecord` | `LearningRecordStore` | `getLearningRecordCount`, `createLearningRecord` |
| `listLearningRecords` | `LearningRecordStore` | `listLearningRecords` |
| `updateLearningRecord` | `LearningRecordStore` | `listLearningRecords`, `updateLearningRecord` |
| `markMissionActive` | `MissionStore` | `updateMissionStatus` |
| `askGuidedQuestion` | `ChatStore` | `createGuidedQuestion` |

### 4. Verify `buildHandlerMap()` adaptation

Check that `src/ai/tools.ts`'s `buildHandlerMap()` function uses a minimal type assertion (e.g., `as ToolHandler`) for each handler, and that no runtime wrappers or adapters were introduced.

### 5. Verify zero new runtime code

```bash
git diff main -- src/ | grep -E '^(diff|---|\+\+\+|@@)' | head -20
# or
git diff --stat main
```

**Expected**: Only `.ts` files changed (no `.js`, no new files). Only type annotations changed (no new runtime statements).

## Contract

This feature introduces no new external interfaces. The `ToolExecutor` interface in `src/ai/types.ts` is unchanged. All AI tool interactions continue to work identically.
