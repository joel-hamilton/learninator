# Research: Security Hardening

## 1. Sliding Window Rate Limiter Algorithm

**Decision**: Per-user in-memory sliding window using `Map<userId, number[]>` — each value is a sorted array of millisecond timestamps.

**Rationale**: The sliding window (as opposed to fixed window) avoids the burst-at-boundary problem where a user could send 20 requests at 0:59 and 20 more at 1:01, effectively doubling the rate. With a sliding window, we always count timestamps within the last 60 seconds, so the rate is truly capped regardless of alignment.

**Alternatives considered**:
- **Fixed window**: Simpler but has the boundary-burst problem. Rejected — sliding window is only a few lines more code and provides correct enforcement.
- **Token bucket**: More flexible for burst-then-refill patterns, but overkill for this use case. Sliding window is simpler to understand, debug, and test.
- **Leaky bucket**: Good for smoothing, but the requirement is to reject excess, not queue it. Rejected.
- **External dependency (express-rate-limit etc.)**: Constitution forbids new npm dependencies for this feature. Rejected.

**Implementation sketch**:
```typescript
class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>(); // key: "userId:category"

  check(userId: number, category: string, limit: number, windowMs: number): boolean {
    const key = `${userId}:${category}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    let timestamps = this.windows.get(key) || [];
    // Filter expired, keep recent
    timestamps = timestamps.filter(t => t > cutoff);
    if (timestamps.length >= limit) return false; // rate limited
    timestamps.push(now);
    this.windows.set(key, timestamps);
    return true; // allowed
  }
}
```

## 2. Input Validation Approach

**Decision**: Pure validation functions exported from `src/security/input-limits.ts`, called explicitly in each route handler. Not a global middleware.

**Rationale**: Different routes have different limits, different field names, and different error contexts. A global middleware would need complex configuration mapping route patterns to limits. Explicit calls at each route handler are more readable and testable — each route is responsible for validating its own inputs.

**Alternatives considered**:
- **Global Hono middleware with route-pattern matching**: Would require maintaining a map of route patterns → field → limit. Brittle when routes change. Rejected.
- **Zod validation**: Adds a dependency and is heavier than needed for simple length checks. Rejected per "no new dependencies" constraint.

**Limit constants**:
| Field | Limit | Rationale |
|-------|-------|-----------|
| Chat messages | 10,000 chars | ~2,000 tokens — generous for detailed questions |
| Mission title/topic | 200 chars | Fits in UI header, DB column is TEXT but titles are short |
| Feedback text | 2,000 chars | Enough for detailed qualitative feedback |
| Guided answer + other_text | 5,000 chars combined | More than chat because it includes "other" free-text |

## 3. Middleware vs. Handler-Level Injection

**Decision**: Rate limiter is a class instance injected via `AppVariables` (following Constitution IV), accessed via `c.get("rateLimiter")`. Input validators are pure functions imported directly.

**Rationale**: The rate limiter needs to be replaceable in tests (e.g., to inject a disabled version or one with different limits). Input validators are stateless pure functions — no injection needed, just import and call.

**Alternatives considered**:
- **Rate limiter as global singleton**: Untestable per Constitution I. Rejected.
- **Rate limiter as middleware**: Would need per-route configuration. More complex than handler-level calls where limits vary by route.

## 4. Dead Code Audit

**Findings from codebase search**:

| Location | Reference | Action |
|----------|-----------|--------|
| `src/routes/missions.ts:612-634` | SSE tool-events route | **Delete** |
| `src/routes/missions.ts:3` | `import { streamSSE }` | **Keep** — `streamSSE` is also used in `src/routes/home.ts:2` for `/workflows/events` |
| `src/views/fragments.ts:419` | `new EventSource("/missions/" + missionId + "/chat/tool-events")` | **Delete** — this is the client-side connection to the removed endpoint |
| `src/test/workflow-visibility.test.ts:33,71,83` | References to `tool-banner` | **Delete** — these test for absence of old tool-banner, which is already removed |
| `src/test/workflow-visibility.test.ts:67` | Test hitting the old endpoint | **Delete** — test for a route being removed |

No `tool-banner` references found in production view code — only in the test file that verifies its removal (leftover from a previous cleanup).

## 5. Error Fragment Convention

**Decision**: Error fragments follow the existing pattern in `src/views/fragments.ts` — simple div with inline styles. Format:

```html
<div class="msg assistant" style="color:var(--danger);">Message text</div>
```

This matches the error handling already used in chat routes (e.g., chat.ts:73, lessons.ts:472). For non-chat contexts (title rename, etc.), use targeted fragments that replace the form's swap target.

**Alternatives considered**:
- **Toast/notification system**: Would require new UI infrastructure. Rejected — follow existing inline error pattern.
- **HX-Retarget to a global error banner**: Overcomplicates simple validation errors. Rejected.
