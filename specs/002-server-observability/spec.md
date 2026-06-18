# Feature Specification: Server Observability

**Feature Branch**: `002-server-observability`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "I want to increase observability into what my app is doing. Currently there's a bug where endpoint calls are resolving slowly or not at all, and I have little visibility into what's happening. Running with DEBUG=1 doesn't actually seem to improve the logging at all. Can we dramatically increase the amount of debug logging done, and maybe add a PROFILE env variable too that creates a simple report of endpoint stats since the server was started? Something is weird here where devtools tells me that GET /records took 58s to resolve, and my server logs are saying we responded in 1ms"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diagnose Slow Requests with Rich Debug Logging (Priority: P1)

A developer is investigating why the app feels sluggish. They set `DEBUG=1` and restart the server. Every incoming HTTP request now emits structured log lines showing: when the request arrived, when each middleware completed, when the route handler started and finished, and when the response was fully sent (including time spent writing the body). Each log line includes elapsed milliseconds since request start, so the developer can immediately identify which phase is consuming time.

**Why this priority**: Without per-phase timing data, the developer cannot distinguish between slow route handlers, slow middleware, slow response serialization, or network-level issues. This is the foundational capability that makes all other debugging possible — including diagnosing the 58s-vs-1ms discrepancy reported in the issue.

**Independent Test**: Start the server with `DEBUG=1`, make a single HTTP request to any endpoint, and observe structured log output showing at least request-arrival, handler-duration, and response-sent timestamps with elapsed milliseconds.

**Acceptance Scenarios**:

1. **Given** the server is started with `DEBUG=1`, **When** a GET request is made to `/missions`, **Then** the server logs at minimum: request received (with method, path, and timestamp), handler start, handler complete (with duration ms), and response sent (with total ms from request arrival).
2. **Given** the server is started without `DEBUG=1`, **When** a GET request is made, **Then** the server does NOT emit per-request timing logs (only errors and essential startup messages as before).
3. **Given** debug logging is enabled and a request passes through multiple middleware, **When** any middleware takes more than 10ms, **Then** that middleware's elapsed time is highlighted or flagged in the log output.

---

### User Story 2 - View Accumulated Endpoint Performance Report (Priority: P2)

A developer wants a quick overview of which endpoints are slowest without tailing logs. They set `PROFILE=1` (or hit a profiling endpoint) and the server exposes accumulated timing statistics for every endpoint hit since server start: request count, total time, average time, min, max, and the last N slowest requests with their full URL and duration. The report is viewable as a simple text table at a dedicated route (e.g., `/debug/profile`).

**Why this priority**: While P1 gives real-time per-request insight, a cumulative report lets developers spot patterns — endpoints that are consistently slow, endpoints with high variance, or endpoints that have degraded over time. This is the "dashboard" view that complements the "tail" view from P1.

**Independent Test**: Start the server with `PROFILE=1`, make several requests to different endpoints with varying response times, then visit the profile report route and verify it shows per-endpoint stats (count, avg, min, max) matching the requests made.

**Acceptance Scenarios**:

1. **Given** the server is started with `PROFILE=1` and no requests have been made, **When** the developer visits the profile report, **Then** an empty report is shown with a message indicating no data yet.
2. **Given** the server has PROFILE enabled and 5 requests have been made to `/missions` (taking 12ms, 15ms, 8ms, 45ms, 14ms), **When** the developer views the report, **Then** `/missions` shows: count=5, avg=18.8ms, min=8ms, max=45ms.
3. **Given** PROFILE is not enabled, **When** the developer attempts to access the profile report, **Then** the route returns a message indicating profiling is disabled and how to enable it.

---

### User Story 3 - Identify Timing Discrepancies Between Browser and Server (Priority: P3)

A developer notices that browser devtools reports a request taking 58 seconds, while server logs claim 1ms. With debug logging enabled, the developer can see whether the server spent time in phases not previously measured (request body parsing, response streaming, connection queuing). If the discrepancy persists, the server emits a warning when the server-measured duration differs drastically from what the client would perceive (e.g., when the response is written but the connection is not fully closed).

**Why this priority**: This directly addresses the specific bug that triggered this feature. Once P1 and P2 are in place, P3 adds targeted diagnostics for the exact failure mode described. It can be tested independently by simulating a slow client connection.

