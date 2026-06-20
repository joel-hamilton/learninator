# Feature Specification: Rate Limiter Middleware

**Feature Branch**: `028-rate-limiter-middleware`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: Rate limiter as middleware — consolidate duplicated rate-limit guard pattern across route handlers

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Developer adds new rate-limited route without writing guard boilerplate (Priority: P1)

A developer creating a new POST route that needs rate limiting can declare the limit as part of the route's middleware chain instead of copying an inline guard block into the handler body. The rate limiting behavior is applied before the handler runs, so the handler only contains business logic.

**Why this priority**: Removing the duplication from the 6 existing guards is the primary goal. Making future rate-limited routes easier to add is a compounding benefit that prevents re-introduction of the pattern.

**Independent Test**: A route with a middleware-declared rate limit of 1 request per minute returns successfully on the first request and returns a rate-limited response on the second request within the same window. A route without the middleware is not affected.

**Acceptance Scenarios**:

1. **Given** a POST route with a middleware-declared rate limit of N requests per M seconds, **When** a request arrives within the limit, **Then** the handler executes normally and returns the expected response.
2. **Given** the same route, **When** a request arrives after the limit has been exceeded, **Then** the response indicates the request was rate-limited and the handler does not execute.
3. **Given** a route that does not have the middleware, **When** any number of requests arrive, **Then** none are rate-limited by this system.

---

### User Story 2 — Developer reads a route file and sees rate limiting declared in the route chain (Priority: P2)

A developer reviewing route files can immediately see which routes are rate-limited and what the limits are by reading the middleware declarations in the route chain, without scanning handler bodies for guard blocks.

**Why this priority**: Declarative middleware improves readability and makes the rate limit policy explicit at the routing level, reducing the chance of accidentally creating a route without rate limiting.

**Independent Test**: A route file that previously contained inline guard blocks now has rate limiting declared as middleware in the route chain. The handler body no longer contains rate-limit logic.

**Acceptance Scenarios**:

1. **Given** a route file containing a POST handler, **When** the handler requires rate limiting, **Then** the rate limit is declared as part of the route's middleware chain, not inside the handler body.
2. **Given** a route file with multiple POST handlers, **When** each has a different rate limit, **Then** each route's middleware chain declares its own limit independently.

---

### User Story 3 — Rate-limited route behaves correctly when rate limiter is disabled (Priority: P3)

The existing behavior where the rate limiter can be disabled (e.g., in test mode or local development) is preserved. When the rate limiter is not configured, the middleware passes all requests through without rate limiting, maintaining parity with the current guard pattern's null-check behavior.

**Why this priority**: Preserving the existing testability contract is important for not breaking the test suite, but this is inherently handled by the fact that the middleware simply reads `rateLimiter` from context (which is already null in tests).

**Independent Test**: When the application is started without a rate limiter configured, requests to rate-limited routes always succeed regardless of frequency. The existing test for this behavior passes without modification.

**Acceptance Scenarios**:

1. **Given** the application running without a rate limiter, **When** a rate-limited route receives multiple rapid requests, **Then** all requests succeed.
2. **Given** the application running with a rate limiter, **When** a rate-limited route exceeds its limit, **Then** rate-limited responses are returned.

### Edge Cases

- What happens when a developer applies the middleware to a non-POST route? The middleware should still function correctly but is typically only needed for POST/submission endpoints.
- How does the middleware interact with other middleware in the chain? It must be order-independent — it either passes through (within limits) or short-circuits with the rate-limited response.
- What if two route files use the same action name with different limits? Each route's middleware instance carries its own parameters, so they are independent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Rate limiting must be declarable as Hono middleware applied to individual routes or groups of routes.
- **FR-002**: The middleware must accept parameters for the action name, maximum request count, and time window.
- **FR-003**: The middleware must read the rate limiter instance from context and pass requests through to the handler when within the limit.
- **FR-004**: When the limit is exceeded, the middleware must short-circuit and return the rate-limited response without executing the handler.
- **FR-005**: When the rate limiter is not configured (null), the middleware must pass all requests through without rate limiting.
- **FR-006**: The rate-limited response component must be either importable from the middleware module or configurable by the caller.
- **FR-007**: All existing inline guard blocks in route handlers must be replaced with middleware declarations.
- **FR-008**: Auth routes (login/signup in `auth/index.ts`) using IP-based rate limiting via `checkByKey` are explicitly out of scope for this middleware change. The middleware is designed for user-id-based route protection; the IP-based pattern serves a different purpose (brute-force protection) and would require separate design consideration.

### Key Entities *(include if feature involves data)*

- **Rate-limited route**: A route that has rate limiting middleware applied.
- **Rate limit configuration**: The combination of action name, maximum request count, and time window that defines a rate limit.
- **Rate-limited response**: The HTML fragment returned when a request has exceeded the rate limit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 6 existing inline rate-limit guard blocks are eliminated from route handler bodies and replaced by middleware declarations.
- **SC-002**: Every rate-limited route has its limit declared in an immediately visible location (the route chain), not hidden inside the handler body.
- **SC-003**: The existing test suite continues to pass without modification to any rate-limiter-related tests.
- **SC-004**: A new route can be made rate-limited by adding one line of middleware configuration — no handler-body guard block needed.
- **SC-005**: The middleware is the single source of truth for rate-limit enforcement across all routes that use it.

## Assumptions

- The existing `rateLimitedFragment()` function from the security module will be reused rather than recreated.
- All 6 inline guard blocks use the same guard structure (`const rateLimiter = c.get("rateLimiter"); if (rateLimiter && !rateLimiter.check(...))`) making them suitable candidates for uniform replacement.
- The auth routes (`auth/index.ts`) use a structurally different rate-limiting approach (IP-based) and will be assessed separately for potential migration.
- The middleware should preserve the existing behavior where an unconfigured (null) rate limiter passes all requests through without limitation.
- The middleware should not introduce any change to rate limit thresholds or action names — only the mechanism of application changes.
