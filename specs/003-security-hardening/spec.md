# Feature Specification: Security Hardening

**Feature Branch**: `003-security-hardening`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Security Hardening — remove insecure SSE tool-events endpoint, add server-side input length limits, add in-memory rate limiting on AI endpoints"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Insecure SSE Tool-Events Endpoint (Priority: P1)

Any authenticated user can currently subscribe to another user's mission tool-call events by guessing mission IDs, because the `/missions/:missionId/chat/tool-events` SSE endpoint has no ownership check. This endpoint is also redundant: the workflow visibility feature already provides a properly user-scoped `/workflows/events` SSE stream.

**Why this priority**: This is an active security vulnerability — an information leak that exposes internal AI tool-call data across user boundaries. It must be closed first.

**Independent Test**: Attempt to connect to `GET /missions/:missionId/chat/tool-events` and confirm it returns 404. Verify no client code references the removed endpoint. Verify the `/workflows/events` endpoint remains functional as the sole SSE stream.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they send a GET request to `/missions/any-mission-id/chat/tool-events`, **Then** the server returns a 404 Not Found response.
2. **Given** the codebase after endpoint removal, **When** searching for references to `tool-events`, `tool-banner`, or `streamSSE` (if no longer needed), **Then** no dead code paths, unused imports, or stale client-side handlers remain.
3. **Given** the workflow visibility feature, **When** a user connects to `/workflows/events`, **Then** they receive their own scoped workflow events as before.

---

### User Story 2 - Server-Side Input Length Limits (Priority: P1)

A malicious or buggy client can send extremely large text inputs — 10MB chat messages, giant topic titles, oversized feedback — consuming server resources, inflating AI API costs, or filling the database with garbage. Server-side length validation must reject oversized inputs before they reach the AI client or database.

**Why this priority**: Prevents resource exhaustion and API cost abuse. Without this, any authenticated user can waste tokens or corrupt data with arbitrarily large inputs.

**Independent Test**: Submit inputs exceeding the defined limits to each protected endpoint. Confirm the server rejects with a user-friendly HTML error fragment. Confirm inputs at or below the limit are accepted normally.

**Acceptance Scenarios**:

1. **Given** an authenticated user in a mission chat, **When** they submit a chat message longer than 10,000 characters, **Then** the server returns an htmx-compatible HTML error fragment stating the message is too long, and no AI call is made.
2. **Given** an authenticated user creating or editing a mission, **When** they submit a topic/title longer than 200 characters, **Then** the server returns a user-friendly error fragment and the value is not persisted.
3. **Given** an authenticated user submitting lesson feedback, **When** the feedback text exceeds 2,000 characters, **Then** the server returns a user-friendly error fragment and no AI call is made.
4. **Given** an authenticated user saving lesson notes, **When** the notes exceed 1,000 characters, **Then** the server returns a user-friendly error fragment and the notes are not persisted.
5. **Given** an authenticated user submitting text at the exact limit, **When** the input is exactly 10,000 characters (chat), 200 characters (title), 2,000 (feedback), or 1,000 (notes), **Then** the request is accepted and processed normally.

---

### User Story 3 - In-Memory Rate Limiting on AI Endpoints (Priority: P2)

Without rate limiting, a user can flood the chat or lesson generation endpoints and rack up AI API costs with no restriction. A simple per-user sliding-window rate limiter should cap requests to AI-backed endpoints and return a friendly htmx error fragment when the limit is hit.

**Why this priority**: Protects against API cost abuse. Lower priority than the input limits because it's a cost-management concern rather than a direct security vulnerability, but still important for a multi-user tool.

**Independent Test**: Send requests at rates exceeding the configured limits and verify rejection with an htmx error fragment. Verify normal usage below the limit is unaffected. Verify limits reset correctly after the window slides.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they send more than 20 chat messages within a 1-minute sliding window, **Then** subsequent chat requests return an htmx-compatible HTML error fragment stating they are rate limited, and no AI call is made.
2. **Given** an authenticated user, **When** they send more than 10 lesson generation requests within a 1-minute sliding window, **Then** subsequent generation requests return an htmx error fragment.
3. **Given** an authenticated user, **When** they send more than 5 mission creation requests within a 1-minute sliding window, **Then** subsequent creation requests return an htmx error fragment.
4. **Given** a rate-limited user, **When** the sliding window passes and their request count drops below the limit, **Then** normal requests resume without intervention.
5. **Given** a user who has never hit the rate limit, **When** they make a request, **Then** no rate-limit overhead or delay is perceptible (zero-cost when not triggered).

