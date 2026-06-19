# Research: Extract JobStore Interface

**Date**: 2026-06-19

## Unknowns and Resolutions

There are no unresolved unknowns for this feature. The feature description is precise, the project context is well-understood, and the interface shape is directly derivable from the existing `Map<string, InternalJob>` usage in `LessonGenerator`.

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Interface location | `src/lessons/job-store.ts` | Keeps the interface co-located with `LessonGenerator` without cluttering `generator.ts`. Named `job-store.ts` for clarity. |
| Interface methods | `getJob()`, `setJob()`, `deleteJob()` | These three directly replace every `Map` operation used by `LessonGenerator`: `get`, `set`, `delete`, and `has` (via `getJob` returning undefined). No `clear()` or `keys()` needed — cleanup is handled by `LessonGenerator`'s `setTimeout` and `getJobStatus`. |
| InternalJob export | Export from `generator.ts` | Keeps the type definition adjacent to `JobStatus` and `buildJobKey()` which are already exported from `generator.ts`. Avoids circular dependency risk between `generator.ts` and `job-store.ts`. |
| GeneratorDeps field | `jobStore: JobStore` | Named to match the pattern of other deps fields (`store: MissionStore & LessonStore`, `ai: AiClient`). |
| `createLessonGenerator()` change | Accept `JobStore` via deps | The factory function signature stays the same — callers pass deps which now includes `jobStore`. Existing call sites update transparently. |

### Existing Usage Analysis

The `LessonGenerator` uses the `Map` in four ways:

1. **`this.jobs.has(key)`** — dedup check in `runGeneration()` (line 374)
2. **`this.jobs.set(key, job)`** — initial job creation in `runGenerationJob()` (line 410)
3. **`this.jobs.get(key)`** — status polling in `getJobStatus()` (line 330)
4. **`this.jobs.delete(key)`** — terminal state cleanup in `getJobStatus()` (lines 334, 339) and deferred cleanup in `setTimeout` (line 425)

All four map cleanly to the three methods: `has` + `get` → `getJob`, `set` → `setJob`, `delete` → `deleteJob`.
