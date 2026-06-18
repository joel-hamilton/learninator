# Tasks: Security Hardening

**Input**: Design documents from `/specs/003-security-hardening/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/error-fragments.md, quickstart.md

**Tests**: Included — the feature spec requires integration tests per SC-005 and the plan specifies `src/test/security.test.ts`.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new `src/security/` module — pure functions and classes with no dependencies on routes or app wiring.

- [x] T001 [P] Create `src/security/input-limits.ts` with limit constants (`MAX_CHAT_MESSAGE` = 10000, `MAX_MISSION_TITLE` = 200, `MAX_FEEDBACK_TEXT` = 2000, `MAX_NOTES_TEXT` = 1000, `MAX_GUIDED_ANSWER` = 5000), pure validation functions (`validateChatMessage()`, `validateTitle()`, `validateFeedback()`, `validateNotes()`, `validateGuidedAnswer()`), and error fragment helpers (`inputTooLongFragment()`, `rateLimitedFragment()`) returning htmx-compatible HTML strings per contracts/error-fragments.md
- [x] T002 [P] Create `src/security/rate-limiter.ts` with `RateLimiter` interface (single `check()` method) and `SlidingWindowRateLimiter` class implementing per-user sliding-window algorithm using `Map<string, number[]>` per research.md
- [x] T003 Create `src/security/index.ts` re-exporting from `input-limits.ts` and `rate-limiter.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the rate limiter into the app factory so it is available to all route handlers. Input validators are pure function imports and need no wiring.

- [x] T004 Add `rateLimiter: RateLimiter | null` to `AppVariables` type in `src/types.ts` (import `RateLimiter` from `src/security/`)
- [x] T005 Instantiate `SlidingWindowRateLimiter` and inject via `c.set("rateLimiter", ...)` in `createApp()` middleware in `src/index.ts` (use `if (!process.env.VITEST)` guard or accept optional override per Constitution I)

**Checkpoint**: Foundation ready — `rateLimiter` available via `c.get("rateLimiter")` in all route handlers. Input validators importable from `src/security/`. User story implementation can now begin.

---

## Phase 3: User Story 1 - Remove Insecure SSE Tool-Events Endpoint (Priority: P1)

**Goal**: Remove the `GET /missions/:missionId/chat/tool-events` SSE endpoint that leaks AI tool-call data across users, and clean up all associated dead code.

**Independent Test**: `curl /missions/any-id/chat/tool-events` returns 404. No references to `tool-events`, `tool-banner`, or the client-side `EventSource` remain. `/workflows/events` SSE endpoint still functional.

### Tests for User Story 1

- [x] T006 [P] [US1] Write test in `src/test/security.test.ts`: verify `GET /missions/:missionId/chat/tool-events` returns 404 for authenticated user
- [x] T007 [P] [US1] Write test in `src/test/security.test.ts`: verify `/workflows/events` SSE endpoint still functional after tool-events removal

### Implementation for User Story 1

- [x] T008 [US1] Remove `GET /missions/:missionId/chat/tool-events` SSE route handler from `src/routes/missions.ts` (per research.md dead code audit: lines ~612-634)
- [x] T009 [US1] Remove `new EventSource("/missions/" + missionId + "/chat/tool-events")` client-side connection from `src/views/fragments.ts` (per research.md dead code audit: line ~419)
- [x] T010 [US1] Remove `tool-banner` and `tool-events` endpoint test references from `src/test/workflow-visibility.test.ts` (per research.md dead code audit: lines 33, 67, 71, 83)
- [x] T011 [US1] Verify `streamSSE` import is NOT removed from `src/routes/missions.ts` — it is still used by `/workflows/events` route in `src/routes/home.ts`

**Checkpoint**: Old SSE endpoint gone. No dead code remaining. Workflow visibility SSE still works.

---

## Phase 4: User Story 2 - Server-Side Input Length Limits (Priority: P1)

**Goal**: Reject oversized user inputs with htmx-compatible HTML error fragments before they reach the AI API or database. Cover all user-input routes: chat messages, titles, feedback, notes, and guided answers.

**Independent Test**: Submit inputs exceeding each limit to every protected route and confirm rejection with a user-friendly HTML error fragment. Submit inputs at exactly the limit and confirm acceptance.

