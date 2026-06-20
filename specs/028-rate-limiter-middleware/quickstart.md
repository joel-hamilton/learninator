# Quickstart: Rate Limiter Middleware

## Prerequisites

- Node.js 22
- All dependencies installed (`npm install`)

## Validation scenarios

### 1. Existing test suite passes

```bash
npm test
```

All rate-limiter-related tests in `src/test/security/auth-rate-limiter.test.ts` and `src/test/security.test.ts` must pass without modification. The null-rateLimiter test (`T028: rate limiter bypassed when rateLimiter is null`) remains valid because the middleware preserves the existing guard's null-check behavior.

**Expected**: 0 test failures. No tests need to be changed or added.

### 2. Rate-limited route returns 429 when limit exceeded

Create a route with a deliberately low limit and verify:

```bash
# Start the app (dev mode)
npm run dev
```

Using curl or the browser's dev console, send requests to a rate-limited POST route (e.g., lesson generation) in rapid succession. After exceeding the limit, subsequent requests should return the rate-limited HTML fragment (a red error message: "You're sending messages too quickly...").

### 3. Routes without rate limiting are unaffected

Verify that GET routes, PUT routes for mission renaming, and other non-rate-limited POST routes (like archive/restore/delete) continue to work without any rate-limit interference.

### 4. Test-mode bypass

The existing test helper `createTestApp()` passes `rateLimiter: null`, which disables rate limiting. This must continue to work — all acceptance scenarios in test mode should succeed regardless of request frequency.

## Implementation order

1. Create `src/security/rate-limit-middleware.ts` with the `rateLimit()` factory
2. Re-export `rateLimit` from `src/security/index.ts`
3. Apply middleware to the 3 missions.ts routes
4. Clean up the `rateLimitedFragment` import from missions.ts
5. Apply middleware to the 4 lesson-generation.ts routes
6. Clean up the `rateLimitedFragment` import from lesson-generation.ts
7. Run full test suite to confirm no regression
