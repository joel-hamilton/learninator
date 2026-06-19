---

description: "Task list for collapsing lesson generator duplication into a GenerationConfig + template method pattern"

---

# Tasks: Collapse Generator Duplication

**Input**: Design documents from `/specs/023-collapse-generator-duplication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: No new tests are needed. Existing tests in `src/test/lessons.test.ts` and `src/test/chat.test.ts` verify behavioral equivalence. US3 (P2) validates that all existing tests pass without modification.

**Scope**: Single-file refactoring of `src/lessons/generator.ts`. No other files modified. No schema changes. No test modifications.

**Organization**: Tasks are grouped by structural dependency. US1 and US2 are both P1 and map to the same code change (extract configs + template), so they share a single Phase. US3 (P2) is pure verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent conceptual units)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Review and Baseline)

**Purpose**: Understand the current four duplicated methods, establish a test baseline, and identify all variation points.

- [X] T001 Review the four generation methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) and their shared call to `runGenerationJob` in `src/lessons/generator.ts`, documenting each variation point (job key type, system prompt construction, user message construction, result-finding callback)
- [X] T002 [P] Run `npm test` to establish the baseline — all existing tests in `src/test/lessons.test.ts` and `src/test/chat.test.ts` must pass before refactoring begins
- [X] T003 [P] Measure current line count of the four method bodies (lines 74-282 in `src/lessons/generator.ts`) for later comparison against the target of at least 100 lines saved

---

## Phase 2: Foundational (GenerationConfig Type and Template Method)

**Purpose**: Define the `GenerationConfig` interface and the `runGeneration` private template method that encapsulates the shared lifecycle. This MUST be complete before any config extraction begins.

- [X] T004 Define `GenerationConfig` interface and supporting types (`MissionInfo`, `LessonInfo`, `GenerationOpts`, `LessonResult`) in `src/lessons/generator.ts` with four callbacks: `buildJobKey()`, `buildSystemPrompt()`, `buildUserMessage()`, and `findResult()` — matching the signatures defined in `specs/023-collapse-generator-duplication/data-model.md`
- [X] T005 Implement the private `runGeneration(config: GenerationConfig)` template method in `LessonGenerator` in `src/lessons/generator.ts` — encapsulating the shared 5-step lifecycle: build job key via `buildJobKey` (reusing the module-level helper), check for duplicate job in `this.jobs`, construct system prompt via `config.buildSystemPrompt()`, construct user message array via `config.buildUserMessage()`, and call `this.runGenerationJob` with the result-finding callback from `config.findResult()` — preserving the exact same error handling pattern (set job to error, log via `logger.error`, schedule 60-second cleanup via `setTimeout`)

---

## Phase 3: User Stories 1 and 2 — Config Objects and Thin Methods (Priority: P1)

**Goal**: Each of the four public methods becomes a single-line delegation to `runGeneration` with a dedicated config object. A developer can add a fifth generation type with one config object (US1). A new developer reads one template method and four configs instead of four near-identical methods (US2).

**Independent Test**: Verify that each of the four public methods accepts the same parameters and returns the same type as before (string job key). Verify that adding a new generation kind requires only one config object (conceptually — no structural duplication).

### Implementation

- [X] T006 [P] [US1] [US2] Extract `generateNext` config object in `src/lessons/generator.ts` — config uses `jobKeyType: "next"`, builds system prompt from `TEACHER_SYSTEM_PROMPT` + mission info (same concatenation as lines 96-105), builds user message with feedback/notes support (same as lines 87-94), and `findResult` calls `this.deps.store.getLatestLesson()` with the same new-lesson detection logic (lines 112-126); body of `generateNext` becomes a single `return this.runGeneration({...})` call
- [X] T007 [P] [US1] [US2] Extract `generateSubLesson` config object in `src/lessons/generator.ts` — config uses `jobKeyType: "sub"`, builds system prompt from `TEACHER_SYSTEM_PROMPT` + mission info (same as lines 151-160), builds user message with sub-lesson instruction (same as line 149), and `findResult` calls `this.deps.store.getLatestLesson()` with the same new-lesson detection logic; body of `generateSubLesson` becomes a single `return this.runGeneration({...})` call
- [X] T008 [P] [US1] [US2] Extract `generateRegenerate` config object in `src/lessons/generator.ts` — config uses `jobKeyType: "regenerate"`, builds system prompt by calling `getRegenerateSystemPrompt(...)` (same as lines 200-206), builds user message with direction-aware text (same as line 209), `findResult` calls `this.deps.store.getLesson()` (same as lines 217-228, looking for the same lesson after update — different from the other three); body of `generateRegenerate` becomes a single `return this.runGeneration({...})` call
- [X] T009 [P] [US1] [US2] Extract `generateBridging` config object in `src/lessons/generator.ts` — config uses `jobKeyType: "bridge"`, builds system prompt by calling `getBridgingSystemPrompt(...)` (same as lines 248-253), builds user message with bridging instruction (same as line 256), and `findResult` calls `this.deps.store.getLatestLesson()` with the same new-lesson detection logic; body of `generateBridging` becomes a single `return this.runGeneration({...})` call
- [X] T010 [US1] [US2] Remove the duplicated scaffolding code from all four original methods in `src/lessons/generator.ts` — each method body is now only a `return this.runGeneration({...})` call, leaving no leftover local variables, helper calls, or `runGenerationJob` invocations outside the template method

---

## Phase 4: User Story 3 — Test Verification (Priority: P2)

**Goal**: Verify that the refactoring is behaviorally transparent — all existing tests pass without modification.

**Independent Test**: Run `npm test`. All tests must pass with zero failures and zero test file modifications.

- [X] T011 [US3] Run `npm test` and confirm all existing tests pass without any modifications to test files — verify at least `src/test/lessons.test.ts` and `src/test/chat.test.ts` execute successfully
- [X] T012 [US3] Manual review: verify each of the four public methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) accepts the same parameters (same shapes, same optional params) and returns `string` (job key) as before — identical public API

---

## Phase 5: Polish and Validation

**Purpose**: Run the full validation checklist, verify line count reduction, and confirm the quickstart scenarios.

- [X] T013 Verify line count reduction in `src/lessons/generator.ts` — confirm the four config bodies plus `runGeneration` template total fewer lines than the original four method bodies by at least 100 lines (target: ~220 -> ~100)
- [X] T014 Run quickstart.md validation scenarios from `specs/023-collapse-generator-duplication/quickstart.md` — confirm Scenario 1 (npm test passes), Scenario 2 (behavioral equivalence via inspection), and Scenario 3 (line count reduction)
- [X] T015 Run `git diff --stat` on `src/lessons/generator.ts` and confirm only that single file was modified — no unintended changes to other files

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T002 and T003 are parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion (specifically T001 — understanding the variation points). Blocks all config extraction.
- **US1+US2 (Phase 3)**: Depends on Phase 2 completion (T004, T005 — type definition and template method). T006-T009 are fully parallel (each config is independent). T010 depends on all four configs being complete.
- **US3 (Phase 4)**: Depends on Phase 3 completion (all configs extracted, all scaffolding removed).
- **Polish (Phase 5)**: Depends on Phase 4 completion (tests pass first, then validate).

### User Story Dependencies

- **US1 + US2 (P1, Phase 3)**: These are two views of the same code change. Both depend on the Foundational Phase.
- **US3 (P2, Phase 4)**: Depends on US1+US2 completion (code must be refactored before verification).

### Parallel Opportunities

- **Phase 1**: T002 (npm test baseline) and T003 (line count measurement) can run in parallel with each other and with T001 (code review).
- **Phase 3**: T006, T007, T008, T009 (the four config objects) are fully independent and can be written in any order. Each modifies different sections of the same file but does not depend on the others.
- **Phase 4**: T011 and T012 can run in parallel (one is automated, one is manual review).
- **Phase 5**: T013, T014, and T015 are independent checks.

### Within Phase 3

- Configs (T006-T009) can be written in any order — they are independent.
- T010 (removing scaffolding) must be done after all four configs are in place.

---

## Parallel Example: Phase 3 (Config Extraction)

```bash
# Launch all four config extractions together (fully independent):
Task: "Extract generateNext config (T006) in src/lessons/generator.ts"
Task: "Extract generateSubLesson config (T007) in src/lessons/generator.ts"
Task: "Extract generateRegenerate config (T008) in src/lessons/generator.ts"
Task: "Extract generateBridging config (T009) in src/lessons/generator.ts"

