# Research: Harden Session Auth

## 1. CSRF Token Strategy

**Decision**: Cookie-based CSRF token with htmx `hx-headers` attribute, validated via Hono middleware.

**Rationale**: The spec assumption (non-HTTP-only `learninator_csrf` cookie + htmx reads it client-side) avoids touching every view template. htmx's `hx-headers` meta can be set once in the base layout to include `X-CSRF-Token` on every htmx request automatically. GET requests are exempt per spec (FR-005/FR-006). The token is generated server-side on session creation (login/signup) and stored in the sessions table. It lives as long as the session — no per-request rotation needed per the spec's stated assumption about cross-tab behavior.

**Alternatives considered**:
- Embedded CSRF token in every `<form>` tag: would require modifying every view template and every htmx fragment. Rejected as too invasive.
- Double-submit cookie pattern with JS: requires client-side JS to read and set a custom header. htmx can do this natively via `hx-headers` on `<body>`.
- Synchronizer token pattern with server-side state: adds DB lookups on every POST, rejected as unnecessary given cookie-based approach.

**Implementation note**: The `hx-headers` meta tag on `<body>` needs to be added to the base layout. Since view templates use `layout.ts` or equivalent shared wrapper, a single meta tag covers all pages. The CSRF cookie is set alongside the session cookie on login/signup, and also set on legacy cookie migration.

## 2. Rate Limiter Extension for IP-Based Keys

**Decision**: Add a `checkByKey(key: string, category: string, limit: number, windowMs: number): boolean` method to the `RateLimiter` interface.

**Rationale**: The existing `check(userId, category, limit, windowMs)` uses `number` for the first parameter, which works for authenticated users but not for auth endpoints where the user hasn't authenticated yet. Adding a separate method keeps the interface clean and doesn't break existing callers. The key for auth endpoints is `ip:category` where `ip` comes from `c.req.header("x-forwarded-for") ?? "127.0.0.1"` (or Hono's built-in IP resolution).

**Alternatives considered**:
- Overload `check` to accept `string | number`: breaks the clean type contract. The number `0` could be a valid user ID.
- Create a separate `AuthRateLimiter` interface: unnecessary abstraction — the existing `SlidingWindowRateLimiter` already uses string keys internally (`${userId}:${category}`). The new `checkByKey` just bypasses the userId prefix.
- Use Hono's built-in rate limiter: Hono doesn't have a built-in rate limiter in the version used by this project.

**Implementation note**: `checkByKey` stores timestamps under the raw string key. The `check` method continues to use `userId:category` format. Both use the same internal `windows` Map.

## 3. Session Store Integration Pattern

**Decision**: Add `SessionStore` interface + Drizzle implementation to the existing `DrizzleMissionStore` composite class (following the pattern of `UserStore`, `ChatStore`, etc.).

**Rationale**: The `DrizzleMissionStore` already implements 8 focused interfaces (`MissionStore`, `LessonStore`, `ChatStore`, `ContentStore`, `RefDocStore`, `LearningRecordStore`, `UserStore`). Adding `SessionStore` to this composite is consistent with the existing architecture. The store is already injected into Hono context as `c.get("store")`, so session operations are available everywhere without new wiring.

**Alternatives considered**:
- Separate `SessionStore` class with its own DI: adds another context-injected dependency. Route handlers and middleware would need to call `c.get("sessionStore")` instead of `c.get("store")`. More changes across more files.
- Direct DB queries in auth middleware: violates Constitution IV (Explicit Dependency Injection) and makes testing harder.

**Implementation note**: `SessionStore` interface includes `createSession`, `getSessionByToken`, `deleteSession`, `deleteExpiredSessions`. The composite store also gets corresponding in-memory implementations in the `InMemory*` classes for tests.

## 4. Legacy Cookie Migration

**Decision**: Detect legacy cookies by checking if the token value is a parseable integer (the old format was `String(user.id)`). On detection, look up the user by ID, create a new session, set the new-format cookie, and proceed.

**Rationale**: The cookie value format is the only reliable discriminator. Old format: `"1"`, `"42"` (parseable as integer). New format: `"550e8400-e29b-41d4-a716-446655440000"` (UUID v4). A simple `parseInt(token)` check followed by `isNaN()` distinguishes them. The approach is in FR-011.

**Alternatives considered**:
- Cookie name change (`learninator_sid_v2`): would orphan old cookies and require users to re-login — worse UX.
- Separate migration endpoint: unnecessary — the middleware handles it transparently on any protected route.

**Implementation note**: FR-011 specifies this migration path should be removed after one release cycle. Add a `// REMOVE after v1.x` comment at the migration site.

## 5. Session Cleanup Strategy

**Decision**: Opportunistic cleanup on every successful login — delete all expired sessions across all users.

**Rationale**: SQLite's WAL mode handles concurrent reads and serialized writes. Session bloat is a long-term concern for a small-user-base app. Tying cleanup to login (a relatively infrequent operation) keeps the mechanism simple — no timer, no cron, no separate maintenance endpoint. Per spec (FR-010), this is the required approach.

**Alternatives considered**:
- Timer-based cleanup (setInterval): adds background processing to the server process. Risk of running during test execution. Rejected as overengineered for the scale.
- Cleanup on every request: adds a write to every read, slowing down the hot path. Rejected.
- Separate `/api/maintenance` endpoint: requires external cron caller. More infrastructure. Rejected.

## 6. Secure Cookie Flag Logic

**Decision**: Use `process.env.NODE_ENV === "production"` as the gate for setting `secure: true` on cookies.

**Rationale**: The spec (FR-007) and Story 4 specify this directly. `NODE_ENV` is the standard Node.js convention and is already set in the Docker Compose production environment. Development and test environments leave it unset or set to "development"/"test".

**Implementation note**: Extract the secure flag into a module-level constant: `const SECURE_COOKIE = process.env.NODE_ENV === "production"`. Used in all setCookie calls (login, signup, session creation during legacy migration).
