# Data Model: Security Hardening

## Entities

### RateLimiter (In-Memory, Not Persisted)

No database tables. The rate limiter lives entirely in memory.

**Internal structure**:

```
Map<key: string, timestamps: number[]>
```

Where `key = "${userId}:${category}"` and `timestamps` is a sorted array of `Date.now()` millisecond values within the sliding window.

**Categories**:

| Category | Limit | Window |
|----------|-------|--------|
| `chat` | 20 | 60 seconds |
| `lesson_gen` | 10 | 60 seconds |
| `mission_create` | 5 | 60 seconds |

**State transitions**: None. Timestamps are append-only within a window and garbage-collected on check (expired entries pruned when `check()` is called for that key).

**Lifecycle**: Created once at app startup, garbage-collected per-category on each `check()` call. Entire map discarded on server restart. No cleanup timer needed — expired entries are removed lazily when their key is next accessed.

## Input Limit Constants

Pure constants — no entity, no state.

| Constant | Value | Applies To |
|----------|-------|------------|
| `MAX_CHAT_MESSAGE` | 10,000 | Chat message text, guided answer text |
| `MAX_MISSION_TITLE` | 200 | Mission title, topic |
| `MAX_FEEDBACK_TEXT` | 2,000 | Lesson feedback text |

## AppVariables Addition

One new field on the existing `AppVariables` type:

```typescript
rateLimiter: RateLimiter | null
```

Nullable so tests can pass `null` to disable rate limiting without special-casing the implementation.

### RateLimiter Interface

```typescript
interface RateLimiter {
  /** Returns true if the request is allowed, false if rate limited. */
  check(userId: number, category: string, limit: number, windowMs: number): boolean;
}
```

A single method: `check()` both tests and records. Returns `true` if allowed (and records the timestamp), `false` if the limit is exceeded (and does NOT record — so spamming a rate-limited endpoint doesn't extend the penalty).
