# Data Model: Post-Lesson Navigation

**Feature**: 008-post-lesson-navigation
**Date**: 2026-06-18

## No Schema Changes

This feature requires no database schema changes. The existing `lessons` table already supports all required operations:

| Column | Type | Used By |
|--------|------|---------|
| `number` | integer | Main lesson sequence (0001, 0002, ...) |
| `subNumber` | integer \| null | Sub-lesson index within parent (0003.1, 0003.2, ...) |
| `parentLessonId` | integer \| null | Links sub-lesson to its parent lesson |
| `status` | active \| in_progress \| completed | Drives which UI bar is shown |
| `feedbackRating` | too_easy \| just_right \| too_hard \| null | Student's difficulty rating |
| `feedbackText` | text \| null | Optional free-text feedback |
| `htmlContent` | text | Lesson body — replaced in-place by regenerate |
| `completedAt` | text \| null | Timestamp of completion |

## Entity State Transitions

### Lesson Status

```
active ──(first view)──> in_progress ──(mark complete)──> completed
                              ^                              │
                              └──(mark incomplete)────────────┘
```

### UI Bar States (derived from lesson status + feedback state)

```
[No feedback yet, status = active/in_progress]
  → lessonActionBar (3 rating buttons + Mark Complete)

[Feedback submitted, status = active/in_progress]
  → feedbackThanksBar (confirmation + adjustment buttons if needed + Mark Complete)

[Status = completed]
  → completedLessonBar (What's next? heading + Continue Learning / Dive Deeper / Explore Something New + Mark Incomplete)
```

### Generation Job Lifecycle

```
[User clicks generation action]
  → Job created (status: "running")
  → Polling bar shown (1s interval)
  → AI conversation loop executes
  → Job completes (status: "done") or fails (status: "error")
  → Result bar shown (link to new lesson or error with retry)
  → Job auto-deleted after 60s
```

## Key Relationships

- **Lesson → Feedback**: Each lesson has at most one feedback record (stored inline in the lesson row via `feedbackRating` and `feedbackText`). The AI reads all feedback via `list_feedback_history` to calibrate difficulty.
- **Lesson → Sub-lessons**: A main lesson can have multiple sub-lessons (0003.1, 0003.2, ...). Sub-lessons link to their parent via `parentLessonId`. Sub-lessons can themselves have sub-lessons (nested deep-dives).
- **Generation Job → Lesson**: A generation job is ephemeral (in-memory Map). On completion, it stores a reference to the newly created lesson (or regenerated lesson) in its result. The job is keyed by `{type}-{missionId}-{number}-{subNumber}`.

## Validation Rules

- Difficulty ratings must be one of: `too_easy`, `just_right`, `too_hard`
- Feedback text max 2000 characters
- Chat messages max 10000 characters
- Generation jobs are rate-limited: 10 per 60s per user (existing `lesson_gen` rate limit key)
- Duplicate generation jobs for the same key are rejected (server-side dedup)
