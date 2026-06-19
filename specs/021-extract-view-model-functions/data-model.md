# Data Model: Extract View-Model Functions

## Overview

No new entities or database tables. The extracted functions operate on existing types from the store layer. This document defines the function signatures and any new derived types.

## Existing Types

### LessonSummary (from store)
```typescript
interface LessonSummary {
  number: number;
  subNumber: number | null;
  title: string;
  status: string;
  // ...other fields
}
```

### EnrichedLessonSummary (new derived type)
```typescript
interface EnrichedLessonSummary {
  lesson: LessonSummary;
  hasSubLessons: boolean;
  isLastSub: boolean;
}
```

### ChatMessageRow (from store)
```typescript
interface ChatMessageRow {
  role: "user" | "assistant";
  content: unknown;  // structured content block
  // ...other fields
}
```

## Function Signatures

### lessonGrouping
```typescript
function lessonGrouping(rows: LessonSummary[]): EnrichedLessonSummary[]
```

Pure function. Accepts flat lesson summaries, returns enriched data with `hasSubLessons` and `isLastSub` flags computed from parent-sub relationships.

**Logic**:
- For each row where `subNumber !== null`, record parent number and track max subNumber per parent
- For each row with `subNumber !== null` that matches the max subNumber for its parent, mark as `isLastSub: true`
- For each row where `subNumber === null` that is a parent of any sub-lessons, mark as `hasSubLessons: true`

### renderChatMessages
```typescript
function renderChatMessages(rows: ChatMessageRow[]): string
```

Pure function. Accepts chat message rows, returns rendered HTML string of message bubbles.

**Logic**:
- If array is empty, return a single default assistant greeting bubble
- For each row: skip rows where `contentToText(row.content)` is empty/whitespace
- Render user rows with `chatMessageBubble("user", formatMarkdown(text))`
- Render assistant rows with `chatMessageBubble("assistant", formatMarkdown(text))`

### computeLessonNavigation
```typescript
interface LessonNavResult {
  prev: LessonSummary | undefined;
  next: LessonSummary | undefined;
}

function computeLessonNavigation(
  allLessons: LessonSummary[],
  currentNumber: number,
  currentSubNumber: number | null
): LessonNavResult
```

Pure function. Accepts all lesson summaries and the current lesson coordinates, returns prev and next lesson references.

**Logic**:
- Find index of current lesson in allLessons using number/subNumber match
- `prev` = element at `index - 1` or undefined if first
- `next` = element at `index + 1` or undefined if last

## State Transitions

None. These are stateless pure functions.
