---

description: "Task list for extracting JobStore interface from LessonGenerator"

---

# Tasks: Extract JobStore Interface

**Input**: Design documents from `/specs/021-extract-job-store/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Existing tests cover all LessonGenerator behavior. No new tests needed — the refactoring preserves existing behavior, and all existing tests must pass without modification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- TypeScript source: `src/lessons/` (single project layout)
- Tests: `src/test/` and `src/lessons/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies, packages, or configuration files are needed. The feature is a pure TypeScript refactoring within existing files.

No tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `JobStore` interface and `InMemoryJobStore` implementation that US1 depends on.

**CRITICAL**: Nothing in US1 can begin until this phase is complete.

- [X] T001 [P] Create `src/lessons/job-store.ts` with the `JobStore` interface, `InMemoryJobStore` class, and the `InternalJob` type (moved from `generator.ts`). The interface must have three methods: `getJob(key)`, `setJob(key, job)`, `deleteJob(key)`. `InMemoryJobStore` wraps `Map<string, InternalJob>`. `InternalJob` is exported from this module.

**Checkpoint**: `job-store.ts` defines a standalone module with the interface, in-memory implementation, and data type. Can be imported and used independently.

---

## Phase 3: User Story 1 - Extract job state into replaceable interface (Priority: P1) (MVP)

**Goal**: Wire the `JobStore` interface into `LessonGenerator` so it no longer owns an inline `Map<string, InternalJob>`. `GeneratorDeps` gains an optional `jobStore` field; when absent, `LessonGenerator` creates `InMemoryJobStore` internally. All existing call sites and tests continue to work without modification.

**Independent Test**: All existing tests in `src/test/generator.test.ts` and `src/lessons/generator.test.ts` pass without any changes.

### Implementation for User Story 1

- [X] T002 [US1] Update `src/lessons/generator.ts`:
  1. Remove the `InternalJob` type definition (now lives in `job-store.ts`)
  2. Import `InternalJob` and `JobStore` from `./job-store.js`
  3. Add optional `jobStore?: JobStore` field to `GeneratorDeps`
  4. Remove `private jobs = new Map<string, InternalJob>()` field
  5. In the constructor (or a private accessor), resolve the store: `private get jobStore(): JobStore { return this.deps.jobStore ?? this.fallbackStore; }` with a lazily-created `InMemoryJobStore`
  6. Replace all `this.jobs.get(key)` calls with `this.deps.jobStore.getJob(key)` (or `this.jobStore.getJob(key)` using the accessor)
  7. Replace `this.jobs.has(key)` with `this.deps.jobStore.getJob(key) !== undefined`
  8. Replace `this.jobs.set(key, job)` with `this.deps.jobStore.setJob(key, job)`
  9. Replace `this.jobs.delete(key)` with `this.deps.jobStore.deleteJob(key)`

- [X] T003 [US1] Update `createLessonGenerator()` factory in `src/lessons/generator.ts` to create and pass an `InMemoryJobStore` when one is not provided, ensuring existing callers (`src/index.ts`) work unchanged.

- [X] T004 [US1] Verify all existing tests pass:
  ```bash
  npm test
  ```
  Expected: All tests in `src/test/generator.test.ts` and `src/lessons/generator.test.ts` pass without modification (both files use `new LessonGenerator(...)` directly without passing `jobStore`, relying on the fallback.

**Checkpoint**: `LessonGenerator` no longer directly owns a `Map<string, InternalJob>`. All job state access delegates to `JobStore`. Existing behavior is unchanged.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and documentation updates.

- [X] T005 Validate by running the full test suite one more time:
  ```bash
  npm test
  ```

- [X] T006 Run the quickstart validation scenarios:
  - Instantiate `InMemoryJobStore` standalone
  - Verify getJob/setJob/deleteJob idempotency and lifecycle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — nothing to do
- **Foundational (Phase 2)**: No dependencies — can start immediately
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T001). T002 and T003 can be done in parallel within the same file (single developer).
- **Polish (Phase 4)**: Depends on Phase 3 completion

### User Story Dependencies

- **User Story 1 (P1)**: The only implementation story. US2 (multi-user persistence) is not implemented — only the seam is created.

### Within Each User Story

- Implementation before verification
- Single-file changes within `src/lessons/generator.ts`

### Parallel Opportunities

- T001 is independent and can run first
- T002 and T003 affect the same file (`generator.ts`) — must be sequential within the same file

---

## Parallel Example: User Story 1

```bash
# T001 must complete first:
Task: "Create src/lessons/job-store.ts with JobStore interface and InMemoryJobStore"

# Then T002-T003 (single file, sequential):
Task: "Update src/lessons/generator.ts to use JobStore via deps"
Task: "Update createLessonGenerator() factory"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: T001 — Create `job-store.ts`
2. Complete Phase 3: T002 — Update `generator.ts` (the core wire-up)
3. Complete Phase 3: T003 — Update factory
4. Complete Phase 3: T004 — Run tests
5. **STOP and VALIDATE**: MVP is complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The `JobStore` field in `GeneratorDeps` is **optional** to preserve backward compatibility with all existing call sites (`src/index.ts`, `src/test/generator.test.ts`, `src/lessons/generator.test.ts`). This is intentional — the feature creates the seam without forcing migration.
- No persistent adapter is built. YAGNI.
