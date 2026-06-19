# Feature Specification: Harden Session Auth

**Feature Branch**: `018-harden-session-auth`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Harden Session Auth — the authentication system stores the raw user ID in a cookie with no server-side session tracking, no CSRF protection, and hardcoded insecure cookie flags."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Server-Side Session Tokens with Logout Invalidation (Priority: P1)

As a user, when I log out, my session is terminated server-side so that a previously stolen cookie cannot be reused to access my account.

**Why this priority**: This is the foundational security fix. Without server-side session tracking, the cookie IS the session — a stolen cookie remains valid for 30 days regardless of logout. This is the most severe vulnerability and must be addressed first.

**Independent Test**: Can be fully tested by logging in, extracting the session cookie, logging out, then attempting to use the cookie to access a protected route. The request MUST be rejected (redirect to /login). A new login after logout creates a fresh session and works normally.

**Acceptance Scenarios**:

1. **Given** a user is logged in with a valid session cookie, **When** they visit /logout, **Then** the session row is deleted from the database, the cookie is cleared, and the user is redirected to /login
2. **Given** a session cookie from a previously logged-out session, **When** it is presented on a protected route (/missions, /settings, etc.), **Then** the middleware treats it as unauthenticated and redirects to /login
3. **Given** a user with an active session, **When** the session token is tampered with (modified UUID or non-UUID value), **Then** the middleware redirects to /login without revealing why the request was rejected
4. **Given** a user with an active session, **When** the session has expired (past `expires_at`), **Then** the middleware redirects to /login

---

### User Story 2 - CSRF Protection for All State-Changing Requests (Priority: P1)

As a developer, all POST/PATCH/PUT/DELETE requests require a valid CSRF token so that external sites cannot forge requests against an authenticated user's session.

**Why this priority**: HTMX forms currently rely solely on `sameSite: "Lax"` for CSRF defense. This is insufficient — a subdomain takeover, redirect chain, or browser quirk can bypass it. Adding explicit CSRF tokens closes this gap with defense-in-depth.

**Independent Test**: Can be tested by sending a POST request to any state-changing route (archive mission, delete lesson, change password, send chat message) without a CSRF token header, and verifying it returns 403. The same request with a valid CSRF token (fetched from a token endpoint or embedded in the page) succeeds.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they POST to any state-changing route without a CSRF token, **Then** the server returns 403 Forbidden
2. **Given** an authenticated user on a page that includes CSRF token metadata, **When** they POST with a valid CSRF token, **Then** the request proceeds normally
3. **Given** an authenticated user, **When** they POST with an expired or replayed CSRF token, **Then** the server returns 403 Forbidden
4. **Given** a GET request to any route, **When** the request does not include a CSRF token, **Then** the request proceeds normally (GET routes are not protected)

---

### User Story 3 - Rate Limiting on Auth Endpoints (Priority: P2)

As an operator, login and signup endpoints are rate-limited per IP address so that brute-force password attacks and mass account creation are impractical.

**Why this priority**: The existing rate limiter is applied to chat, lesson generation, and mission creation, but the auth endpoints (login and signup) are unprotected. These are the primary vectors for credential stuffing and account enumeration attacks. Priority P2 because the session token and CSRF changes (P1) mitigate the worst post-auth threats, but brute force on the login form remains exploitable without rate limiting.

**Independent Test**: Can be tested by sending 6+ rapid POST requests to /login with the same IP (same in-memory rate limiter instance). The 6th request returns a rate-limit error message. The same test applies to /signup with a separate rate limit category.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they POST to /login more than 10 times within 60 seconds from the same IP, **Then** the 11th request returns a rate-limit error message
2. **Given** an unauthenticated visitor, **When** they POST to /signup more than 5 times within 60 seconds from the same IP, **Then** the 6th request returns a rate-limit error message
3. **Given** a visitor who was rate-limited on /login, **When** they wait 60 seconds, **Then** they can attempt login again
4. **Given** the rate limiter is configured as `null` (test mode), **When** requests exceed normal limits, **Then** no rate limiting is applied

---

### User Story 4 - Environment-Aware Secure Cookie Flag (Priority: P2)

As a user accessing the app over HTTPS in production, the session cookie is marked `Secure` so that it is never transmitted over unencrypted connections.

**Why this priority**: The cookie flag is hardcoded to `secure: false` on lines 60 and 103 of `src/auth/index.ts`. When deployed behind HTTPS (production), the session cookie is still sent over plain HTTP connections, exposing it to network interception. This is a straightforward one-line fix per call site.

