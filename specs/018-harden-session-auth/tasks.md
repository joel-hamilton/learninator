# Tasks: Harden Session Auth

**Input**: Design documents from `specs/018-harden-session-auth/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/README.md, quickstart.md

**Tests**: Tests are required per spec Success Criteria (SC-001 through SC-008). All tests use HTTP-level `app.request()` per Constitution II.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema change and migration generation

- [x] T001 Add `sessions` table to schema in `src/db/schema.ts` per data-model.md (columns: id, token, csrftoken, userId, expiresAt, createdAt; unique index on token)
- [x] T002 Run `npm run db:generate` and verify the generated migration SQL in `src/db/migrations/` is a non-destructive CREATE TABLE + CREATE INDEX
- [x] T003 Run `npm run db:migrate` to apply the new sessions table

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core store and middleware infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Add `SessionStore` interface (createSession, getSessionByToken, deleteSession, deleteExpiredSessions) to `src/db/store.ts` per contracts/README.md §1
- [x] T005 [P] Add `SessionRow` type export (inferred from schema.sessions) to `src/db/store.ts`
- [x] T006 Implement `SessionStore` methods in `DrizzleMissionStore` class in `src/db/store.ts` (depends on T004, T005)
- [x] T007 [P] Add `checkByKey(key, category, limit, windowMs)` method to `RateLimiter` interface in `src/security/rate-limiter.ts` per contracts/README.md §2
- [x] T008 Implement `checkByKey` in `SlidingWindowRateLimiter` class in `src/security/rate-limiter.ts` (depends on T007)
- [x] T009 [P] Add `InMemorySessionStore` class implementing `SessionStore` to `src/db/store.ts` for test isolation
- [x] T010 [P] Add `InMemoryRateLimiter` class implementing updated `RateLimiter` (with checkByKey) to `src/security/rate-limiter.ts` if not already present
- [x] T011 Extract `SESSION_COOKIE` and `CSRF_COOKIE` name constants, plus `SECURE_COOKIE` flag (`process.env.NODE_ENV === "production"`), and `uuidv4()` helper, into shared locations in `src/auth/index.ts` (module-level constants, not exported unless needed by csrf.ts)
- [x] T012 Update `createTestApp()` in `src/test/helpers.ts` to pass a `rateLimiter` instance (instead of `null`) if `RateLimiter` interface now required for CSRF/session middleware — or verify existing `null` passthrough still works

**Checkpoint**: Foundation ready — store interface, rate limiter extension, and shared constants all in place. User story implementation can now begin.

---

## Phase 3: User Story 1 - Server-Side Session Tokens with Logout Invalidation (Priority: P1) 🎯 MVP

**Goal**: Replace raw-user-ID cookies with UUID v4 session tokens stored in the database. Logout deletes the session row server-side so stolen cookies become invalid.

**Independent Test**: Login, extract session cookie, logout, attempt to use the cookie on a protected route → 302 redirect to /login. New login after logout works normally.

### Implementation for User Story 1

- [x] T013 [US1] Rewrite `sessionMiddleware` in `src/auth/index.ts` to look up session by UUID token from `c.get("store").getSessionByToken()`, verify not expired, and load user; treat missing/expired sessions as unauthenticated per contracts/README.md §4
- [x] T014 [US1] Add legacy cookie detection to `sessionMiddleware` in `src/auth/index.ts`: if cookie value is a parseable integer, look up user by ID, create a new session + set `learninator_sid` cookie, per research.md §4. Mark with `// REMOVE after v1.x` comment.
- [x] T015 [US1] Rewrite `POST /login` handler in `src/auth/index.ts` to generate UUID v4 token + CSRF token, call `store.createSession()`, and set `learninator_sid` and `learninator_csrf` cookies on success
- [x] T016 [US1] Rewrite `POST /signup` handler in `src/auth/index.ts` to generate UUID v4 token + CSRF token, call `store.createSession()`, and set both cookies on success
- [x] T017 [US1] Rewrite `GET /logout` handler in `src/auth/index.ts` to call `store.deleteSession(token)` for server-side invalidation, in addition to clearing cookies
- [x] T018 [US1] Verify session token does NOT appear in URLs, response bodies, logs, or error messages anywhere in `src/auth/index.ts` (FR-012)