### Tests for User Story 2

- [x] T012 [P] [US2] Write test in `src/test/security.test.ts`: chat message > 10,000 chars rejected with error fragment on `POST /missions/:id/chat`
- [x] T013 [P] [US2] Write test in `src/test/security.test.ts`: chat message ≤ 10,000 chars accepted normally
- [x] T014 [P] [US2] Write test in `src/test/security.test.ts`: mission title > 200 chars rejected on create and rename routes
- [x] T015 [P] [US2] Write test in `src/test/security.test.ts`: lesson feedback > 2,000 chars rejected with error fragment
- [x] T016 [P] [US2] Write test in `src/test/security.test.ts`: lesson notes > 1,000 chars rejected with error fragment
- [x] T017 [P] [US2] Write test in `src/test/security.test.ts`: guided answer > 5,000 chars combined rejected with error fragment

### Implementation for User Story 2

- [x] T018 [P] [US2] Add chat message length validation (10k chars) before AI call in `POST /missions/:id/chat` handler in `src/routes/missions.ts` — import `validateChatMessage` and `inputTooLongFragment` from `src/security/`
- [x] T019 [P] [US2] Add chat message length validation (10k chars) before AI call in `POST /chat/:missionId` handler in `src/routes/chat.ts` — same imports as T018
- [x] T020 [P] [US2] Add mission title/topic length validation (200 chars) on create and rename routes in `src/routes/missions.ts` — import `validateTitle`
- [x] T021 [P] [US2] Add mission title/topic length validation (200 chars) on new mission form POST in `src/routes/home.ts`
- [x] T022 [P] [US2] Add lesson feedback length validation (2k chars) in `src/routes/lessons.ts` feedback POST handler — import `validateFeedback`
- [x] T023 [P] [US2] Add lesson notes length validation (1k chars) in `src/routes/lessons.ts` notes save handler — import `validateNotes`
- [x] T024 [P] [US2] Add guided answer length validation (5k chars combined) in onboarding POST handler in `src/routes/missions.ts` — import `validateGuidedAnswer`

**Checkpoint**: All user-input routes reject oversized inputs with friendly HTML error fragments before any AI call or DB write. Inputs at or below limits pass through normally.

---

## Phase 5: User Story 3 - In-Memory Rate Limiting on AI Endpoints (Priority: P2)

**Goal**: Cap per-user request rates on AI-backed endpoints using the sliding-window rate limiter. Rejected requests receive htmx-compatible error fragments. Input validation always runs before rate limit counting (per FR-014).

**Independent Test**: Send requests exceeding configured rate limits and verify rejection with error fragment. Verify normal usage below limit is unaffected. Verify window slides correctly after 60 seconds. Verify oversized inputs don't consume rate limit quota.

### Tests for User Story 3

- [x] T025 [P] [US3] Write test in `src/test/security.test.ts`: 21 chat requests within 1 minute → first 20 accepted, 21st rejected with rate-limit error fragment
- [x] T026 [P] [US3] Write test in `src/test/security.test.ts`: rate limit resets after sliding window passes (send requests, wait, send more — accepted)
- [x] T027 [P] [US3] Write test in `src/test/security.test.ts`: oversized input rejected without consuming rate limit quota (send oversized message, then verify within-limit messages still accepted)
- [x] T028 [P] [US3] Write test in `src/test/security.test.ts`: rate limiter bypassed when `rateLimiter` is null (test mode / disabled)
- [x] T029 [P] [US3] Write test in `src/test/security.test.ts`: lesson generation rate limit (11 requests → 11th rejected) and mission creation rate limit (6 requests → 6th rejected)

### Implementation for User Story 3

- [x] T030 [P] [US3] Add rate limit check (category `chat`, 20/min) after input validation in `POST /missions/:id/chat` handler in `src/routes/missions.ts` — call `c.get("rateLimiter")?.check(userId, "chat", 20, 60000)`, return `rateLimitedFragment()` on false
- [x] T031 [P] [US3] Add rate limit check (category `chat`, 20/min) after input validation in `POST /chat/:missionId` handler in `src/routes/chat.ts` — same pattern as T030
- [x] T032 [P] [US3] Add rate limit check (category `lesson_gen`, 10/min) on lesson generation route in `src/routes/lessons.ts`
- [x] T033 [P] [US3] Add rate limit check (category `mission_create`, 5/min) on mission creation POST route in `src/routes/home.ts` (or `src/routes/missions.ts` depending on where creation lives)