**Independent Test**: Simulate a client that reads responses slowly (or pause after receiving headers), observe that the server's debug logs flag the discrepancy between "handler complete" time and "response fully sent" time.

**Acceptance Scenarios**:

1. **Given** debug logging is enabled, **When** a response body takes more than 5x the handler execution time to be fully written to the client, **Then** the server emits a warning log identifying the specific phases and their durations.
2. **Given** debug logging is enabled, **When** a request's total server-measured time is under 10ms, **Then** the server logs include a note that "server-side timing complete — client-perceived latency may differ due to network/connection factors."

---

### Edge Cases

- What happens when a request's body is large (e.g., file upload)? Debug logs should include body-read duration as a separate phase.
- What happens under high concurrency (many simultaneous requests)? Log output must remain readable — each log line must include a request ID so lines from different requests can be correlated.
- What happens when the profile data structure grows very large (many unique endpoints)? Memory usage should be bounded — either by capping the number of tracked endpoints or by aggregating less-frequent paths.
- What happens when the server shuts down? If PROFILE is enabled, a final summary report should be printed to stdout before exit.
- What happens with streaming responses (SSE)? Debug logging should note when a response switches to streaming mode and log the duration the stream was held open.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST emit structured per-request log lines when the `DEBUG` environment variable is set to a truthy value (`1`, `true`, or `yes`).
- **FR-002**: Each debug log line MUST include: a unique request identifier, elapsed milliseconds since the request arrived at the server, the phase name (e.g., `request-received`, `handler-start`, `handler-end`, `response-sent`), the HTTP method, and the request path.
- **FR-003**: System MUST measure and log at minimum these phases: time of request arrival, time handler execution begins, time handler execution completes, and time the response is fully written to the socket.
- **FR-004**: System MUST NOT emit per-request debug log lines when `DEBUG` is not set — normal operation must produce only startup messages and error logs.
- **FR-005**: System MUST track per-endpoint timing statistics (request count, total duration, minimum duration, maximum duration) when the `PROFILE` environment variable is set to a truthy value.
- **FR-006**: System MUST expose accumulated profiling statistics as a human-readable report at a dedicated route when `PROFILE` is enabled.
- **FR-007**: The profile report MUST be accessible only in non-production environments or must require authentication to prevent information disclosure.
- **FR-008**: Debug logging MUST include a per-request identifier (short alphanumeric string) that appears in every log line for that request, enabling correlation in concurrent request scenarios.
- **FR-009**: System SHOULD emit a warning-level log when the total server-measured request duration exceeds the handler execution duration by a factor of 5x or more, indicating potential response-streaming or connection-level delays.

### Key Entities

- **Request Timing Record**: Captures a single HTTP request lifecycle — identified by a unique request ID, includes method, path, arrival timestamp, and durations for each measured phase (middleware, handler, response write).
- **Endpoint Profile Entry**: Accumulated statistics for one URL pattern — includes request count, total time, average, minimum, maximum durations, and a bounded list of the most recent slow requests with their individual durations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can identify which phase (middleware, handler, or response write) consumes the most time for any given request by reading at most 6 lines of debug log output.
- **SC-002**: When a request's browser-reported time exceeds its server-measured handler time by more than 1 second, the server logs identify at least one actionable data point about where that time was spent.
- **SC-003**: The profile report returns in under 100ms for up to 1,000 tracked endpoints.
- **SC-004**: Enabling DEBUG logging adds less than 2ms overhead per request (measured as wall-clock difference with DEBUG on vs off for identical requests).
- **SC-005**: A developer can diagnose the 58s-vs-1ms discrepancy described in the feature request by enabling DEBUG and reproducing the issue, without needing to modify application code to add temporary instrumentation.

## Assumptions

- The discrepancy between browser-reported 58s and server-reported 1ms is likely caused by: (a) response body streaming time not being measured in the current timing, (b) middleware queuing before the handler timer starts, or (c) connection-level backpressure from the client. The debug logging covers all three hypotheses.
- The profile report is for developer use only — not intended as a production monitoring solution. Production monitoring would use external APM tools.
- "Endpoint" for profiling purposes is defined by HTTP method + route pattern (e.g., `GET /missions/:id`), not by exact URL with varying parameters.
- The project uses Hono as its web framework. Debug middleware can be implemented as Hono middleware that wraps the request lifecycle.
- Truthy values for DEBUG and PROFILE follow common convention: `1`, `true`, `yes` (case-insensitive).
