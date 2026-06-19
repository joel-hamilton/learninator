# Contracts: Harden Session Auth

## 1. SessionStore Interface

```typescript
export interface SessionStore {
  createSession(values: {
    userId: number;
    token: string;       // UUID v4
    csrfToken: string;   // random base64url
    expiresAt: string;   // ISO 8601
  }): Promise<SessionRow>;

  getSessionByToken(token: string): Promise<SessionRow | undefined>;

  deleteSession(token: string): Promise<void>;

  /** Delete all sessions where expiresAt <= now */
  deleteExpiredSessions(): Promise<void>;
}
```

**Contract**:
- `createSession` inserts a row and returns it. Token uniqueness is enforced by the DB UNIQUE constraint.
- `getSessionByToken` returns the session row or `undefined`. Caller checks `expiresAt > now` — the store does NOT filter on expiration (to allow the middleware to differentiate "not found" from "expired" if needed, though the spec treats both as unauthenticated).
- `deleteSession` removes exactly one row by token. Idempotent — no error if the token doesn't exist.
- `deleteExpiredSessions` removes all rows where `expiresAt <= now`. Returns void.

## 2. RateLimiter Interface Extension

```typescript
export interface RateLimiter {
  /** Existing: user-based rate limiting */
  check(userId: number, category: string, limit: number, windowMs: number): boolean;

  /** NEW: string-key-based rate limiting (for IP-anchored auth endpoints) */
  checkByKey(key: string, category: string, limit: number, windowMs: number): boolean;
}
```

**Contract**:
- `checkByKey` behaves identically to `check` but accepts an arbitrary string key. For auth endpoints, the key is the client IP address (e.g., `"192.168.1.1:login"`).
- Both methods are idempotent and side-effect-free (they record timestamps internally but don't persist).
- `limit` is the max number of allowed requests within `windowMs` milliseconds.
- Returns `true` if the request is allowed (and records the timestamp), `false` if it should be rejected.

## 3. CSRF Middleware Contract

```typescript
// Applied as Hono middleware on POST/PATCH/PUT/DELETE routes
const csrfMiddleware = (c: Context, next: () => Promise<void>) => Promise<void>;
```

**Contract**:
- Reads `X-CSRF-Token` from request header and `learninator_csrf` from cookie.
- If either is missing → 403 with generic "Invalid CSRF token" body.
- If they don't match → 403.
- If they match → calls `next()`.
- GET and HEAD requests are exempt (called but pass through immediately).

## 4. Session Middleware Contract (Updated)

```typescript
const sessionMiddleware = (c: AuthContext, next: () => Promise<void>) => Promise<void>;
```

**Contract** (updated from current):
- Reads `learninator_sid` cookie.
- If cookie is missing → `c.set("user", null)`, calls `next()`.
- If cookie value is a parseable integer (legacy format):
  1. Look up user by integer ID.
  2. If user exists: create a new session (UUID token + CSRF token), set `learninator_sid` and `learninator_csrf` cookies, set user on context.
  3. If user doesn't exist: `c.set("user", null)`.
- If cookie value is a UUID (new format):
  1. Look up session by token.
  2. If session exists and not expired → look up user by session.userId, set user on context.
  3. If session not found or expired → `c.set("user", null)`.
- Calls `next()` in all cases (never short-circuits — that's `requireAuth`'s job).

## 5. Cookie Constants

| Cookie | Value | httpOnly | Secure | SameSite | Path | MaxAge |
|--------|-------|----------|--------|----------|------|--------|
| `learninator_sid` | UUID v4 | `true` | `NODE_ENV === "production"` | `Lax` | `/` | 30 days |
| `learninator_csrf` | base64url random (32+ bytes) | `false` | `NODE_ENV === "production"` | `Lax` | `/` | 30 days |

The CSRF cookie MUST have `httpOnly: false` so htmx can read it via `document.cookie` and inject it as a header.
