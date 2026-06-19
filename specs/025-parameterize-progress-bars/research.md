# Research: Parameterize Generation Progress Bars

**Date**: 2026-06-19

## Scope

This feature requires no external research. All 13 functions are fully visible in a single file (`src/views/fragments.ts`) and their differences are purely textual. The analysis below consolidates the structural differences across all functions.

## Current Function Inventory

| # | Function | Category | State | isSub param? |
|---|----------|----------|-------|--------------|
| 1 | `generationPollingBar` | next | polling | Yes |
| 2 | `generationRunningBar` | next | running | Yes |
| 3 | `generationDoneBar` | next | done | No |
| 4 | `generationErrorBar` | next | error | No |
| 5 | `generationMissingBar` | next | missing | No |
| 6 | `regenerationPollingBar` | regen | polling | No |
| 7 | `regenerationRunningBar` | regen | running | No |
| 8 | `regenerationDoneBar` | regen | done | No |
| 9 | `regenerationErrorBar` | regen | error | No |
| 10 | `bridgingPollingBar` | bridge | polling | No |
| 11 | `bridgingRunningBar` | bridge | running | No |
| 12 | `bridgingDoneBar` | bridge | done | No |
| 13 | `bridgingErrorBar` | bridge | error | No |

## Differences Across Categories

### Polling State (functions 1, 6, 10)
- Badge text: `"Generating"` (next, bridge) vs `"Regenerating"` (regen)
- Header text for "next" depends on `isSub`: `"Creating your next lesson..."` / `"Creating sub-lesson..."` (next only, others are static)
- Status polling URL suffix: `"generate-next"` (next/sub) vs `"regenerate"` (regen) vs `"generate-bridging"` (bridge)

### Running State (functions 2, 7, 11)
- Same badge and header as polling state
- Accepts `latestMsg` for the progress detail line

### Done State (functions 3, 8, 12)
- Badge text: `"Ready"` (next, bridge) vs `"Updated"` (regen)
- Link color: `var(--rubric)` (next) vs `var(--accent)` (regen, bridge)
- Link prefix: `"Start Lesson"` (next, bridge) vs `"View Lesson"` (regen)

### Error State (functions 4, 9, 13)
- Error prefix: `"Failed to generate next lesson: "` (next) vs `"Failed to regenerate lesson: "` (regen) vs `"Failed to create bridging lesson: "` (bridge)

### Missing State (function 5)
- Only exists for "next" category
- All other categories fall through to error or are handled differently in `renderJobStatus`

## Parameterization Design

### GenStyle Config Shape

```typescript
interface GenStyle {
  badgeText: string;
  headerText: string;
  statusSuffix: string;
  linkColor: string;
  doneBadgeText: string;
  doneLinkPrefix: string;
  errorPrefix: string;
  supportsSub: boolean;
  hasMissingBar: boolean;
}
```

### JobStatus Type

```typescript
type JobStatus = "polling" | "running" | "done" | "error" | "missing";
```

### LessonInfo Type

```typescript
type LessonInfo = {
  number: number;
  subNumber: number | null;
  title: string;
};
```

### Parameterized Function Signature

```typescript
function generationProgressBar(
  style: GenStyle,
  status: JobStatus,
  missionId: number,
  lesson: LessonInfo,
  opts?: { isSub?: boolean; latestMsg?: string }
): string
```

### Config Instances

```typescript
const nextStyle: GenStyle = {
  badgeText: "Generating",
  headerText: "Creating your next lesson…",
  statusSuffix: "generate-next",
  linkColor: "var(--rubric)",
  doneBadgeText: "Ready",
  doneLinkPrefix: "Start Lesson",
  errorPrefix: "Failed to generate next lesson: ",
  supportsSub: true,
  hasMissingBar: true,
};

const regenStyle: GenStyle = {
  badgeText: "Regenerating",
  headerText: "Rewriting lesson at new difficulty…",
  statusSuffix: "regenerate",
  linkColor: "var(--accent)",
  doneBadgeText: "Updated",
  doneLinkPrefix: "View Lesson",
  errorPrefix: "Failed to regenerate lesson: ",
  supportsSub: false,
  hasMissingBar: false,
};

const bridgeStyle: GenStyle = {
  badgeText: "Generating",
  headerText: "Creating bridging lesson…",
  statusSuffix: "generate-bridging",
  linkColor: "var(--accent)",
  doneBadgeText: "Ready",
  doneLinkPrefix: "Start Lesson",
  errorPrefix: "Failed to create bridging lesson: ",
  supportsSub: false,
  hasMissingBar: false,
};
```

### Convenience Wrappers

The 13 current exports will be replaced by 3 wrappers that delegate to `generationProgressBar` with the correct config:

```typescript
export function generateNextBar(status, missionId, number, subNumber, isSub, ...)
export function regenerateBar(status, missionId, number, subNumber, ...)
export function bridgingBar(status, missionId, number, subNumber, ...)
```

## Recommended Approach

1. Define the `GenStyle` interface, `JobStatus` type, and `LessonInfo` type at the top of the generation bars section in `fragments.ts`
2. Define the three config objects (`nextStyle`, `regenStyle`, `bridgeStyle`)
3. Write the single parameterized `generationProgressBar()` function
4. Write 3 convenience wrappers that match the existing 13 exported function signatures
5. The wrappers should return the result of `generationProgressBar()` with the right config
6. Delete the 13 individual functions
7. Preserve all exports

## Files to Change

- `src/views/fragments.ts` — the only file that needs changes
- `src/routes/lesson-generation.ts` — no changes needed (imports are preserved)

## No-Nos

- Do not touch any test files
- Do not touch CSS or other view functions
- Do not change any function signatures that lesson-generation.ts imports