**Checkpoint**: All AI-backed endpoints are rate-limited per user. Rate limit errors are htmx-compatible HTML fragments. Input validation runs before rate limiting.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup.

- [x] T034 Run all tests via `npm test` and verify no regressions in existing test files
- [x] T035 Run quickstart.md manual validation scenarios and confirm all expected behaviors
- [x] T036 Verify `streamSSE` import still present in `src/routes/missions.ts` (used by home.ts for `/workflows/events`) and remove if unused after SSE route deletion
- [x] T037 Verify no new npm dependencies were added (`npm ls --depth=0`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T002 for RateLimiter type)
- **User Story 1 (Phase 3)**: Independent of Setup/Foundational — only touches existing route/view code
- **User Story 2 (Phase 4)**: Depends on T001 (input-limits.ts) from Phase 1; does NOT need Phase 2
- **User Story 3 (Phase 5)**: Depends on Phase 1 + Phase 2 (rate limiter class + AppVariables wiring)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies — can start immediately, even before Phase 1
- **User Story 2 (P1)**: Depends on T001 (input-limits.ts). Independent of US1 and US3.
- **User Story 3 (P2)**: Depends on T001, T002, T004, T005 (rate limiter + wiring). Independent of US1 and US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD red-green-refactor)
- Input validation before rate limiting (per FR-014): within route handlers, validate input length first, then check rate limit
- Core implementation before integration

### Parallel Opportunities

- T001 and T002 can run in parallel (different files in `src/security/`)
- All US1 tests (T006, T007) can run in parallel
- All US2 tests (T012-T017) can run in parallel
- All US2 implementation tasks (T018-T024) can run in parallel (different route handlers)
- All US3 tests (T025-T029) can run in parallel
- All US3 implementation tasks (T030-T033) can run in parallel (different route files)
- US1, US2, and US3 can all be worked on in parallel once their respective prerequisites are met
- US1 is fully independent and can start immediately alongside Phase 1

---

## Parallel Example: User Story 2

```bash
# Launch all input validation tasks together (different route files):
Task: "Add chat message length validation in src/routes/missions.ts"
Task: "Add chat message length validation in src/routes/chat.ts"
Task: "Add mission title validation in src/routes/missions.ts"
Task: "Add mission title validation in src/routes/home.ts"
Task: "Add lesson feedback validation in src/routes/lessons.ts"
Task: "Add lesson notes validation in src/routes/lessons.ts"
Task: "Add guided answer validation in src/routes/missions.ts"
```

## Parallel Example: User Story 3

```bash
# Launch all rate limit tasks together (different route files):
Task: "Add chat rate limit in src/routes/missions.ts"
Task: "Add chat rate limit in src/routes/chat.ts"
Task: "Add lesson gen rate limit in src/routes/lessons.ts"
Task: "Add mission create rate limit in src/routes/home.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (remove insecure SSE endpoint)
2. **STOP and VALIDATE**: Confirm endpoint returns 404, no dead code, workflow SSE still works
3. This is the active security vulnerability — ship it first

### Incremental Delivery

1. **US1** (Remove SSE endpoint) → security fix, no new code, immediate risk reduction
2. **US2** (Input length limits) → resource protection, prevents cost abuse, zero perf overhead
3. **US3** (Rate limiting) → cost management, requires US2's validation to run first per FR-014
4. Each story adds value without breaking previous stories

### Single Developer Strategy

Recommended order: Phase 1 → Phase 2 → US1 → US2 → US3 → Phase 6

US1 can actually be done first (it's just deletions, no new code), then Phase 1+2 to set up the security module, then US2, then US3.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No new npm dependencies — all implementation uses existing Hono + TypeScript
- Error responses must be HTML fragments (not JSON, not bare status codes) per Constitution III and contracts/error-fragments.md
- Rate limiter data is ephemeral (in-memory Map, resets on server restart) — acceptable per spec assumptions
- `streamSSE` helper MUST NOT be removed — it is still used by `/workflows/events` in `src/routes/home.ts`
- Input validation runs before rate limit counting per FR-014
