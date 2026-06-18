# Tasks: Server Observability

**Input**: Design documents from `/specs/002-server-observability/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the quickstart.md specifies expected test coverage for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project: `src/` and `src/test/` at repository root. New module at `src/observability/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directory structure for the new observability module

- [x] T001 Create `src/observability/` directory and `src/observability/index.ts` with an empty `createObservability()` placeholder that returns a no-op middleware

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core enhancements that all user stories depend on — enriched logger and type extensions

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Enhance `createLogger()` in `src/logger.ts` to emit ISO-8601 timestamps and support an optional `requestId` parameter in debug/info/warn/error methods (appended as `[req:xxxx]` prefix when provided)
- [x] T003 [P] Add `profileStore` and `debugConfig` types to `AppVariables` in `src/types.ts` (`profileStore: ProfileStore | null`; `debugConfig: { enabled: boolean; requestId: string } | null`)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Diagnose Slow Requests with Rich Debug Logging (Priority: P1)

**Goal**: When DEBUG=1, every HTTP request emits structured log lines showing request arrival, handler start/end, and response-sent with elapsed milliseconds

**Independent Test**: Start server with `DEBUG=1`, make one GET request, observe structured log output with request ID, method, path, phase names, and elapsed ms

### Tests for User Story 1

- [x] T004 [P] [US1] Write integration tests in `src/test/observability.test.ts` — test that DEBUG=1 emits structured log lines, DEBUG=0 emits none, request ID appears in all lines for a request, and response includes X-Request-ID header

### Implementation for User Story 1

- [x] T005 [US1] Implement request ID middleware + per-phase timing middleware in `src/observability/debug.ts` — generate 8-char request IDs via `crypto.randomUUID().slice(0, 8)`, set `X-Request-ID` response header, time phases (request-received, handler-start, handler-end, response-sent) using `process.hrtime.bigint()`, emit structured debug log lines via `c.get("logger").debug()` with `[req:xxxx]` prefix and elapsed ms
- [x] T006 [US1] Implement `createObservability()` in `src/observability/index.ts` — read `DEBUG` env var, return configured debug middleware array (request ID middleware + timing middleware), export `ProfileStore` type from `./profile.js`
- [x] T007 [US1] Replace the existing request-logging middleware in `src/index.ts:55-61` with the observability middleware from `createObservability()`. Wire profile store injection (null for now — populated in US2). Keep `store`, `logger`, `events`, `workflowState` injection middleware intact.

**Checkpoint**: Debug logging fully functional — every request emits structured timing lines when DEBUG=1, silent otherwise

---

## Phase 4: User Story 2 - View Accumulated Endpoint Performance Report (Priority: P2)

**Goal**: When PROFILE=1, the server accumulates per-endpoint timing stats and exposes an HTML report at `/debug/profile` (authenticated)

**Independent Test**: Start server with `PROFILE=1`, make several requests to different endpoints, visit `/debug/profile` authenticated, verify per-endpoint stats (count, avg, min, max) match requests made

### Tests for User Story 2

- [x] T008 [P] [US2] Add profile tests to `src/test/observability.test.ts` — test that ProfileStore accumulates stats correctly across multiple requests, profile report returns HTML with correct stats, unauthenticated requests are rejected, disabling PROFILE makes the route return "profiling disabled" message

### Implementation for User Story 2

- [x] T009 [US2] Implement `ProfileStore` in `src/observability/profile.ts` — in-memory `Map<string, EndpointProfile>` keyed by `${method}:${routePattern}`, record(duration) method that updates count/total/min/max, ring buffer of last 10 slow requests, frequency-based eviction when >500 entries, `generateReport()` returning summary rows, `isEnabled()` gated by `PROFILE` env var
- [x] T010 [P] [US2] Create HTML template `profileReport()` in `src/views/profile.ts` — renders a table with columns: Endpoint, Count, Avg, Min, Max, plus a "Recent Slow Requests" section below, using existing project CSS variables (var(--text), var(--surface), etc.)
- [x] T011 [US2] Wire profile route into `createApp()` in `src/index.ts` — register `GET /debug/profile` with `auth.requireAuth` middleware (only when profile store is enabled), handler calls `profileStore.generateReport()` and renders via `profileReport()`. Update `createObservability()` to return the profile store instance and middleware together.