**Independent Test**: Can be tested in two ways. (1) With `NODE_ENV=production`, any `setCookie` call produces a `Set-Cookie` header that includes the `; Secure` attribute. (2) With `NODE_ENV=development` or unset, the `Secure` flag is absent, allowing local HTTP testing.

**Acceptance Scenarios**:

1. **Given** the app runs with `NODE_ENV=production`, **When** a user logs in or signs up, **Then** the `Set-Cookie` header includes the `; Secure` directive
2. **Given** the app runs with `NODE_ENV=development` or without `NODE_ENV` set, **When** a user logs in or signs up, **Then** the `Set-Cookie` header does NOT include the `; Secure` directive

---

### User Story 5 - Expired Session Cleanup (Priority: P3)

As a developer, expired session records are automatically pruned so the sessions table does not accumulate stale rows over time.

**Why this priority**: Session bloat does not present a security risk (expired tokens are rejected), but over months of operation the sessions table will accumulate expired rows. Cleanup keeps the table lean. Priority P3 because the app runs on SQLite and the user base is small; bloat is a long-term concern.

**Independent Test**: Can be tested by creating a session record with an `expires_at` in the past, then triggering the cleanup mechanism (e.g., on login of another session, or a dedicated /api/maintenance endpoint). The expired row is deleted.

**Acceptance Scenarios**:

1. **Given** there are expired session rows in the sessions table, **When** a user successfully logs in, **Then** all expired sessions for that user are deleted
2. **Given** there are expired session rows for other users in the sessions table, **When** any user successfully logs in, **Then** all expired sessions across all users are deleted (opportunistic global cleanup)

---

### Edge Cases

- What happens when a user with the old cookie format (numeric user ID) visits after deployment? The middleware detects the legacy cookie, looks up the user, creates a session implicitly, and sets a new-format session cookie. The old cookie is replaced transparently.
- What happens if a user has multiple active sessions (e.g., logged in from two devices)? Each session is an independent row in the sessions table. Logging out from one device deletes only that session row; the other device remains logged in.
- How does the system handle a session token that is syntactically valid (UUID format) but does not exist in the database? The middleware treats it as unauthenticated and redirects to /login. No error details are exposed.
- How does the system handle concurrent login of the same user from two browsers? Both create independent session rows. Both sessions are valid simultaneously.
- What happens to sessions when a user account is deleted? The delete must cascade: deleting a user from the users table must also delete all associated session rows. The `MissionStore.deleteUser()` method (or equivalent) should include session cleanup.
- What happens if the CSRF token cookie and the CSRF token in the request body diverge (e.g., race condition with multiple tabs)? Only the most recent token is valid. If a tab was opened before a token rotation, its form submission is rejected. The user can reload the page to get a fresh token.
- How does SQLite handle concurrent session writes under the existing WAL mode? SQLite with WAL mode supports concurrent reads and serialized writes. Session creation and deletion are single-row operations, so contention is negligible for a single-user or small multi-user app.
- Does the session token leak in server logs or error pages? The session token is only ever stored in the database and the cookie. It must not appear in URLs, response bodies, log output, or error messages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `sessions` database table with columns: `id` (integer PK), `token` (text, unique, indexed), `userId` (integer FK to users), `expiresAt` (text ISO timestamp), and `createdAt` (text ISO timestamp)
- **FR-002**: System MUST generate a cryptographically random session token (UUID v4) on login and signup, store it in the sessions table, and set it as the `learninator_sid` cookie value
- **FR-003**: Session middleware MUST look up the session by token from the database, verify the token has not expired (`expiresAt > now`), and load the associated user; if any check fails, the user is treated as unauthenticated
- **FR-004**: System MUST delete the session row from the database on logout (server-side invalidation), in addition to clearing the cookie
- **FR-005**: System MUST provide a CSRF token mechanism: a random token generated per-session (or per-page-load), stored in a non-HTTP-only cookie, and required as a header (`X-CSRF-Token`) on all POST/PATCH/PUT/DELETE requests
- **FR-006**: CSRF middleware MUST validate the token on every state-changing request and return 403 Forbidden if the token is missing, invalid, or expired
- **FR-007**: The `Secure` cookie flag MUST be set to `true` when `process.env.NODE_ENV === "production"` and `false` otherwise, in both login and signup cookie-setting paths
- **FR-008**: System MUST apply rate limiting to POST /login (limit: 10 requests per 60 seconds per IP) and POST /signup (limit: 5 requests per 60 seconds per IP)
- **FR-009**: Auth route rate limiting MUST use the IP address as the key (since there is no user ID before authentication); the rate limiter interface MUST support IP-based keys in addition to user-based keys
- **FR-010**: Expired session rows MUST be cleaned up opportunistically: on every successful login, delete all expired sessions across all users
- **FR-011**: Legacy cookie format (numeric user ID) MUST be detected by the session middleware and transparently migrated: create a new session for the user, set the new-format cookie, and delete the old cookie. This migration path MUST be removed after one release cycle.
- **FR-012**: The session token MUST NOT appear in URLs, response bodies, log output, or error messages
- **FR-013**: The `MissionStore` interface MUST be extended with session operations (createSession, getSessionByToken, deleteSession, deleteExpiredSessions) OR delegated to a dedicated `SessionStore` interface