### Tests for User Story 1

- [x] T019 [P] [US1] Write test for session creation on login (verify UUID cookie, session row in DB) in `src/test/auth.test.ts`
- [x] T020 [P] [US1] Write test for session invalidation on logout (cookie works, logout, cookie rejected) in `src/test/auth.test.ts`
- [x] T021 [P] [US1] Write test for expired session rejection (create session with past expiresAt, verify 302 redirect) in `src/test/auth.test.ts`
- [x] T022 [P] [US1] Write test for tampered session token (non-UUID or nonexistent UUID → 302 redirect) in `src/test/auth.test.ts`
- [x] T023 [P] [US1] Write test for legacy cookie migration (set numeric cookie, verify upgraded to UUID, old session works) in `src/test/auth.test.ts`
- [x] T024 [P] [US1] Write test for concurrent sessions (two logins → two rows → logout from one → other still valid) in `src/test/auth.test.ts`

**Checkpoint**: Session-based auth is fully functional. Logout invalidates server-side. Legacy cookies are migrated. All existing tests still pass.

---

## Phase 4: User Story 2 - CSRF Protection for All State-Changing Requests (Priority: P1)

**Goal**: All POST/PATCH/PUT/DELETE requests require a valid `X-CSRF-Token` header matching the `learninator_csrf` cookie. GET requests are exempt.

**Independent Test**: POST to any state-changing route without CSRF token → 403. Same POST with valid CSRF token → succeeds.

### Implementation for User Story 2

- [x] T025 [US2] Create `generateCSRFToken()` helper (32+ random bytes, base64url-encoded) in new file `src/auth/csrf.ts`
- [x] T026 [US2] Create `csrfMiddleware` in `src/auth/csrf.ts` per contracts/README.md §3: reads `X-CSRF-Token` header and `learninator_csrf` cookie, returns 403 if missing or mismatched, skips validation for GET/HEAD
- [x] T027 [US2] Set `learninator_csrf` cookie on login/signup in `src/auth/index.ts` (T015/T016 already added basic cookie; this ensures the CSRF token is properly generated and stored in the session row alongside the session token)
- [x] T028 [US2] Add `<meta name="htmx-config" content='{"headers":{"X-CSRF-Token":"document.cookie.match(/learninator_csrf=([^;]+)/)[1]}}'>` to the base HTML layout in `src/views/shared.ts` (or whichever view exports the `<head>` / `<body>` wrapper) so htmx injects the CSRF header on all requests
- [x] T029 [US2] Wire `csrfMiddleware` into `createApp()` in `src/index.ts`: apply to all POST/PATCH/PUT/DELETE routes (either via `app.use("*", csrfMiddleware)` with method guard inside the middleware, or by placing it after `sessionMiddleware` with a method check)

### Tests for User Story 2

- [x] T030 [P] [US2] Write test for CSRF rejection (POST without X-CSRF-Token → 403) in new file `src/test/security/csrf.test.ts`
- [x] T031 [P] [US2] Write test for CSRF success (POST with matching token → 200/302) in `src/test/security/csrf.test.ts`
- [x] T032 [P] [US2] Write test for CSRF token mismatch (wrong value in header → 403) in `src/test/security/csrf.test.ts`
- [x] T033 [P] [US2] Write test for CSRF GET exemption (GET request without token → proceeds normally) in `src/test/security/csrf.test.ts`

**Checkpoint**: CSRF protection active on all state-changing routes. htmx forms work transparently via `hx-headers` meta. GET routes unaffected.

---

## Phase 5: User Story 3 - Rate Limiting on Auth Endpoints (Priority: P2)

**Goal**: POST /login is rate-limited to 10 req/60s per IP. POST /signup is rate-limited to 5 req/60s per IP. Rate limiter is bypassed when `rateLimiter` is `null` (test mode).

**Independent Test**: Send 11 rapid POSTs to /login → 11th returns rate-limit error. Same with 6 POSTs to /signup.

### Implementation for User Story 3