**Checkpoint**: Profile report fully functional — endpoint stats accumulate and render as HTML at `/debug/profile`

---

## Phase 5: User Story 3 - Identify Timing Discrepancies Between Browser and Server (Priority: P3)

**Goal**: When DEBUG=1, streaming responses (SSE) have their stream lifetime measured separately from handler execution time, and a warning is emitted when total time exceeds handler time by 5x

**Independent Test**: Simulate a streaming response, observe that server logs show "stream-end" with total stream duration separately from handler duration

### Tests for User Story 3

- [x] T012 [P] [US3] Add streaming timing tests to `src/test/observability.test.ts` — test that streaming responses log separate handler-end and stream-end phases, verify the 5x discrepancy warning fires when appropriate, test that non-streaming responses do not produce stream phase logs

### Implementation for User Story 3

- [x] T013 [US3] Add ReadableStream body wrapping to the timing middleware in `src/observability/debug.ts` — after `await next()`, detect if `c.res.body` is a `ReadableStream`, wrap it in a new ReadableStream that emits `stream-end` log on `done: true`, and replace `c.res` with a new Response containing the wrapped body. Non-streaming responses skip wrapping and log `response-sent` immediately.
- [x] T014 [US3] Add discrepancy detection to `src/observability/debug.ts` — after the stream ends (or response is fully sent), compare total server-measured time to handler execution time; if the non-handler portion exceeds 5x the handler time, emit a warning log identifying the specific phases and their durations, and note "client-perceived latency may differ due to streaming/connection factors"

**Checkpoint**: All three user stories functional — debug logging captures full request lifecycle including streams, profile report works, discrepancy warnings fire

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case hardening

- [x] T015 Run quickstart.md validation — manually verify each scenario in `specs/002-server-observability/quickstart.md` works as described
- [x] T016 [P] Verify zero overhead when disabled — confirm that with no DEBUG/PROFILE env vars set, per-request log output is identical to pre-feature behavior (only startup messages, no additional latency)
- [x] T017 [P] Verify edge cases from spec — large body requests (body-read duration as separate phase), concurrent requests (request IDs keep logs readable), server shutdown (final profile summary to stdout when PROFILE enabled)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational phase completion
  - US2 depends on US1 (profile store needs debug middleware infrastructure)
  - US3 depends on US1 (stream wrapping extends timing middleware)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 — profile recording hooks into the debug middleware's timing pipeline
- **User Story 3 (P3)**: Depends on US1 — stream wrapping is added to the timing middleware created in US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core implementation before wire-in to `createApp()`
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 (Phase 2) can run in parallel
- T009 and T010 (US2) can run in parallel
- All test tasks (T004, T008, T012) can run in parallel within their respective phases
- T016 and T017 (Polish) can run in parallel

---

## Parallel Example: User Story 2

```bash
# Launch tests first (must fail before implementation):
Task: "Add profile tests to src/test/observability.test.ts"

# Then launch these in parallel:
Task: "Implement ProfileStore in src/observability/profile.ts"
Task: "Create HTML template profileReport() in src/views/profile.ts"

# After both complete:
Task: "Wire profile route into createApp() in src/index.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — create directory + placeholder
2. Complete Phase 2: Foundational — enhance logger + add types
3. Complete Phase 3: User Story 1 — debug logging middleware
4. **STOP and VALIDATE**: Start server with `DEBUG=1`, make requests, verify structured log output
5. Demo: The 58s-vs-1ms discrepancy is now partially diagnosable (handler time shown, but stream time not yet split)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Debug logging works (MVP!)
3. Add User Story 2 → Test independently → Profile report available
4. Add User Story 3 → Test independently → Stream timing + discrepancy warnings
5. Each story adds value without breaking previous stories

### Single Developer Strategy

Execute phases sequentially: Setup → Foundational → US1 → US2 → US3 → Polish. Within each phase, parallelize [P] tasks where possible.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US1 is the MVP — it alone resolves the core complaint ("DEBUG=1 doesn't do anything") and provides the timing infrastructure US2/US3 build on
- The existing `createLogger("http")` middleware at `src/index.ts:40-46` is preserved — only the timing/logging middleware at line 55-61 is replaced
- Profile store is `null` when PROFILE is disabled — `c.get("profileStore")` returns null, and route handlers check before operating
