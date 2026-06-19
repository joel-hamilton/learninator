# Data Model: Parameterize Generation Progress Bars

**Date**: 2026-06-19

## Overview

This feature introduces three TypeScript types used to parameterize the generation progress bar rendering. These are in-memory types only — no database entities, no storage.

## Types

### LessonInfo

Represents the identity and title of a lesson for rendering in progress bars.

```typescript
type LessonInfo = {
  number: number;           // Lesson number (e.g., 1, 2, 3)
  subNumber: number | null; // Sub-lesson number or null for main lessons
  title: string;            // Lesson title for display in done bar links
};
```

### JobStatus

Union type representing the lifecycle states of an async generation job.

```typescript
type JobStatus = "polling" | "running" | "done" | "error" | "missing";
```

| Status | Meaning |
|--------|---------|
| `polling` | Job has been submitted but no progress yet — shows "Starting…" |
| `running` | Job is in progress — shows latest progress message |
| `done` | Job completed successfully — shows link to the new lesson |
| `error` | Job failed — shows error message |
| `missing` | No job found (only applicable to "next" generation types) |

### GenStyle

Configuration object that captures all per-generation-type differences.

```typescript
interface GenStyle {
  /** Badge text shown in polling/running bars (e.g., "Generating", "Regenerating") */
  badgeText: string;

  /** Header text shown in polling/running bars (e.g., "Creating your next lesson...") */
  headerText: string;

  /** URL path suffix for polling status endpoint (e.g., "generate-next", "regenerate") */
  statusSuffix: string;

  /** CSS color variable for the done-bar link (e.g., "var(--rubric)", "var(--accent)") */
  linkColor: string;

  /** Badge text for the done state (e.g., "Ready", "Updated") */
  doneBadgeText: string;

  /** Prefix for the done-bar link text (e.g., "Start Lesson", "View Lesson") */
  doneLinkPrefix: string;

  /** Prefix for error messages (e.g., "Failed to generate next lesson: ") */
  errorPrefix: string;

  /** Whether polling/running bars accept an isSub parameter */
  supportsSub: boolean;

  /** Whether the missing state is supported (only "next" type) */
  hasMissingBar: boolean;
}
```

## Config Instances

Three singleton config instances are defined, one per generation type:

| Field | `nextStyle` | `regenStyle` | `bridgeStyle` |
|-------|-------------|--------------|---------------|
| badgeText | `"Generating"` | `"Regenerating"` | `"Generating"` |
| headerText | `"Creating your next lesson…"` | `"Rewriting lesson at new difficulty…"` | `"Creating bridging lesson…"` |
| statusSuffix | `"generate-next"` | `"regenerate"` | `"generate-bridging"` |
| linkColor | `"var(--rubric)"` | `"var(--accent)"` | `"var(--accent)"` |
| doneBadgeText | `"Ready"` | `"Updated"` | `"Ready"` |
| doneLinkPrefix | `"Start Lesson"` | `"View Lesson"` | `"Start Lesson"` |
| errorPrefix | `"Failed to generate next lesson: "` | `"Failed to regenerate lesson: "` | `"Failed to create bridging lesson: "` |
| supportsSub | `true` | `false` | `false` |
| hasMissingBar | `true` | `false` | `false` |

## Parameterized Function

```typescript
function generationProgressBar(
  style: GenStyle,
  status: JobStatus,
  missionId: number,
  lesson: LessonInfo,
  opts?: { isSub?: boolean; latestMsg?: string }
): string
```

## Convenience Wrappers

Three convenience wrappers preserve the existing public API:

```typescript
function generateNextBar(status: JobStatus, missionId: number, lesson: LessonInfo, isSub?: boolean, latestMsg?: string): string
function regenerateBar(status: JobStatus, missionId: number, lesson: LessonInfo, latestMsg?: string): string
function bridgingBar(status: JobStatus, missionId: number, lesson: LessonInfo, latestMsg?: string): string
```

## State Transition Mapping

Each wrapper dispatches to the internal `generationProgressBar`:

```
generateNextBar(status, ...)  → generationProgressBar(nextStyle, status, ...)
regenerateBar(status, ...)    → generationProgressBar(regenStyle, status, ...)
bridgingBar(status, ...)      → generationProgressBar(bridgeStyle, status, ...)
```
