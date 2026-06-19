---

description: "Task list for deduplicating tool display labels across the codebase"

---

# Tasks: Deduplicate Tool Display Labels

**Input**: Design documents from `specs/024-deduplicate-tool-labels/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are not explicitly requested. The existing test suite (`npm test`) serves as the validation mechanism -- all tests must pass after the refactoring.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Both user stories are P1 and share the same implementation tasks.

## Path Conventions

**Single project**: `src/` at repository root. Three files to modify:
- `src/ai/tools.ts`
- `src/ai/workflow-state.ts`
- `src/lessons/generator.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed. Codebase is already set up.

- [ ] T001 Confirm `npm test` passes before making any changes
- [ ] T002 Verify current tool name coverage across all three locations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational infrastructure needed. This is a pure code refactoring with no new dependencies, schemas, or services.

Nothing to do in this phase. Proceed directly to implementation.

---

## Phase 3: User Story 1 - Consistent tool labels across the UI (Priority: P1)

**Goal**: Ensure that when the AI executes a tool during a conversation, the label displayed in the UI is the same regardless of whether it's rendered by the conversation loop, the workflow state manager, or the lesson generator. Eliminate user-facing inconsistency.

**Independent Test**: All existing tests pass without modification. A manual check confirms that `toolDisplayLabel()` in workflow-state.ts and `toolLabel()` in generator.ts both resolve to TOOL_DISPLAY_NAMES entries for all registered tool names.

### Implementation

- [ ] T003 [P] [US1] Add `search_web`, `read_reference_doc`, and `read_learning_record` entries to `TOOL_DISPLAY_NAMES` in `src/ai/tools.ts` at line 218, using the label text from the old TOOL_LABELS record
- [ ] T004 [P] [US1] Update `toolDisplayLabel()` in `src/ai/workflow-state.ts`: add import of `TOOL_DISPLAY_NAMES` from `"./tools.js"`, replace usage of `TOOL_LABELS` with `TOOL_DISPLAY_NAMES`, and delete the `TOOL_LABELS` record (lines 32-49)
- [ ] T005 [P] [US1] Update `toolLabel()` in `src/lessons/generator.ts`: add import of `TOOL_DISPLAY_NAMES` from `"../ai/index.js"`, refactor the switch/default to use `TOOL_DISPLAY_NAMES` as the base source, keeping only input interpolation logic for tools that need it (e.g., `read_lesson` with number, `create_lesson` with title, `create_sub_lesson` with title, `create_reference_doc` with title, `regenerate_lesson` with title)

**Checkpoint**: At this point, tool labels are sourced from `TOOL_DISPLAY_NAMES` everywhere. Run `npm test` to verify all tests pass.

---

## Phase 4: User Story 2 - Single source of truth for tool labels (Priority: P1)

**Goal**: Developers modifying tool labels should only need to edit one location -- `TOOL_DISPLAY_NAMES` in `tools.ts`. The workflow-state.ts and generator.ts modules both read from this record.

**Independent Test**: Search the codebase for `TOOL_LABELS` -- it should not appear in `workflow-state.ts`. Verify `toolDisplayLabel()` resolves from `TOOL_DISPLAY_NAMES`. Verify `toolLabel()` in generator.ts delegates to `TOOL_DISPLAY_NAMES` for all static labels.

### Implementation

Note: All implementation tasks for this story were completed in Phase 3. This phase consists of verification only.

- [ ] T006 [US2] Run `grep -c TOOL_LABELS src/ai/workflow-state.ts` to confirm zero references remain
- [ ] T007 [US2] Run `npm test` to confirm all tests pass after all changes
- [ ] T008 [US2] Run a quick sanity check that the new labels are accessible:

```bash
npx tsx -e "
import { TOOL_DISPLAY_NAMES } from './src/ai/tools.js';
import { toolDisplayLabel } from './src/ai/workflow-state.js';
const names = Object.keys(TOOL_DISPLAY_NAMES);
let ok = true;
for (const name of names) {
  if (toolDisplayLabel(name) !== TOOL_DISPLAY_NAMES[name]) {
    console.error('MISMATCH:', name, '->', toolDisplayLabel(name), '!==', TOOL_DISPLAY_NAMES[name]);
    ok = false;
  }
}
if (ok) console.log('All', names.length, 'labels match TOOL_DISPLAY_NAMES.');
"
```

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: No cross-cutting concerns. The refactoring is complete after Phases 3 and 4.

- [ ] T009 Verify there are no remaining references to the deleted `TOOL_LABELS` identifier anywhere in the codebase:

```bash
grep -rn "TOOL_LABELS" src/ --include='*.ts' && echo "ERROR: TOOL_LABELS still referenced" || echo "OK: no TOOL_LABELS references remain"
```

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies -- T001 and T002 can run immediately
- **Phase 2 (Foundational)**: Empty -- skip
- **Phase 3 (US1)**: Must have Phase 1 verification complete (tests known passing before change)
- **Phase 4 (US2)**: Verification only -- depends on Phase 3 implementation being complete
- **Phase 5 (Polish)**: Depends on Phases 3 and 4 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1 -- all three tasks (T003, T004, T005) are independent and can run in parallel
- **User Story 2 (P1)**: Verification only -- no implementation beyond US1

### Parallel Opportunities

- T003, T004, and T005 are all marked [P] -- they modify different files and have no dependencies on each other
- They are safe to execute simultaneously by different agents

---

## Parallel Example: User Story 1

```bash
# All three tasks can run in parallel (different files, no interdependencies):
Task: "Add search_web, read_reference_doc, read_learning_record to TOOL_DISPLAY_NAMES in src/ai/tools.ts"
Task: "Update toolDisplayLabel in src/ai/workflow-state.ts to use TOOL_DISPLAY_NAMES, delete TOOL_LABELS"
Task: "Update toolLabel in src/lessons/generator.ts to use TOOL_DISPLAY_NAMES as base"
```

---

## Implementation Strategy

### MVP First (Phase 3 Only)

1. Complete Phase 1: T001 (verify tests pass) and T002 (note current state)
2. Complete Phase 3: T003, T004, T005 in parallel
3. **STOP and VALIDATE**: Run `npm test`
4. Phase 4: Verify TOOL_LABELS is gone
5. Deploy

### Incremental Delivery

1. All three file modifications can be applied in parallel since they touch different files
2. Run `npm test` to validate
3. No incremental intermediate steps are meaningful for a 3-file refactoring of this size

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Run `npm test` after all changes are applied
- The `toolLabel()` method in generator.ts must preserve input-aware formatting for tools that need it (e.g., "Reviewing lesson 3..." instead of "Reading lesson")
- Label text values must not change -- only the mechanism for resolving them changes
- There is a `test:watch` script (`npm run test:watch`) if iterative testing is preferred
