# Data Model: JobStore Interface

**Date**: 2026-06-19

## InternalJob

The record type for a generation job. Currently defined inside `generator.ts` (not exported), will be exported to share with `JobStore` implementations.

```typescript
interface InternalJob {
  status: "running" | "done" | "error";
  messages: string[];
  result: {
    lessonNumber: number;
    lessonSubNumber: number | null;
    lessonTitle: string;
  } | null;
  error: string | null;
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"running" \| "done" \| "error"` | Current state of the generation job |
| `messages` | `string[]` | Human-readable progress updates appended during tool execution |
| `result` | `{ lessonNumber, lessonSubNumber, lessonTitle } \| null` | The generated lesson metadata, set when status becomes "done" |
| `error` | `string \| null` | Error message, set when status becomes "error" |

### State Transitions

```
created → "running" → "done" | "error"
```

- Created by `LessonGenerator.runGenerationJob()` with status `"running"`
- Transitions to `"done"` when conversation loop completes and `findResult` succeeds
- Transitions to `"error"` if conversation loop throws
- Terminal states are consumed once by `getJobStatus()`, then deleted from the store

## JobStore Interface

```typescript
interface JobStore {
  getJob(key: string): InternalJob | undefined;
  setJob(key: string, job: InternalJob): void;
  deleteJob(key: string): void;
}
```

| Method | Semantics |
|--------|-----------|
| `getJob(key)` | Returns the job or `undefined` if not found. Replaces both `Map.get` and `Map.has`. |
| `setJob(key, job)` | Stores the job. Replaces `Map.set`. |
| `deleteJob(key)` | Removes the job. Must be idempotent (no-op for missing keys). Replaces `Map.delete`. |

### Usage Map

| Caller | Operation | JobStore Method |
|--------|-----------|-----------------|
| `runGeneration()` line 374 | `this.jobs.has(key)` dedup | `getJob(key) !== undefined` |
| `runGenerationJob()` line 410 | `this.jobs.set(key, job)` store | `setJob(key, job)` |
| `getJobStatus()` line 330 | `this.jobs.get(key)` poll | `getJob(key)` |
| `getJobStatus()` lines 334, 339 | `this.jobs.delete(key)` cleanup | `deleteJob(key)` |
| `runGenerationJob()` line 425 | `this.jobs.delete(key)` deferred | `deleteJob(key)` |

## InMemoryJobStore

A concrete implementation wrapping `Map<string, InternalJob>`:

```typescript
class InMemoryJobStore implements JobStore {
  private jobs = new Map<string, InternalJob>();

  getJob(key: string): InternalJob | undefined {
    return this.jobs.get(key);
  }

  setJob(key: string, job: InternalJob): void {
    this.jobs.set(key, job);
  }

  deleteJob(key: string): void {
    this.jobs.delete(key);
  }
}
```

All three methods delegate directly to the underlying `Map`, preserving the same semantics as the current inline usage.

## GeneratorDeps Changes

Add a `jobStore` field:

```typescript
interface GeneratorDeps {
  ai: AiClient;
  toolExecutor: ToolExecutor;
  store: MissionStore & LessonStore;
  jobStore: JobStore;                    // NEW
  events?: EventBus;
  logger: Logger;
}
```

The `createLessonGenerator()` factory creates an `InMemoryJobStore` by default if none is provided (for backward compatibility), or accepts one via deps.