# After all four complete, remove scaffolding:
Task: "Remove duplicated scaffolding (T010) in src/lessons/generator.ts"
```

---

## Implementation Strategy

### Single-Phase Delivery (all three stories together)

Since all changes are in a single file and US1+US2 are the same code change:

1. **Phase 1**: Review code, baseline tests, measure lines (T001-T003)
2. **Phase 2**: Define GenerationConfig type and runGeneration template (T004-T005)
3. **Phase 3**: Extract four configs and thin methods (T006-T010) — this is the core refactoring
4. **Phase 4**: Verify tests pass, confirm API unchanged (T011-T012)
5. **Phase 5**: Validate line count, quickstart scenarios, confirm single-file diff (T013-T015)

### Verification Flow

```
npm test (baseline) → refactor → npm test (verify) → line count check → quickstart validation
```

After each task in Phase 3, running `npm test` is recommended to verify no regression was introduced. The final validation in Phase 4 is the formal acceptance gate.

---

## Notes

- [P] tasks = different conceptual areas of the same file (configs are independent)
- [US1] and [US2] share the same Phase because the code change is identical — both stories are satisfied simultaneously
- [US3] is verification-only (no test code modifications)
- Only `src/lessons/generator.ts` is modified — confirm with `git diff --stat`
- Commit after each Phase completes, or after each config task in Phase 3 if preferred
- Stop at any checkpoint to validate independently
