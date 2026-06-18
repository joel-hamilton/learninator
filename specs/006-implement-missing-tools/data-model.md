# Data Model: Implement Missing AI Tools

## Lesson Feedback Summary

A lesson feedback summary extends the existing `LessonSummary` type with feedback fields.

```typescript
// Existing type (in store.ts):
type LessonSummary = Pick<LessonRow, "number" | "subNumber" | "title" | "status">;

// New type:
type LessonFeedbackSummary = Pick<LessonRow, "number" | "subNumber" | "title" | "status" | "feedbackRating" | "feedbackText">;
```

### Fields

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| number | number | lessons.number | Lesson number (e.g., 1 for "0001") |
| subNumber | number \| null | lessons.sub_number | Sub-lesson number or null for main lessons |
| title | string | lessons.title | Lesson title |
| status | string | lessons.status | Lesson status (active, in_progress, completed) |
| feedbackRating | string \| null | lessons.feedback_rating | too_easy, just_right, too_hard, or null |
| feedbackText | string \| null | lessons.feedback_text | Free-text feedback or null |

## Update Lesson Content

No new data — uses existing `LessonRow` fields. The `updateLessonContent` method updates:
- `title` — string
- `slug` — string  
- `htmlContent` — string

The lesson is identified by `(missionId, number, subNumber)` composite key.