---

### Edge Cases

- What happens when a request's body is exactly at the character limit — accepted or rejected? (Accepted.)
- What happens when a user sends a request that is both oversized AND would hit the rate limit? (Input length is checked first; rate limit counter is not incremented for rejected inputs.)
- How does the rate limiter behave across server restarts? (Counters reset to zero — ephemeral data is acceptable for a single-server dev tool.)
- What happens when multiple users share the same IP or device? (Rate limiting is per-user-ID, not per-IP, so they are tracked independently.)
- What happens if the session middleware rejects a request (unauthenticated)? (Rate limiting and input validation only apply after authentication — the session middleware returns 401/redirect first.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove the `GET /missions/:missionId/chat/tool-events` route and return 404 for any request to it.
- **FR-002**: System MUST audit and remove all code references to the deleted endpoint (unused `streamSSE` imports, dead `tool-banner` references, stale client-side handlers).
- **FR-003**: System MUST reject chat messages exceeding 10,000 characters with a user-friendly HTML error fragment before any AI API call is made.
- **FR-004**: System MUST reject mission topic/title inputs exceeding 200 characters with a user-friendly HTML error fragment.
- **FR-005**: System MUST reject lesson feedback text exceeding 2,000 characters with a user-friendly HTML error fragment.
- **FR-006**: System MUST reject lesson notes exceeding 1,000 characters with a user-friendly HTML error fragment.
- **FR-007**: System MUST enforce a per-user sliding-window rate limit of 20 requests per minute on chat endpoints (`POST /missions/:id/chat`, `POST /chat/:missionId`).
- **FR-008**: System MUST enforce a per-user sliding-window rate limit of 10 requests per minute on lesson generation endpoints.
- **FR-009**: System MUST enforce a per-user sliding-window rate limit of 5 requests per minute on mission creation endpoints.
- **FR-010**: Rate-limited responses MUST be htmx-compatible HTML error fragments (not bare HTTP 429 status codes).
- **FR-011**: Rate limiter MUST have negligible performance impact when limits are not triggered (no database queries, no external service calls).
- **FR-012**: Rate limiter data MUST be in-memory only (ephemeral, reset on server restart).
- **FR-013**: Rate limiter and input validator MUST be injectable via the `createApp()` factory pattern for testability (per Constitution I).
- **FR-014**: System MUST apply input length validation before rate limit counting — oversized inputs are rejected without consuming rate limit quota.

### Key Entities

- **Rate Limit Entry**: An in-memory record mapping a user ID to a list of request timestamps within the sliding window. Ephemeral only — not persisted to the database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Requests to the removed `/missions/:missionId/chat/tool-events` endpoint return 404 with zero server-side processing beyond routing.
- **SC-002**: All user-submitted inputs exceeding defined limits are rejected before reaching the AI API or database, with a user-visible error message.
- **SC-003**: Rate-limited users receive a human-readable error message instead of a raw HTTP status code, displayed inline via htmx without a full page reload.
- **SC-004**: Normal (non-rate-limited) request latency increases by less than 1ms attributable to rate limit and input validation checks.
- **SC-005**: All three features (endpoint removal, input limits, rate limiting) have passing integration tests via `app.request()` covering both acceptance and rejection paths.

## Assumptions

- The application runs on a single server; distributed rate limiting is unnecessary. In-memory state reset on restart is acceptable.
- The existing session middleware runs before security middleware, so `c.get("user")` is always available when validation or rate limiting executes.
- The `streamSSE` helper is only used by the tool-events endpoint and can be removed if no other consumers exist after the endpoint is deleted.
- Character limits count Unicode code points (`.length`), not bytes or grapheme clusters. The proposed limits are generous enough that legitimate UTF-8 multi-byte characters won't cause unexpected truncation.
- The workflow visibility SSE endpoint (`/workflows/events`) is already properly scoped to the authenticated user and requires no changes in this feature.
