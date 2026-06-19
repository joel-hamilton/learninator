# Quickstart: Post-Lesson Navigation

**Feature**: 008-post-lesson-navigation
**Date**: 2026-06-18

## Prerequisites

- Running dev server: `npm run dev`
- A mission with at least one lesson (create via onboarding flow or use existing test data)

## Validation Scenarios

### 1. Active Lesson — Clean Feedback Bar

1. Open any active or in-progress lesson.
2. **Expected**: Below the lesson content, see only 3 rating buttons (Too Easy, Just Right, Too Hard) and a prominent "Mark Complete" button.
3. **Expected**: No "New Lesson", "More on This", or generation actions visible.
4. **Expected**: Rating buttons are styled as subtle feedback controls, not primary actions.

### 2. Submit "Just Right" Rating

1. On an active lesson, click "Just Right".
2. **Expected**: The bar immediately shows a "Thanks!" confirmation.
3. **Expected**: Only "Mark Complete" button remains (no adjustment options).
4. **Expected**: The rating is persisted — reload the page and the bar shows the feedback-thanks state.

### 3. Submit "Too Hard" Rating — Adjustment Options

1. On an active lesson, click "Too Hard".
2. **Expected**: Two adjustment buttons appear: "Make Easier" and "Bridge First".
3. Click "Make Easier".
4. **Expected**: Polling bar appears immediately ("Regenerating — Rewriting lesson at new difficulty…").
5. **Expected**: Bar updates every 1s with progress messages.
6. **Expected**: On completion, shows "Updated — Lesson regenerated! View Lesson XXXX: [title] →".
7. Click the link to view the regenerated lesson.
8. **Expected**: Lesson content is at an easier difficulty level, same lesson number.

### 4. Submit "Too Easy" Rating — Make Harder

1. On an active lesson, click "Too Easy".
2. **Expected**: One adjustment button appears: "Make Harder".
3. Click "Make Harder".
4. **Expected**: Same polling pattern as above, lesson content replaced with harder version.

### 5. Bridge First

1. On an active lesson, click "Too Hard", then click "Bridge First".
2. **Expected**: Polling bar appears ("Generating — Creating bridging lesson…").
3. **Expected**: On completion, shows link to a new sub-lesson (e.g., 0003.1) that covers prerequisite content.

### 6. Mark Complete — Post-Completion Navigation

1. On any lesson, click "Mark Complete".
2. **Expected**: Bar immediately changes to show:
   - "Completed" badge
   - "What's next?" heading
   - Three clear buttons: "Continue Learning", "Dive Deeper", "Explore Something New"
   - "Mark Incomplete" link
3. **Expected**: No feedback/rating buttons visible (lesson is done).

### 7. Continue Learning — Always Creates Main Lesson

1. On a completed lesson, click "Continue Learning".
2. **Expected**: Polling bar appears ("Creating your next lesson…").
3. **Expected**: On completion, link goes to a new MAIN lesson (e.g., if current is 0003, new is 0004).
4. **Expected**: The new lesson is NEVER a sub-lesson (never 0003.X).

### 8. Dive Deeper — Always Creates Sub-Lesson

1. On a completed lesson, click "Dive Deeper".
2. **Expected**: Polling bar appears ("Creating sub-lesson…").
3. **Expected**: On completion, link goes to a new SUB-lesson (e.g., if current is 0003, new is 0003.1).
4. **Expected**: The new lesson is NEVER a main lesson (never 0004).

### 9. Dive Deeper on a Sub-Lesson

1. Navigate to a sub-lesson (e.g., 0003.1), complete it, click "Dive Deeper".
2. **Expected**: Creates another sub-lesson under the same parent (e.g., 0003.2).

### 10. Explore Something New

1. On a completed lesson, click "Explore Something New".
2. **Expected**: Navigates to the browse/topic exploration flow.
3. **Expected**: Can narrow down a new topic and start a new lesson from there.

### 11. Mark Incomplete — Reversible

1. On a completed lesson, click "Mark Incomplete".
2. **Expected**: Bar reverts to the active lesson state with rating buttons.
3. **Expected**: Lesson status is back to "in_progress".

### 12. Error Handling

1. Trigger a generation failure (e.g., by causing an AI error).
2. **Expected**: Error bar appears with error message and a link back to mission lessons.
3. **Expected**: No broken state — user can recover.

### 13. Duplicate Prevention

1. Rapidly double-click "Continue Learning".
2. **Expected**: First click starts generation (polling bar appears).
3. **Expected**: Second click shows "Already generating your next lesson…" message.
4. **Expected**: Only one lesson is created.

## Automated Test Commands

```bash
# Run all tests
npm test

# Run lesson-specific tests
npx vitest run src/test/lessons.test.ts

# Watch mode for development
npm run test:watch
```
