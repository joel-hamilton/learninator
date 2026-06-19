# JobStore Contract

**Date**: 2026-06-19

This contract defines the `JobStore` interface that `LessonGenerator` depends on. Any implementation must satisfy this contract.

## Interface

```typescript
export interface JobStore {
  getJob(key: string): InternalJob | undefined;
  setJob(key: string, job: InternalJob): void;
  deleteJob(key: string): void;
}
```

## Behavioral Contract

### `getJob(key)`

| Condition | Returns |
|-----------|---------|
| A job with `key` exists | The `InternalJob` object |
| No job with `key` exists | `undefined` |

### `setJob(key, job)`

| Condition | Behavior |
|-----------|----------|
| No prior job for `key` | Stores the job |
| Prior job for `key` exists | Overwrites the prior job (last-write-wins) |

### `deleteJob(key)`

| Condition | Behavior |
|-----------|----------|
| A job with `key` exists | Removes the job |
| No job with `key` exists | No-op (does not throw) |

## Provided Implementation

### `InMemoryJobStore`

- Wraps `Map<string, InternalJob>`
- All three methods delegate to the underlying `Map`
- Thread-safety: Not guaranteed (same as current behavior). Generation jobs are per-request and run on the event loop.
- Memory: Jobs remain until explicitly deleted or the process exits. The 60-second `setTimeout` in `LessonGenerator` provides deferred cleanup for terminal jobs.