- [x] T034 [US3] Add rate limit check to `POST /login` in `src/auth/index.ts`: resolve IP from `c.req.header("x-forwarded-for")` or `c.req.header("host")` or `"127.0.0.1"`, call `rateLimiter.checkByKey(ip, "login", 10, 60000)`, return rate-limited HTML fragment if rejected
- [x] T035 [US3] Add rate limit check to `POST /signup` in `src/auth/index.ts`: call `rateLimiter.checkByKey(ip, "signup", 5, 60000)`, return rate-limited HTML fragment if rejected
- [x] T036 [US3] Add null-guard (`if (rateLimiter)` before checkByKey calls) to both login and signup handlers to preserve test-mode bypass

### Tests for User Story 3

- [x] T037 [P] [US3] Write test for login rate limiting (11 rapid POSTs → last returns error) in new file `src/test/security/rate-limiter.test.ts`
- [x] T038 [P] [US3] Write test for signup rate limiting (6 rapid POSTs → last returns error) in `src/test/security/rate-limiter.test.ts`
- [x] T039 [P] [US3] Write test for rate limit recovery (wait >60s, try again → succeeds) in `src/test/security/rate-limiter.test.ts`
- [x] T040 [P] [US3] Write test for rate limiter null bypass (with rateLimiter: null in createTestApp → no limiting) in `src/test/security/rate-limiter.test.ts`

**Checkpoint**: Auth endpoints are rate-limited. Brute-force attacks are impractical. Tests confirm rate limits and recovery.

---

## Phase 6: User Story 4 - Environment-Aware Secure Cookie Flag (Priority: P2)

**Goal**: `setCookie` calls include `secure: true` when `NODE_ENV === "production"`, `secure: false` otherwise.

**Independent Test**: With `NODE_ENV=production`, Set-Cookie header includes `; Secure`. Without it, the flag is absent.

### Implementation for User Story 4

- [x] T041 [US4] Verify the `SECURE_COOKIE` constant from T011 is used in all `setCookie` calls: login handler, signup handler, and legacy migration path in session middleware — `src/auth/index.ts`
- [x] T042 [US4] Ensure the CSRF cookie also respects `SECURE_COOKIE` in `src/auth/index.ts` (T015/T016 cookie calls)

### Tests for User Story 4

- [x] T043 [P] [US4] Write test for Secure flag in production (set NODE_ENV=production before createApp, verify Set-Cookie includes `; Secure`) in `src/test/auth.test.ts`
- [x] T044 [P] [US4] Write test for Secure flag absent in development (unset NODE_ENV, verify no `; Secure`) in `src/test/auth.test.ts`

**Checkpoint**: Cookies are marked Secure in production. Local development unaffected.

---

## Phase 7: User Story 5 - Expired Session Cleanup (Priority: P3)

**Goal**: Expired session rows are opportunistically deleted on every successful login.

**Independent Test**: Create a session with past `expiresAt`, trigger a different login, verify the expired row is deleted.

### Implementation for User Story 5

- [x] T045 [US5] Call `store.deleteExpiredSessions()` in `POST /login` handler in `src/auth/index.ts` after successful authentication (before creating the new session). This is a fire-and-forget call — no await needed, but await is fine for correctness.

### Tests for User Story 5

- [x] T046 [P] [US5] Write test for expired session cleanup on login (seed expired session row, log in with same or different user, verify expired row gone) in `src/test/auth.test.ts`

