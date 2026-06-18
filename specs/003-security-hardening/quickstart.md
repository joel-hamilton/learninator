# Quickstart: Security Hardening

## Prerequisites

- Node.js 22, npm dependencies installed
- SQLite database migrated (`npm run db:migrate`)
- Dev server running (`npm run dev`)

## Manual Validation Scenarios

### 1. Removed SSE Endpoint

```bash
# Start dev server, then:
# Attempt to connect to the old endpoint
curl -v http://localhost:3000/missions/1/chat/tool-events
# Expected: 404 Not Found
```

### 2. Input Length Limits

**Chat message too long**:
```bash
# Generate a 10,001 character string and POST it
LONG_MSG=$(python3 -c "print('x' * 10001)")
curl -s -X POST http://localhost:3000/missions/1/chat \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "message=$LONG_MSG"
# Expected: HTML fragment with error message, no AI call made
```

**Title too long**:
```bash
LONG_TITLE=$(python3 -c "print('x' * 201)")
curl -s -X PUT http://localhost:3000/missions/1/title \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "title=$LONG_TITLE"
# Expected: Error fragment, title not updated
```

**Feedback too long**:
```bash
LONG_FB=$(python3 -c "print('x' * 2001)")
curl -s -X POST http://localhost:3000/missions/1/lessons/1/feedback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "rating=good&feedbackText=$LONG_FB"
# Expected: Error fragment
```

**Valid inputs accepted**:
```bash
# Chat at exact limit (10,000 chars)
MSG_10K=$(python3 -c "print('x' * 10000)")
curl -s -X POST http://localhost:3000/missions/1/chat \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "message=$MSG_10K"
# Expected: Normal response (AI may error, but no "too long" rejection)
```

### 3. Rate Limiting

Send 21 rapid chat requests and verify the 21st is rejected:

```bash
for i in $(seq 1 21); do
  echo "Request $i:"
  curl -s -X POST http://localhost:3000/missions/1/chat \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "message=test" | head -c 100
  echo
done
# Expected: First 20 processed, 21st returns rate-limit error fragment
```

Wait 60 seconds, then send again — should be accepted (window slides).

## Automated Tests

```bash
# Run all tests
npm test

# Run security-specific tests
npx vitest run src/test/security.test.ts
```

### Test Coverage Checklist

- [ ] Old SSE endpoint returns 404
- [ ] `streamSSE` import still present (used by `/workflows/events`)
- [ ] Client-side EventSource removed from fragments.ts
- [ ] `tool-banner` test references removed from workflow-visibility.test.ts
- [ ] Chat input > 10,000 chars rejected with error fragment
- [ ] Chat input ≤ 10,000 chars accepted
- [ ] Title > 200 chars rejected
- [ ] Title ≤ 200 chars accepted
- [ ] Feedback > 2,000 chars rejected
- [ ] Feedback ≤ 2,000 chars accepted
- [ ] Rate limiter rejects after 20 chat requests in 1 minute
- [ ] Rate limiter accepts after window slides
- [ ] Rate limiter does not count rejected (oversized) inputs
- [ ] Rate limiter is bypassed when `rateLimiter` is null (test mode)
- [ ] Error fragments are well-formed HTML (htmx-compatible)
