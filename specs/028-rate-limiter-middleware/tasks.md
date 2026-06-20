---

description: "Task list for Rate Limiter Middleware feature implementation"

---

# Tasks: Rate Limiter Middleware

**Input**: Design documents from `specs/028-rate-limiter-middleware/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — the project already exists. No dependencies to install, no configuration changes. Phase is intentionally empty; the middleware factory is a single new source file.

*No tasks in this phase.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `rateLimit()` middleware factory module and wire it into the security module's public API. This is the core enabler for all user stories.

**Critical**: No user story work can begin until this phase is complete.

- [ ] T001 Create `src/security/rate-limit-middleware.ts` with the `rateLimit(action, max, windowMs)` factory function. The middleware reads `rateLimiter` from context via `c.get("rateLimiter")`, checks the limit via `rateLimiter.check(user.id, action, max, windowMs)`, returns `c.html(rateLimitedFragment())` on limit hit, and calls `await next()` to proceed. When `rateLimiter` is null, passes through unconditionally.

- [ ] T002 Export `rateLimit` from `src/security/index.ts` by adding it to the existing re-export block alongside `rateLimitedFragment`.

**Checkpoint**: Foundation ready — `rateLimit()` middleware factory exists and is importable from `src/security/index.js`. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Developer adds new rate-limited route without writing guard boilerplate (Priority: P1)

**Goal**: Demonstrate the middleware pattern by migrating all 3 rate-limited POST routes in `src/routes/missions.ts` to use the middleware, proving the middleware factory works in real route handlers. After this phase, no inline guard blocks remain in missions.ts.

**Independent Test**: A route with a middleware-declared rate limit of 1 request per minute returns successfully on the first request and returns a rate-limited response on the second request within the same window. A route without the middleware is not affected.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Apply `rateLimit("mission_create", 5, 60_000)` middleware to the POST `/` route in `src/routes/missions.ts` (line ~73-76) and remove the inline guard block.

- [ ] T004 [P] [US1] Apply `rateLimit("mission_create", 5, 60_000)` middleware to the POST `/new` route in `src/routes/missions.ts` (line ~122-125) and remove the inline guard block.

- [ ] T005 [P] [US1] Apply `rateLimit("chat", 20, 60_000)` middleware to the POST `/:missionId/chat` route in `src/routes/missions.ts` (line ~295-298) and remove the inline guard block.

- [ ] T006 [US1] Remove `rateLimitedFragment` from the destructured import in `src/routes/missions.ts` (the import from `../security/index.js`). Confirm `validateChatMessage`, `validateTitle`, `validateTopic` are still imported on the same line. Add `rateLimit` to the import.

**Checkpoint**: At this point, `src/routes/missions.ts` has zero inline rate-limit guard blocks. All 3 POST routes use the middleware chain.

---

## Phase 4: User Story 2 — Developer reads route file and sees rate limiting declared in the route chain (Priority: P2)

**Goal**: Extend the middleware pattern to all 4 rate-limited POST routes in `src/routes/lesson-generation.ts`, completing the migration. After this phase, every rate-limited route in the codebase declares its rate limit in the route chain, not in the handler body.

**Independent Test**: A developer reviewing `src/routes/lesson-generation.ts` can see all rate limits as middleware declarations in the route chain — no handler body scanning needed.

### Implementation for User Story 2

- [ ] T007 [P] [US2] Apply `rateLimit("lesson_gen", 10, 60_000)` middleware to the POST `/:number/generate-next` route in `src/routes/lesson-generation.ts` (line ~77-80) and remove the inline guard block.

- [ ] T008 [P] [US2] Apply `rateLimit("lesson_gen", 10, 60_000)` middleware to the POST `/:number/generate-sub-lesson` route in `src/routes/lesson-generation.ts` (line ~126-129) and remove the inline guard block.

- [ ] T009 [P] [US2] Apply `rateLimit("lesson_gen", 10, 60_000)` middleware to the POST `/:number/regenerate` route in `src/routes/lesson-generation.ts` (line ~157-160) and remove the inline guard block.

- [ ] T010 [P] [US2] Apply `rateLimit("lesson_gen", 10, 60_000)` middleware to the POST `/:number/generate-bridging` route in `src/routes/lesson-generation.ts` (line ~190-193) and remove the inline guard block.

- [ ] T011 [US2] Remove `rateLimitedFragment` from the destructured import in `src/routes/lesson-generation.ts` (the import from `../security/index.js`). Confirm `validateNotes` is still imported on the same line. Add `rateLimit` to the import.

**Checkpoint**: At this point, `src/routes/lesson-generation.ts` has zero inline rate-limit guard blocks. All 4 POST routes use the middleware chain.

---

## Phase 5: User Story 3 — Rate-limited route behaves correctly when rate limiter is disabled (Priority: P3)

**Goal**: Verify that the null-rateLimiter behavior is preserved. When the app is started without a rate limiter (i.e., `rateLimiter: null` in factory options), all rate-limited routes pass through without limitation. This is the existing test-mode contract.

**Independent Test**: When the application is started without a rate limiter configured, requests to rate-limited routes always succeed regardless of frequency. The existing test `T028: rate limiter bypassed when rateLimiter is null` passes without modification.

### Implementation for User Story 3

- [ ] T012 [US3] Run the full test suite (`npm test`) and confirm zero failures. Pay particular attention to `src/test/security/auth-rate-limiter.test.ts` and the `T028` test in `src/test/security.test.ts`. If any tests fail, investigate and fix (likely an import issue in the middleware module or a path reference).

**Checkpoint**: All existing tests pass. The null-rateLimiter contract is preserved. The middleware migration is complete and verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup.

- [ ] T013 Run `npm test` one final time to confirm everything is green.
- [ ] T014 Verify that `rateLimitedFragment` is no longer imported by any route file (check `src/routes/missions.ts` and `src/routes/lesson-generation.ts`). It should only be imported by the middleware module itself.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Empty — no tasks
- **Foundational (Phase 2)**: No dependencies — creates the middleware factory
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion; can run in parallel with Phase 3 (different file)
- **User Story 3 (Phase 5)**: Depends on Phases 2, 3, and 4 completion (requires all routes migrated)
- **Polish (Phase 6)**: Depends on all phases complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Phase 2 — no dependencies on US1 (different file)
- **User Story 3 (P3)**: Depends on US1 and US2 (needs all routes migrated to run verification)

### Within Each User Story

- Implementation tasks within a story can proceed in any order (marked [P] where independent).
- Import cleanup (last task per story) should come after all middleware applications in that file.

### Parallel Opportunities

- All tasks within Phase 3 (US1) marked [P] can run in parallel — they touch different route handlers in the same file
- All tasks within Phase 4 (US2) marked [P] can run in parallel — they touch different route handlers in the same file
- Phase 3 and Phase 4 can run in parallel (different files: `missions.ts` vs `lesson-generation.ts`)

---

## Parallel Example: User Story 1

```bash
# Apply middleware to all 3 missions.ts routes in parallel:
Task: "Apply rateLimit('mission_create', 5, 60000) to POST / in missions.ts"
Task: "Apply rateLimit('mission_create', 5, 60000) to POST /new in missions.ts"
Task: "Apply rateLimit('chat', 20, 60000) to POST /:missionId/chat in missions.ts"

