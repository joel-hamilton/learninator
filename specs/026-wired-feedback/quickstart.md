# Quickstart: Wired Feedback

**Phase 1 output** | **Feature**: specs/026-wired-feedback

## Prerequisites

- Local dev environment running (`npm run dev`)
- A mission with at least one completed lesson
- or: seed a test mission with lessons

## Validation Scenarios

### 1. Inline textarea appears after rating click

1. Navigate to an active lesson (e.g., `/missions/1/lessons/1`)
2. Click "Too hard" in the feedback bar
3. **Expected**: The feedback row shows a textarea labeled "What made it too hard?" The "Too hard" button is highlighted. Action buttons remain visible below the divider.
4. Click "Just right"
5. **Expected**: The label changes to "What worked well?" Typed text is preserved.

### 2. Submit text feedback

1. Click "Too hard", type "The recursion examples went over my head"
2. Press Enter
3. **Expected**: Bar swaps to confirmation showing "Thanks! You rated this Too Hard." with a preview of the feedback text. "Make Easier" and "Bridge First" buttons appear.
4. Click "Make Easier"
5. **Expected**: Polling bar appears. Generation includes the feedback text in the prompt.

### 3. Submit with no text

1. Click "Just right" on a lesson
2. Press Enter without typing
3. **Expected**: Confirmation appears: "Thanks! You rated this Just Right." No adjustment buttons. Action buttons visible.

### 4. Feedback history injected into generation

1. Rate at least 2 lessons as "too hard" with text feedback
2. Click "New Lesson" on the latest lesson
3. **Expected**: The next lesson is measurably adjusted — simpler language, more scaffolding. Verify by inspecting the generated lesson content.

### 5. Adjustment buttons carry feedback forward

1. Rate a lesson "too hard" and type "Too much math notation, need visual examples"
2. Click "Make Easier"
3. **Expected**: The regenerated lesson addresses the specific complaint (uses fewer equations, adds visual diagrams)

### 6. Post-completion actions carry feedback

1. Rate a lesson "too hard" and type feedback
2. Click "Mark Complete"
3. In the completed bar, click "Continue Learning"
4. **Expected**: The generated lesson reflects the feedback from step 1

### 7. Existing flows still work (regression)

1. Click "New Lesson" on any active lesson (opens feedback modal)
2. Fill in the modal, submit
3. **Expected**: Modal flow works as before — generation polling bar appears, lesson is created
4. Run `npm test`
5. **Expected**: All 323+ tests pass

## Test Commands

```bash
# Run full test suite
npm test

# Run lesson-specific tests
npx vitest run src/test/lessons.test.ts

# Run generator tests (if they exist)
npx vitest run --grep "generator"
```