### Key Entities

- **Sessions**: A database record representing an authenticated login session. Each session is identified by a UUID v4 token stored in the user's cookie, linked to a user via `userId` foreign key, and has an expiration timestamp (30 days from creation). A user may have multiple simultaneous sessions (one per device/browser). Session deletion (on logout) is the server-side invalidation mechanism.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After logout, the session cookie is rejected by the middleware on subsequent requests (302 redirect to /login) — verified by integration test
- **SC-002**: A POST request to any state-changing route without a valid CSRF token returns 403 Forbidden — verified by integration test
- **SC-003**: With `NODE_ENV=production`, the `Set-Cookie` header from login/signup includes `Secure` — verified by integration test
- **SC-004**: The 11th POST to /login within 60 seconds returns a rate-limit error — verified by integration test
- **SC-005**: The 6th POST to /signup within 60 seconds returns a rate-limit error — verified by integration test
- **SC-006**: Legacy cookie (numeric user ID) is transparently migrated to a new-format session cookie on first request — verified by integration test
- **SC-007**: Expired session rows are deleted after a successful login — verified by integration test
- **SC-008**: All existing auth and mission tests continue to pass without modification (the session layer is additive; the login cookie helper in tests may need minor updates)

## Assumptions

- **Session lifetime**: The session expiration remains at 30 days (matching the current cookie `maxAge`), applied as the `expiresAt` column value on session creation.
- **CSRF token storage**: The CSRF token will be stored in a separate non-HTTP-only cookie (so that htmx JavaScript can read it and include it as a header) rather than embedded in every HTML page. This avoids touching every view template. The cookie-based approach works seamlessly with htmx's `hx-headers` feature.
- **CSRF token cross-tab behavior**: Multiple browser tabs share the same CSRF token cookie, so they all use the same token. Token rotation is not implemented in the initial version — the token is valid for the lifetime of the session. This avoids the "stale tab" problem where a form opened before rotation fails on submit.
- **CSRF cookie name**: The CSRF token cookie will be named `learninator_csrf` and will NOT have the `httpOnly` flag so that client-side JavaScript (htmx) can read it.
- **Rate limiter extension**: The existing `SlidingWindowRateLimiter` interface supports `check(userId, category, limit, windowMs)`. For auth endpoints, this will be extended to also support `checkIp(ip, category, limit, windowMs)` or the existing `check` method will accept a string key. The existing rate limiter already uses in-memory storage, which is suitable for a single-process deployment (Docker Compose with one Node.js process). If horizontal scaling is added later, a shared store (Redis) will be needed.
- **Migration path**: After deployment, users currently logged in will have a raw numeric user ID in their cookie. The middleware will detect this (token is a parseable integer) and silently create a session + set a new cookie. This migration logic will be removed after one release cycle (marked with a comment and tracking issue).
- **Scope boundary**: Password rotation, multi-factor authentication, OAuth/SSO integration, and account recovery flows are explicitly out of scope for this feature.
- **Scope boundary**: The session and CSRF changes do not modify the existing Hono route structure or the htmx form patterns. Forms continue to work via `hx-post` — htmx will read the CSRF token from the cookie and include it via `hx-headers`.
- **Database migration**: A new SQL migration (`0004_sessions.sql`) will be generated by `npm run db:generate` after adding the sessions table to the schema. No rollback migration is required.
- **Existing test compatibility**: The `login()` helper in `src/test/helpers.ts` currently extracts the cookie value as the raw user ID. After this change, the cookie value will be a UUID session token, which the `authedReq()` helper already passes through correctly as a `Cookie` header. The `FakeAiClient` tests do not interact with sessions directly.
