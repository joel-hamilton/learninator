# Quickstart: Server Observability

**Feature**: Server Observability | **Date**: 2026-06-18

## Prerequisites

- Node.js 22, npm install complete
- Server running locally (`npm run dev`)

## Enabling Debug Logging

1. Start the server with DEBUG enabled:
   ```bash
   DEBUG=1 npm run dev
   ```

2. Make a request to any endpoint:
   ```bash
   curl http://localhost:3000/
   ```

3. Observe structured log output in the terminal:
   ```
   [http] [req:a3f2c1b9] → GET / (0ms)
   [http] [req:a3f2c1b9] handler-start GET / (0ms)
   [http] [req:a3f2c1b9] handler-end GET / (12ms)
   [http] [req:a3f2c1b9] response-sent GET / — 12ms total, body 0ms
   ```

4. Verify that each line includes the request ID (`req:a3f2c1b9`), the phase name, HTTP method, path, and elapsed ms.

## Testing the Timing Discrepancy Fix (P3)

1. With DEBUG enabled, trigger a streaming endpoint:
   ```bash
   curl http://localhost:3000/workflows/events
   ```

2. Observe that the log now shows two phases:
   ```
   [http] [req:b4d5e6f7] handler-end GET /workflows/events (1ms) ← handler returned
   [http] [req:b4d5e6f7] stream-start GET /workflows/events (1ms)  ← stream begins
   [http] [req:b4d5e6f7] stream-end GET /workflows/events — 58423ms total (stream was open 58422ms)
   ```

3. Verify the "stream was open" time matches what the browser devtools reports. If the handler takes 1ms and the stream stays open 58s, the log now captures both numbers.

## Enabling Profiling

1. Start the server with PROFILE enabled:
   ```bash
   PROFILE=1 npm run dev
   ```

2. Make several requests to different endpoints:
   ```bash
   curl http://localhost:3000/
   curl http://localhost:3000/missions
   curl http://localhost:3000/missions
   curl http://localhost:3000/settings
   ```

3. View the profile report (authenticated):
   ```bash
   # First log in to get a session cookie, then:
   curl -b "learninator_sid=<session_id>" http://localhost:3000/debug/profile
   ```

4. Expected output (HTML page):
   ```
   Endpoint                          Count   Avg     Min     Max
   ─────────────────────────────────────────────────────────────
   GET /                             1       12ms    12ms    12ms
   GET /missions                     2       15ms    8ms     22ms
   GET /settings                     1       5ms     5ms     5ms
   ```

## Verifying No Overhead When Disabled

1. Start without env vars:
   ```bash
   npm run dev
   ```

2. Make requests and verify no per-request debug lines appear (only `[http]` startup messages).
3. Verify `/debug/profile` returns 404 or "profiling disabled" message.

## Running Tests

```bash
npm test -- --run src/test/observability.test.ts
```

Expected tests:
- Debug middleware emits structured log lines when DEBUG=1
- Debug middleware is silent when DEBUG is not set
- Request ID appears in all log lines for a request
- Profile store accumulates endpoint stats correctly
- Profile report returns HTML with correct stats
- Profile report rejects unauthenticated requests
- Streaming response timing captures stream duration separately from handler duration
- Memory eviction triggers when profile store exceeds 500 entries
