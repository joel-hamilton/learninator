# Quickstart: Harden Session Auth

## Prerequisites

- Node.js 22, npm install complete
- Test database migrations up to date: `npm run db:migrate`

## Run the tests

```bash
# Full test suite
npm test

# Specific test files after implementation
npm test -- --reporter=verbose src/test/auth.test.ts
npm test -- --reporter=verbose src/test/security/csrf.test.ts
npm test -- --reporter=verbose src/test/security/rate-limiter.test.ts
```

## Manual verification scenarios

### 1. Session invalidation on logout

```bash
# Start the app
npm run dev
```

1. Open http://localhost:3000, sign up with `test@example.com` / `password123`
2. Confirm you land on the dashboard
3. Open browser dev tools → Application → Cookies → copy `learninator_sid` value
4. Click Logout
5. Verify `learninator_sid` cookie is cleared
6. In dev tools console: `document.cookie = "learninator_sid=<PASTED_VALUE>; path=/"`
7. Navigate to http://localhost:3000/missions → should redirect to `/login`

### 2. CSRF protection

1. Log in
2. Open dev tools → Application → Cookies → copy `learninator_csrf` value
3. In dev tools console:
   ```js
   fetch('/missions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: 'title=test'
   })
   ```
4. Should receive 403 Forbidden
5. Repeat with correct header:
   ```js
   fetch('/missions', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/x-www-form-urlencoded',
       'X-CSRF-Token': '<COPIED_CSRF_TOKEN>'
     },
     body: 'title=test'
   })
   ```
6. Should succeed

### 3. Secure cookie in production

```bash
NODE_ENV=production npm run dev
```

1. Open http://localhost:3000 (note: HTTP, so browser won't send it — check the Set-Cookie header in dev tools Network tab)
2. Login → inspect Set-Cookie response header → should include `; Secure`

### 4. Rate limiting on login

```bash
# In terminal, rapid-fire 11 POSTs to /login
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/login \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=test@example.com&password=wrong"
done
# The 11th response should be non-200 (rate limited)
```

### 5. Legacy cookie migration

1. Log in with the old cookie format by directly inserting a user and setting the old cookie:
   ```bash
   # Start app, then use a SQLite client to:
   # INSERT INTO users (email, password_hash, name) VALUES ('legacy@test.com', '...', 'Legacy');
   # Then in browser console: document.cookie = "learninator_sid=1; path=/"
   ```
2. Navigate to any protected page → cookie should be upgraded to UUID format
3. Check Application → Cookies → `learninator_sid` is now a UUID
4. Also check `learninator_csrf` is set

## Expected test output

After full implementation, all test suites should pass:

```
✓ src/test/auth.test.ts (X tests)
✓ src/test/missions.test.ts (X tests)
✓ src/test/lessons.test.ts (X tests)
✓ src/test/chat.test.ts (X tests)
✓ src/test/security/csrf.test.ts (X tests)
✓ src/test/security/rate-limiter.test.ts (X tests)
```

No existing tests should require modification except possibly the login helper if the cookie format change affects cookie parsing in tests (the `login()` helper already extracts the full `name=value` string so it should work transparently).
