# Research: Rate Limiter Middleware

## Decision: Factory-based Hono middleware

**Decision**: Create a `rateLimit(action, max, windowMs)` factory function that returns a standard Hono middleware handler.

**Rationale**:
- Hono middleware supports the `next()` / short-circuit pattern directly — return a response to short-circuit, or call `await next()` to pass through. This maps exactly to the existing guard logic.
- All route handlers use `new Hono<{ Variables: AppVariables }>()` which gives middleware access to typed context via `c.get("rateLimiter")` and `c.get("user")`.
- The middleware factory pattern is already used in the codebase (e.g., `auth.requireAuth` is a middleware factory) — this follows established convention.

**Alternatives considered**:
- *Wrapper function*: A `withRateLimit(handler, action, max, window)` wrapper function. Rejected because it doesn't compose naturally with Hono's existing middleware chain pattern and would need to be wrapped around every handler, making it less discoverable.
- *Decorate-at-export*: Applying rate limiting at module export time. Rejected because it would separate the rate limit declaration from the route declaration, reducing visibility.

## Evidence: 7 guard instances (codebase audit)

The spec referenced 6 instances, but a full audit reveals 7:

| # | File | Line | Route | Action | Max | Window |
|---|------|------|-------|--------|-----|--------|
| 1 | missions.ts | 73-76 | POST `/` | `mission_create` | 5 | 60s |
| 2 | missions.ts | 122-125 | POST `/new` | `mission_create` | 5 | 60s |
| 3 | missions.ts | 295-298 | POST `/:missionId/chat` | `chat` | 20 | 60s |
| 4 | lesson-generation.ts | 77-80 | POST `/:number/generate-next` | `lesson_gen` | 10 | 60s |
| 5 | lesson-generation.ts | 126-129 | POST `/:number/generate-sub-lesson` | `lesson_gen` | 10 | 60s |
| 6 | lesson-generation.ts | 157-160 | POST `/:number/regenerate` | `lesson_gen` | 10 | 60s |
| 7 | lesson-generation.ts | 190-193 | POST `/:number/generate-bridging` | `lesson_gen` | 10 | 60s |

All 7 share the exact same guard structure:
```typescript
const rateLimiter = c.get("rateLimiter");
if (rateLimiter && !rateLimiter.check(user.id, "<action>", <max>, <windowMs>)) {
    return c.html(rateLimitedFragment());
}
```

## Import analysis

- `src/routes/missions.ts` imports `rateLimitedFragment` from `../security/index.js`. After the migration, `rateLimitedFragment` will still be needed by the middleware module, but the import in missions.ts can be removed if it's not used elsewhere in the file. However, looking at the file: missions.ts also uses `validateChatMessage`, `validateTitle`, `validateTopic` from the same import. So the import line `import { validateChatMessage, validateTitle, validateTopic, rateLimitedFragment }` from `"../security/index.js"` can drop `rateLimitedFragment`.

- `src/routes/lesson-generation.ts` imports `rateLimitedFragment` from `"../security/index.js"`. It also imports `validateNotes` from the same line. After migration, the import can drop `rateLimitedFragment`.

## Auth routes clarification

Auth routes (`src/auth/index.ts`) use `rateLimiter.checkByKey(ip, "login", ...)` and `rateLimiter.checkByKey(ip, "signup", ...)` — a structurally different method call with IP-based identification. This pattern is intentionally scoped out of this middleware.