**Checkpoint**: Sessions table stays lean. Expired rows are cleaned up opportunistically.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T047 Run all existing tests (`npm test`) and verify zero regressions — all tests in `src/test/auth.test.ts`, `src/test/missions.test.ts`, `src/test/lessons.test.ts`, `src/test/chat.test.ts` must pass without modification (SC-008)
- [x] T048 Run quickstart.md validation scenarios to verify end-to-end behavior against the 5 manual verification steps
- [x] T049 Review session token handling: confirm token never appears in URLs, response bodies, log output, or error messages (FR-012)
- [x] T050 Verify `src/views/shared.ts` htmx config meta tag is rendered on every page (not just some) — test by viewing /, /missions, /settings, /browse and checking page source

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) can proceed in parallel (both P1)
  - US3 (Phase 5) and US4 (Phase 6) can proceed in parallel (both P2)
  - US5 (Phase 7) is independent but lowest priority (P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — No dependencies on other stories. This IS the MVP.
- **US2 (P1)**: Can start after Foundational — Depends on CSRF cookie being set in login/signup (US1 covers this in T015/T016), but can be developed in parallel using the same auth handler code. US1's session token creation and US2's CSRF token creation are co-located in login/signup.
- **US3 (P2)**: Can start after Foundational — Independent of US1/US2 (only touches login/signup handlers + rate-limiter.ts)
- **US4 (P2)**: Can start after Foundational — Trivially independent (cookie flag constant)
- **US5 (P3)**: Can start after Foundational — Independent (one line in login handler)

### Within Each User Story

- Store/interface changes before endpoint changes
- Implementation tasks before test tasks (tests verify behavior, not TDD for this feature)
- Core implementation before integration

### Parallel Opportunities

- T004, T005, T007, T009, T010: All foundational store/interface additions (different concerns)
- T019-T024: All US1 tests (different test cases in same file) — can write in parallel
- T030-T033: All US2 tests (new file) — can write in parallel
- T037-T040: All US3 tests (new file) — can write in parallel
- T043-T044: US4 tests (same file as US1) — can write in parallel
- US1 + US2 can be implemented simultaneously after Foundational (both P1)
- US3 + US4 can be implemented simultaneously after Foundational (both P2)

---

## Parallel Example: User Story 1

```bash
# Phase 3 implementation tasks (sequential due to dependencies):
Task: "T013 Rewrite sessionMiddleware in src/auth/index.ts"
Task: "T014 Add legacy cookie detection to sessionMiddleware in src/auth/index.ts"
Task: "T015 Rewrite POST /login handler in src/auth/index.ts"
Task: "T016 Rewrite POST /signup handler in src/auth/index.ts"
Task: "T017 Rewrite GET /logout handler in src/auth/index.ts"
Task: "T018 Verify no token leakage in src/auth/index.ts"

# Then launch all US1 test tasks together:
Task: "T019 Test session creation on login in src/test/auth.test.ts"
Task: "T020 Test session invalidation on logout in src/test/auth.test.ts"
Task: "T021 Test expired session rejection in src/test/auth.test.ts"
Task: "T022 Test tampered session token in src/test/auth.test.ts"
Task: "T023 Test legacy cookie migration in src/test/auth.test.ts"
Task: "T024 Test concurrent sessions in src/test/auth.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + US2)

1. Complete Phase 1: Setup (schema + migration) — T001-T003
2. Complete Phase 2: Foundational (store + rate limiter) — T004-T012
3. Complete Phase 3: US1 (session tokens) — T013-T024
4. Complete Phase 4: US2 (CSRF protection) — T025-T033
5. **STOP and VALIDATE**: Run `npm test`, verify all existing tests pass
6. This is the minimum shippable security hardening (session tokens + CSRF)

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 (both P1) → Deploy — session security + CSRF are the critical fixes
3. Add US3 → Rate limiting on auth → Deploy
4. Add US4 → Secure cookie flag → Deploy
5. Add US5 → Session cleanup → Deploy
6. Each story adds security without breaking previous stories

### Parallel Team Strategy

With multiple developers after Foundational:
- Developer A: User Story 1 (session tokens) — `src/auth/index.ts` + `src/test/auth.test.ts`
- Developer B: User Story 2 (CSRF) — `src/auth/csrf.ts` + `src/index.ts` wiring + `src/test/security/csrf.test.ts`
- Developer C: User Story 3 (rate limiting) — `src/auth/index.ts` login/signup changes + `src/test/security/rate-limiter.test.ts`

Coordination needed on `src/auth/index.ts` since US1, US2, and US3 all touch it. US1 should go first (largest rewrite), then US2 and US3 add CSRF cookie + rate limit checks on top.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 is the largest change — it rewrites the core auth middleware and route handlers
- The `login()` test helper in `src/test/helpers.ts` extracts `name=value` from Set-Cookie; should work transparently with UUID-format cookies
- All CSRF cookie constants use `learninator_csrf` as the cookie name per spec assumption
