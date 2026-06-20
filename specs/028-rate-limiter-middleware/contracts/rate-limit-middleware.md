# Contract: `rateLimit()` Middleware Factory

## Module

`src/security/rate-limit-middleware.ts`

Re-exported from `src/security/index.ts`.

## Signature

```typescript
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types.js";

export function rateLimit(
  action: string,
  max: number,
  windowMs: number,
): MiddlewareHandler<{ Variables: AppVariables }>;
```

## Parameters

| Parameter  | Type     | Description |
|------------|----------|-------------|
| `action`   | `string` | Logical name for the rate limit bucket (e.g., `"mission_create"`, `"chat"`, `"lesson_gen"`). Passed directly to `rateLimiter.check()`. |
| `max`      | `number` | Maximum number of requests allowed within the time window. |
| `windowMs` | `number` | Time window in milliseconds. |

## Behavior

1. Reads `rateLimiter` from Hono context via `c.get("rateLimiter")`.
2. If `rateLimiter` is `null` or `undefined`: calls `await next()` — all requests pass through without rate limiting. (Preserves test-mode behavior.)
3. Reads the current user from context via `c.get("user")`. If user is null (no authenticated session), calls `await next()` — defensive fallback.
4. Calls `rateLimiter.check(user.id, action, max, windowMs)`.
5. If check returns `true` (within limit): calls `await next()` — handler executes normally.
6. If check returns `false` (limit exceeded): returns `c.html(rateLimitedFragment())` — short-circuits the chain, handler does not execute.

## Usage

```typescript
import { rateLimit } from "../security/index.js";

// In route definition:
missionRoutes.post(
  "/",
  auth.requireAuth,
  rateLimit("mission_create", 5, 60_000),
  async (c: Ctx) => {
    // Handler body — no rate limit guard needed
  },
);
```

## Dependencies

- `rateLimitedFragment()` from `../security/input-limits.js`
- `AppVariables` from `../types.js` (for context typing)

## Test behavior

When `rateLimiter` is not configured (i.e., `createApp({ rateLimiter: null })`), the middleware always calls `next()`. This is the standard test-mode setup used by `createTestApp()` and requires no changes to existing tests.
