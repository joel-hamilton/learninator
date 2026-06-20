# Data Model: Lesson QA Review

**Feature**: 027-lesson-qa-review
**Date**: 2026-06-20

## Summary

No new database tables or columns are introduced. The review step is a runtime pass that reads and updates existing `lessons` rows. Review metadata is ephemeral — logged during the job but not persisted.

## Existing Entities (Reused)

### `lessons`

The review step reads and potentially updates one column:

| Column | Type | Usage |
|--------|------|-------|
| `html_content` | `text` | Read by reviewer for inspection. Written back if corrections are made. |

**Update path**: `LessonStore.updateLessonContent(missionId, number, subNumber, title, slug, htmlContent)` — this is an existing method already used by `regenerate_lesson`. The review step calls it with the reviewer's corrected HTML (only when content actually changed).

**No other columns are read or written by the review step.**

## In-Memory Structures (Ephemeral)

### Review Metadata (logged, not stored)

During the `startGeneration` method in `LessonGenerator`, the review step produces:

```
reviewOutcome: "corrected" | "passed" | "failed"
```

- `"corrected"`: Reviewer returned modified HTML — logged at info level
- `"passed"`: Reviewer returned unchanged HTML — logged at debug level
- `"failed"`: Reviewer errored, timed out, or returned empty — logged at warn level

This metadata lives only in the job's local scope and in log output (FR-008). No database persistence.

## Job Messages

The review step adds one entry to the job's `messages` array:

```
"Reviewing lesson…"
```

This message is pushed before the `ai.chat()` call and is visible to the frontend via `getJobStatus()` polling. After review completes (success or failure), the next job message or terminal state replaces it.

## State Transitions

```
┌─────────────┐     conversationLoop      ┌──────────────┐
│  Job:        │ ─────────────────────────▶│  Lesson       │
│  "running"   │                           │  saved via    │
│  "Starting…"│                           │  create_lesson │
└─────────────┘                           └──────┬───────┘
                                                  │
                                    findResult()  │
                                                  ▼
                                         ┌──────────────┐
                                         │  Lesson found │
                                         │  in DB        │
                                         └──────┬───────┘
                                                │
                              "Reviewing lesson…"│
                              push to job msgs   │
                                                ▼
                                         ┌──────────────┐
                                         │  ai.chat()    │
                                         │  (reviewer)   │
                                         └──┬───────┬───┘
                                            │       │
                                   success  │       │  failure/timeout
                                            ▼       ▼
                                   ┌──────────┐ ┌──────────────┐
                                   │ Corrected│ │ Original      │
                                   │ content? │ │ delivered     │
                                   └──┬───┬───┘ │ (fallback)    │
                                      │   │     └──────────────┘
                              changed │   │ unchanged
                                      ▼   ▼
                              ┌────────┐ ┌────────┐
                              │ Update │ │ Keep   │
                              │ lesson │ │ as-is  │
                              └───┬────┘ └───┬────┘
                                  │          │
                                  ▼          ▼
                              ┌──────────────────┐
                              │ Job: "done"      │
                              │ result: lesson   │
                              └──────────────────┘
```
