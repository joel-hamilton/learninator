# Tasks: Eliminate Duplicate Modules

**Input**: Design documents from `specs/011-eliminate-duplicate-modules/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No new tests required. Existing test suite must pass after each phase.

**Organization**: Tasks reflect the actual implementation state on this branch — most duplication is already resolved. Remaining work is dead-code deletion and verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Verify current state before any changes

- [x] T001 Run `npm test` to capture baseline — all tests must pass before any deletions

---

## Phase 2: User Story 2 - Verify Browse Migration Complete (Priority: P1) 🎯 MVP

**Goal**: Confirm browse routes are already wired to `TopicExplorer` and no inline constants remain. This story is already implemented — verify only.

**Independent Test**: grep checks return zero for inline browse constants. Browse routes import `createTopicExplorer`.

### Verification for User Story 2

- [x] T002 [US2] Verify `src/routes/browse.ts` imports `createTopicExplorer` from `src/browse/explorer.ts` — confirm the import exists at top of file
- [x] T003 [P] [US2] Run grep checks for inline browse constants in `src/routes/browse.ts`:
  - `grep -c "BROWSE_SYSTEM_PROMPT" src/routes/browse.ts` → 0
  - `grep -c "FALLBACK_OPTIONS" src/routes/browse.ts` → 0
  - `grep -c "parseBrowseResponse" src/routes/browse.ts` → 0
- [x] T004 [P] [US2] Run grep to confirm browse constants exist only in explorer: `grep -rn "BROWSE_SYSTEM_PROMPT\|FALLBACK_OPTIONS\|parseBrowseResponse" src/browse/explorer.ts` — all three should match in explorer.ts only
- [x] T005 [US2] Verify `createMissionAndRedirect` helper is preserved in `src/routes/browse.ts` — grep confirms it exists (HTTP concern, belongs in routes)

**Checkpoint**: Browse migration verified as complete

---

## Phase 3: User Story 3 - Delete Dead Onboarding Module (Priority: P2)

**Goal**: Delete `src/onboarding/index.ts` (zero production imports) and its test file. `mission-chat.service.ts` is the canonical surviving implementation. `mission-conversation.ts` is already deleted. This eliminates the last remaining duplicate onboarding implementation per FR-013.

**Independent Test**: Run `npm test`. App boots without module resolution errors. `grep -r "from.*onboarding/index" src/ --include="*.ts"` returns zero non-test matches.

### Implementation for User Story 3

- [x] T006 [US3] Confirm `src/onboarding/index.ts` has zero production imports: `grep -rn "from.*onboarding/index\|createOnboarding" src/ --include="*.ts" --exclude="*.test.ts"` → no matches
- [x] T007 [US3] Confirm `mission-chat.service.ts` covers all onboarding scenarios: verify `src/services/mission-chat.service.ts` has `buildSystemPrompt` (onboarding mode instructions, lesson context, mission content injection), `run` (conversation loop with workflow/events), and `generateTitle`
- [x] T008 [US3] Delete `src/onboarding/index.ts`
- [x] T009 [US3] Delete `src/onboarding/index.test.ts`
- [x] T010 [US3] Run `npm test` and verify all tests pass. The deleted test's coverage exists at HTTP level in `missions.test.ts`, `chat.test.ts`, and `onboarding.test.ts`.

**Checkpoint**: Exactly one implementation survives (`mission-chat.service.ts`). FR-013 satisfied.

---

## Phase 4: User Story 4 - Verify Dead Code Removal & Final Validation (Priority: P2)

**Goal**: Confirm all inline code is removed, the app compiles, and tests pass. Complete validation per quickstart.md.

**Independent Test**: All grep checks return zero matches. `tsc --noEmit` passes. `npm test` passes.

### Verification for User Story 4

- [x] T011 [P] [US4] Run grep checks for inline onboarding helpers in routes:
  - `grep -c "function getOnboardingPrompt" src/routes/missions.ts` → 0
  - `grep -c "function generateMissionTitle" src/routes/missions.ts` → 0
  - `grep -c "function runConversationLoop" src/routes/missions.ts` → 0
- [x] T012 [P] [US4] Verify service imports in routes:
  - `grep -c "missionChatService" src/routes/missions.ts` → at least 1
  - `grep -c "missionChatService" src/routes/onboarding.ts` → at least 1
  - `grep -c "missionChatService" src/routes/chat.ts` → at least 1
  - `grep -c "createTopicExplorer" src/routes/browse.ts` → at least 1
- [x] T013 [P] [US4] Verify deleted files no longer exist:
  - `test -f src/onboarding/index.ts && echo "STILL EXISTS" || echo "OK: deleted"`
  - `test -f src/onboarding/index.test.ts && echo "STILL EXISTS" || echo "OK: deleted"`
  - `test -f src/ai/mission-conversation.ts && echo "STILL EXISTS" || echo "OK: deleted"`
- [x] T014 [US4] Run `npx tsc --noEmit` to verify no type errors
- [x] T015 [US4] Run `npm test` for final full-suite verification
- [x] T016 [US4] Verify app boots: `npx tsx src/index.ts & sleep 2 && curl -s http://localhost:3000/ | head -5 && kill %1` — expected: HTML output, no module resolution errors

**Checkpoint**: All dead code removed. App compiles, boots, and passes all tests.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run first to capture baseline
- **Phase 2 (US2 - Browse verification)**: Depends on Phase 1 baseline
- **Phase 3 (US3 - Delete onboarding module)**: Depends on Phase 1 baseline. Does NOT depend on Phase 2.
- **Phase 4 (US4 - Final verification)**: Depends on Phases 2 and 3 completion

### Parallel Opportunities

- Phase 2 and Phase 3 can run in parallel (they touch different directories)
- T003 and T004 in Phase 2 can run in parallel (independent grep checks)
- T011, T012, T013 in Phase 4 can run in parallel (independent grep/filesystem checks)

---

## Implementation Strategy

### Single Developer, Sequential Execution

This branch already has most work done. The remaining work is small and sequential:

1. **Phase 1**: Verify baseline tests pass
2. **Phase 2**: Verify browse migration (already done, just confirm)
3. **Phase 3**: Delete dead onboarding module
4. **Phase 4**: Final verification

Total estimated effort: < 30 minutes. Most tasks are verification-only.

### What's Already Done

- `src/services/mission-chat.service.ts`: Canonical service for all mission chat + onboarding (wired to all routes)
- `src/routes/browse.ts`: Already wired to `TopicExplorer` — no inline constants
- `src/routes/missions.ts`: Already delegates to `missionChatService.run()` — no inline helpers
- `src/routes/onboarding.ts`: Already delegates to `missionChatService.run()` — no inline helpers
- `src/ai/mission-conversation.ts`: Already deleted

### What's Left

- Delete `src/onboarding/index.ts` (dead code, zero production imports)
- Delete `src/onboarding/index.test.ts` (coverage exists at HTTP level)
- Verify everything end-to-end

---

## Notes

- No new tests needed. Existing HTTP-level tests verify behavioral equivalence.
- No schema changes. No view changes. No test infrastructure changes.
- The deleted onboarding module had 13 unit test cases — the same scenarios are exercised at HTTP level by `missions.test.ts`, `chat.test.ts`, and `onboarding.test.ts` per the Constitution's Principle II.
- The prompt "Do NOT create lessons during onboarding — wait until the mission is active" is correct (spec 007).
- `createMissionAndRedirect` stays in `src/routes/browse.ts` (HTTP concern, not part of TopicExplorer).
