# Route Contracts: Post-Lesson Navigation

**Feature**: 008-post-lesson-navigation
**Date**: 2026-06-18

## Changed Endpoints

### POST `/missions/:missionId/lessons/:number/complete`

**Change**: Response switches from `completedLessonBar()` to new `postCompletionBar()`.

**Request**: Empty body (no params needed)
**Response**: HTML fragment — the new post-completion bar
**Status codes**: 200 (success), 404 (mission/lesson not found)

### POST `/missions/:missionId/lessons/:number/incomplete`

**Change**: Response switches from `lessonActionBar()` to new `activeLessonBar()`.

**Request**: Empty body
**Response**: HTML fragment — the active lesson bar with rating buttons
**Status codes**: 200 (success), 404 (mission/lesson not found)

### POST `/missions/:missionId/lessons/:number/generate-next`

**Change**: System prompt now instructs AI to ALWAYS use `create_lesson` (never `create_sub_lesson`). Routes through `LessonGenerator.generateNext()` instead of inline logic.

**Request**: Optional `feedback` (string, max 2000), optional `notes` (string, max 2000)
**Response**: HTML fragment — `generationPollingBar()` (for main lesson creation)
**Status codes**: 200 (job started), 400 (input too long), 404 (not found), 429 (rate limited)

### POST `/missions/:missionId/lessons/:number/generate-sub-lesson`

**Change**: Routes through `LessonGenerator.generateSubLesson()` instead of inline logic.

**Request**: Empty body (no params)
**Response**: HTML fragment — `generationPollingBar()` (for sub-lesson creation, `isSub=true`)
**Status codes**: 200, 404, 429

## New Endpoints

### POST `/missions/:missionId/lessons/:number/regenerate`

**Request**: `direction` — `"harder"` or `"easier"`
**Response**: HTML fragment — `regenerationPollingBar()`
**Status codes**: 200 (job started), 400 (invalid direction), 404, 429

### GET `/missions/:missionId/lessons/:number/regenerate/status`

**Response**: One of `regenerationRunningBar()`, `regenerationDoneBar()`, `regenerationErrorBar()`, or `generationMissingBar()`
**Status codes**: 200

### POST `/missions/:missionId/lessons/:number/generate-bridging`

**Request**: Empty body
**Response**: HTML fragment — `bridgingPollingBar()`
**Status codes**: 200, 404, 429

### GET `/missions/:missionId/lessons/:number/generate-bridging/status`

**Response**: One of `bridgingRunningBar()`, `bridgingDoneBar()`, `bridgingErrorBar()`, or `generationMissingBar()`
**Status codes**: 200

## Unchanged Endpoints

- `GET /missions/:missionId/lessons/:number` — lesson page (no change)
- `POST /missions/:missionId/lessons/:number/feedback` — submit rating (no change to route, response may change from `feedbackThanksBar` to redesigned version)
- `GET /missions/:missionId/lessons/:number/feedback-modal` — feedback modal (no change)
- `POST /missions/:missionId/lessons/:number/chat` — lesson chat (no change)

## Removed UI Components

- `completeBar()` — already dead code (defined but never imported), will be removed
- The 6-button `lessonActionBar()` — replaced by `activeLessonBar()` (3 rating buttons + Mark Complete only)
- The "New Lesson" and "More on This" buttons from `completedLessonBar()` — replaced by "Continue Learning", "Dive Deeper", "Explore Something New"
