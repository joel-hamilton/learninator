# Data Model: Wired Feedback

**Phase 1 output** | **Feature**: specs/026-wired-feedback

## No Schema Changes

This feature uses the existing `lessons` table columns as-is:

| Column | Type | Used By |
|--------|------|---------|
| `feedbackRating` | `text` — `"too_easy"` / `"just_right"` / `"too_hard"` | Written by rating click; read by `buildFeedbackSummary` |
| `feedbackText` | `text` (nullable) | Written by inline textarea submission; read by `buildFeedbackSummary` |

No migration required.

## Existing Store Methods (unchanged)

| Method | Signature | Used By |
|--------|-----------|---------|
| `updateLessonFeedback` | `(missionId, number, subNumber, rating, text?)` | Feedback POST route |
| `listLessonFeedback` | `(missionId) → LessonFeedbackSummary[]` | `buildFeedbackSummary` |

## New In-Memory Type

**Feedback Summary** — computed at generation time, not persisted:

```typescript
// Returned by buildFeedbackSummary()
type FeedbackSummary = string; // Formatted markdown string for prompt injection
```

## Entity State Transitions

### Feedback Bar States

```
lessonActionBar (active lesson)
  │
  ├─ click rating → lessonActionBar (rating selected, textarea visible)
  │     │
  │     ├─ submit text (or empty) → feedbackThanksBar (confirmation + adjustments)
  │     │     │
  │     │     ├─ click adjustment → generationPollingBar → ... → done
  │     │     └─ click Mark Complete → completedLessonBar
  │     │
  │     └─ click different rating → textarea label changes, text preserved
  │
  └─ click Mark Complete (no rating) → completedLessonBar
```

The textarea state is ephemeral (client-side). No server-side state tracks "textarea open vs closed." The server only sees the final POST with `{ rating, feedbackText }`.

## Feedback Flow Through Generation

```
feedback submitted (rating + text)
  │
  ├─ saved to DB via updateLessonFeedback (sync, immediate)
  │
  └─ generation triggered (any path)
       │
       ├─ buildFeedbackSummary(store, missionId) called
       │     └─ reads listLessonFeedback → formats markdown summary
       │
       ├─ summary injected into system prompt (all generation types)
       └─ recent feedback text injected into user message (all generation types)
```
