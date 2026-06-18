# Research: Server Observability

**Feature**: Server Observability | **Date**: 2026-06-18

## Decision 1: Root cause of 58s vs 1ms timing discrepancy

**Decision**: The existing logging middleware (`src/index.ts:56-61`) measures `Date.now()` around `await next()`, which only captures the time to create and return the `Response` object from the handler. For streaming responses (SSE on `/workflows/events`, `/missions/:id/chat/events`), the handler returns a Response with a `ReadableStream` body near-instantly, but the stream remains open for minutes. The server log reports the handler-completion time (1ms), while the browser measures total request duration including stream lifetime (58s).

**Rationale**: Confirmed by tracing the code: `conversationLoop()` returns a text result, but SSE endpoints like `/workflows/events` create a `new Response(stream)` where the stream stays open indefinitely. Hono middleware's `await next()` resolves when the handler returns the Response — not when the body is consumed.

**Alternatives considered**:
- Network-level delay: Ruled out — the app runs on localhost, so network latency is sub-1ms.
- Middleware queuing: Possible contributor but not the primary cause. Even with queuing, middleware delays would appear in the `Date.now()` measurement.

## Decision 2: Measuring full response write time

**Decision**: After `await next()` returns, inspect the response body. If it's a `ReadableStream`, wrap it in a new `ReadableStream` that calls `logger.debug()` when the stream's `cancel()` or final `read()` completes (the `done: true` signal). Replace `c.res` with a new `Response` containing the wrapped body and the same status/headers. For non-streaming responses (strings, `Uint8Array`), the response is fully materialized when `await next()` returns — no wrapping needed.

**Rationale**: This approach captures stream lifetime without modifying `@hono/node-server` internals. The ReadableStream API provides the `done: true` signal that fires when the stream is fully consumed. Wrapping at the `Response` level keeps the instrumentation self-contained within the middleware.

**Alternatives considered**:
- Hook into Node.js `ServerResponse` 'close' event: Requires accessing the raw Node.js response object, which is not exposed through Hono's context API. Would need to monkey-patch `serve()` or access internal state.
- Wrap `app.fetch` globally: Would work but would duplicate the middleware chain concept. Harder to get per-request context (logger, request ID) into the wrapper.
- Use `performance.now()` with `PerformanceObserver`: Too heavy; Node.js performance APIs are designed for larger-scale tracing.

## Decision 3: Request ID generation

**Decision**: Use `crypto.randomUUID().slice(0, 8)` for per-request IDs. Include the ID as both a response header (`X-Request-ID`) and in every debug log line.

**Rationale**: Node.js 22 has `crypto.randomUUID()` built-in — zero dependencies. 8 hex chars (32 bits) gives 4 billion unique values, far exceeding what's needed for a single dev server's active request pool. Sufficiently unique for log correlation within a server session.

**Alternatives considered**:
- nanoid: Popular but requires a dependency. Overkill for 8-char IDs.
- Incremental counter: Simple but collisions across server restarts; less useful for log grep.
- Full UUID: 36 chars clutters log output. 8 chars is enough for concurrent request disambiguation.

## Decision 4: Profile data structure and memory bounding

**Decision**: Store profile data in a `Map<string, EndpointProfile>` where key is `${method}:${routePattern}`. Route patterns are derived from `c.req.routePath` (Hono provides the matched route pattern, e.g., `/missions/:missionId/chat`). Memory is bounded at 500 unique entries; when exceeded, the least-frequently-hit entries are evicted. Each entry stores the last 10 slowest request URLs and durations.

**Rationale**: `c.req.routePath` gives the route pattern directly — no regex or custom matching needed. 500 entries × ~2KB each = ~1MB max memory. Eviction by frequency (not LRU) ensures the most active endpoints stay tracked.

**Alternatives considered**:
- Exact URL tracking: Would create unbounded entries for parameterized URLs (e.g., `/missions/42/chat` vs `/missions/99/chat`). Route patterns aggregate meaningfully.
- LRU eviction: Would evict endpoints that get hit steadily but infrequently. Frequency-based ensures the "working set" of actively profiled endpoints stays.
- No bounding: Memory risk for long-running dev sessions with many unique routes.

## Decision 5: Profile route authentication

**Decision**: The profile report route (`/debug/profile`) is only registered when `PROFILE` is truthy. It requires the user to be logged in (via `auth.requireAuth` middleware). No additional role check — the assumption is that all authenticated users in dev/test environments are developers.

**Rationale**: Aligns with FR-007 (non-production or authenticated access). Since this is a dev tool, not a production feature, login gating is proportional. No need for an admin role system.

**Alternatives considered**:
- No auth at all: Risk of leaking endpoint timing data in shared dev environments.
- Separate admin password: Over-engineered for a dev tool.
- IP restriction: Doesn't work for localhost development.
