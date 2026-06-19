# Data Model: Route Generator Through Store Seam

**Feature**: 014-generator-through-store-seam | **Plan**: [plan.md](./plan.md)

No schema changes. This is a pure refactor — the existing database tables are unchanged.

## Entities (unchanged)

### LessonRow (`lessons` table)

Used by the generator's result-finding callbacks via `store.getLatestLesson()` and `store.getLesson()`.

| Field | Type | Used by generator |
|-------|------|-------------------|
| `number` | `number` | Returned in `JobResult.lessonNumber` |
| `subNumber` | `number \| null` | Returned in `JobResult.lessonSubNumber` |
| `title` | `string` | Returned in `JobResult.lessonTitle` |

No other lesson fields are consumed by the generator.

## Types (code-level, no DB schema change)

### GeneratorDeps (was Deps)

```typescript
export interface GeneratorDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore;      // was: db: any
  events: EventBus;          // new (replaces module-level emit)
  logger: Logger;
}
```

### JobStatus (unchanged public API)

```typescript
export type JobStatus =
  | { status: "running"; message: string }
  | { status: "done"; lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string }
  | { status: "error"; error: string }
  | { status: "not_found" };
```

### InternalJob (private, unchanged)

```typescript
interface InternalJob {
  status: "running" | "done" | "error";
  messages: string[];
  result: { lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string } | null;
  error: string | null;
}
```

### FindResultFn (private, new)

```typescript
type FindResultFn = () => Promise<{
  lessonNumber: number;
  lessonSubNumber: number | null;
  lessonTitle: string;
} | null>;
```

Callback passed to `runGenerationJob()` to locate the result lesson after the conversation loop completes. Two variants:
- **`getLatestLesson` callback** (next, sub, bridge): Reads latest lesson by ID; returns result only if it differs from the triggering lesson.
- **`getLesson` callback** (regenerate): Reads the specific lesson by number/subNumber; returns result if found (regenerate modifies in-place).

## State Transitions (Job Lifecycle)

```
                  ┌──────────┐
                  │ not_found │  (never stored; returned by getJobStatus when key missing)
                  └──────────┘
                        ▲
                        │ job deleted (consumed or timeout)
                        │
  buildJobKey() ┌───────┴───────┐
  ─────────────→│    running     │
                └───────┬───────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        ┌──────────┐       ┌──────────┐
        │   done    │       │  error   │
        └────┬─────┘       └────┬─────┘
             │                  │
             ▼                  ▼
      getJobStatus()      getJobStatus()
      returns terminal    returns terminal
      + deletes job       + deletes job
      (60s setTimeout     (60s setTimeout
       cleanup also        cleanup also
       deletes)            deletes)
```

Deduplication: `generateXxx()` methods check `this.jobs.has(key)` before calling `runGenerationJob()`. If a job with the same key is already running, the existing key is returned immediately.
