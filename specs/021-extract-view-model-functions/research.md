# Research: Extract View-Model Functions

## Overview

No NEEDS CLARIFICATION markers were present in the spec. This is a pure refactoring — extract inline computations to testable pure functions. The research phase confirms the approach and documents the existing code structure that each extraction targets.

## Existing Code Analysis

### Extraction A: Lesson grouping (missions.ts lines 174-193)

Current inline code computes three data structures from `lessonRows`:
- `parentNums: Set<number>` — lesson numbers that have at least one sub-lesson
- `maxSubByNum: Map<number, number>` — max sub-number per parent lesson
- `lastSubs: Set<string>` — composite keys `"number:subNumber"` representing the last sub-lesson of each parent

These are consumed by `lessonCard()` to set `hasSubLessons` and `isLastSub` flags.

### Extraction B: Chat message rendering (missions.ts lines 280-295)

Current inline loop iterates `chatRows`:
- Empty array → render default assistant greeting bubble
- For each row: skip empty content, render with correct role class and formatted markdown
- Uses `contentToText()` and `formatMarkdown()` from shared utilities

### Extraction C: Lesson navigation (lessons.ts lines 52-58)

Current inline code:
- `allLessons.findIndex()` → compute position of current lesson
- `prevLesson` = element at `currentIndex - 1` (or undefined if first)
- `nextLesson` = element at `currentIndex + 1` (or undefined if last)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| New module at `src/view-models/` | Keeps extracted functions separate from route handlers and view renderers; easy to find and test |
| `lessonGrouping()` returns enriched array | Clean API: input array in, enriched array out. Consumer maps over flags as before. |
| `renderChatMessages()` returns HTML string | Matches existing pattern; route handler assigns result to a template variable |
| `computeLessonNavigation()` returns `{ prev?: LessonSummary, next?: LessonSummary }` | Returns a structured object rather than two separate variables; cleaner API |

## Alternatives Considered

- **Co-locating as module-level exports in route files**: Rejected because it would blur the separation of concerns and make functions harder to discover.
- **Putting functions into `src/views/`**: Rejected because view modules are focused on rendering page layouts, not data transformation logic.
- **Using a class or service**: Over-engineered for three pure functions. YAGNI.
