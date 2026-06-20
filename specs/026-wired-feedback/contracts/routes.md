# Route Contracts: Wired Feedback

**Phase 1 output** | **Feature**: specs/026-wired-feedback

All routes are under `/missions/:missionId/lessons/:number`.

## Modified Routes

### POST `/:number/feedback`

Accepts `feedbackText` alongside the existing `rating`.

**Request** (form-encoded):
```
rating=too_hard&feedbackText=The recursion examples went over my head
```

**Response**: `feedbackThanksBar` HTML fragment with:
- Confirmation showing rating + truncated feedback text preview
- Adjustment buttons (if applicable: "Make Harder", "Make Easier", "Bridge First")
- Action buttons ("Mark Complete", "New Lesson", "More Like This") with hints

**Validation**: `feedbackText` max 2,000 characters (existing `MAX_FEEDBACK_TEXT` limit). Returns 400 if exceeded.

**Store call**: `updateLessonFeedback(missionId, number, subNumber, rating, feedbackText || undefined)`

### POST `/:number/regenerate`

Accepts optional `feedbackText` parameter.

**Request** (form-encoded):
```
direction=easier&feedbackText=The diagrams didn%27t make sense
```

**Forwarded to generator**: `opts.feedback = feedbackText`

**Response**: `regenerationPollingBar` HTML fragment (unchanged).

### POST `/:number/generate-bridging`

Accepts optional `feedbackText` parameter.

**Request** (form-encoded):
```
feedbackText=I need more background on the basics first
```

**Forwarded to generator**: `opts.feedback = feedbackText`

**Response**: `bridgingPollingBar` HTML fragment (unchanged).

## Unchanged Routes

| Route | Notes |
|-------|-------|
| GET `/:number` | Lesson page — already renders `lessonActionBar` with updated two-zone layout |
| POST `/:number/complete` | Already fixed (CSRF bug) |
| POST `/:number/incomplete` | Returns `lessonActionBar` — unchanged |
| POST `/:number/generate-next` | Already accepts `feedback` — unchanged |
| POST `/:number/generate-sub-lesson` | Unchanged (triggers generation, `buildFeedbackSummary` injects history) |
| GET `/:number/generate-next/status` | Polling — unchanged |
| GET `/:number/generate-sub-lesson/status` | Polling — unchanged |
| GET `/:number/regenerate/status` | Polling — unchanged |
| GET `/:number/generate-bridging/status` | Polling — unchanged |
| GET `/:number/feedback-modal` | Existing feedback modal — unchanged |
| POST `/:number/chat` | Lesson chat — unchanged |