# After all 3 are done, clean up the import:
Task: "Remove rateLimitedFragment import from missions.ts, add rateLimit"
```

## Parallel Example: User Story 2

```bash
# Apply middleware to all 4 lesson-generation.ts routes in parallel:
Task: "Apply rateLimit('lesson_gen', 10, 60000) to POST /:number/generate-next"
Task: "Apply rateLimit('lesson_gen', 10, 60000) to POST /:number/generate-sub-lesson"
Task: "Apply rateLimit('lesson_gen', 10, 60000) to POST /:number/regenerate"
Task: "Apply rateLimit('lesson_gen', 10, 60000) to POST /:number/generate-bridging"

# After all 4 are done, clean up the import:
Task: "Remove rateLimitedFragment import from lesson-generation.ts, add rateLimit"
```

---

## Implementation Strategy

### MVP First (Phase 2 + Phase 3 Only)

1. Complete Phase 2: Foundational — create the middleware factory
2. Complete Phase 3: User Story 1 — migrate missions.ts
3. **STOP and VALIDATE**: Run `npm test` to confirm missions.ts migration doesn't break anything
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Phase 2 (Foundational) → Middleware factory exists
2. Complete Phase 3 (US1) → missions.ts migrated → Test → Deploy
3. Complete Phase 4 (US2) → lesson-generation.ts migrated → Test → Deploy
4. Complete Phase 5 (US3) → Full verification pass

### Parallel Team Strategy

With multiple developers:

1. Developer A: Phase 2 (middleware factory — foundational, must be first)
2. Once Phase 2 is done:
   - Developer A: Phase 3 (missions.ts)
   - Developer B: Phase 4 (lesson-generation.ts)
3. Either developer: Phase 5 (verification) and Phase 6 (polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The middleware factory must preserve the null-check behavior — this is verified in Phase 5
- Auth routes (`src/auth/index.ts`) are explicitly out of scope (IP-based pattern)
