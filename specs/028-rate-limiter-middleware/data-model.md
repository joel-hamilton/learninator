# Data Model: Rate Limiter Middleware

**No data model changes.** The middleware is a pure refactoring — it does not introduce any new entities, database tables, or persisted state.

The existing `SlidingWindowRateLimiter` (in `src/security/rate-limiter.ts`) already manages its own in-memory state and is unchanged by this feature. The middleware simply delegates to it.

## Existing entities

- **`RateLimiter`** (interface in `src/security/rate-limiter.ts`): Defines `check(userId: string, action: string, max: number, windowMs: number): boolean`
- **`SlidingWindowRateLimiter`** (class): Implements `RateLimiter` using an in-memory sliding window store
- **`rateLimitedFragment()`** (function in `src/security/input-limits.ts`): Returns the 429 HTML fragment string
