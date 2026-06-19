# Tasks: Relocate Message Persistence

**Input**: Design documents from `specs/024-relocate-message-persistence/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Organization**: Tasks are grouped by logical step since this is a pure relocation refactoring with no new features. Both user stories are addressed in a single execution flow.

## Phase 1: Create `src/ai/persistence.ts` with `saveMessage` and `loadMessages`

**Purpose**: Move the AI-layer persistence functions to their new home in the `src/ai/` module, omitting the unused `eq` and `asc` imports from drizzle-orm.

- [X] T001 Create `src/ai/persistence.ts` — copy `saveMessage` and `loadMessages` from `src/shared/messages.ts` with these changes:
  - Remove unused `import { eq, asc } from "drizzle-orm"` — not needed by either function
  - Keep existing imports: `type { AiMessageParam }` from `./types.js` and `type { ChatStore }` from `../db/store.js`
  - Both functions must preserve their exact signatures and behavior

---

## Phase 2: Add `contentToText` to `src/views/shared.ts`

**Purpose**: Move the display-only function to the views layer alongside existing rendering helpers.

- [X] T002 Add `contentToText` function to `src/views/shared.ts` — copy the function body from `src/shared/messages.ts` into the views shared module. It needs no additional imports (it only uses `JSON.parse`, `Array.isArray`, and `String` — all globals).

---

## Phase 3: Update All Consumer Import Paths

**Purpose**: Point all importers to the new module locations so the application continues to compile and function correctly.

**All three files below can be updated in parallel (they touch different files).**

- [X] T003 [P] Update `src/ai/conversation.ts` — change `import { saveMessage } from "../shared/messages.js"` to `import { saveMessage } from "./persistence.js"`
- [X] T004 [P] Update `src/services/mission-chat.service.ts` — change `import { saveMessage, loadMessages } from "../shared/messages.js"` to `import { saveMessage, loadMessages } from "../ai/persistence.js"`
- [X] T005 [P] Update `src/routes/missions.ts` — change the combined import line (currently `import { saveMessage, contentToText, loadMessages } from "../shared/messages.js";import { formatMarkdown } from "../shared/markdown.js";`) to two imports: `import { saveMessage, loadMessages } from "../ai/persistence.js";` and `import { contentToText } from "../views/shared.js";` keeping the markdown import unchanged

---

## Phase 4: Delete `src/shared/messages.ts`

**Purpose**: Remove the now-empty module after confirming no remaining references.

- [X] T006 Verify no remaining imports from `../shared/messages.js` by running `grep -rn "../shared/messages" src/ --include="*.ts"` — confirm zero matches
- [X] T007 Delete `src/shared/messages.ts`

---

## Phase 5: Verify

**Purpose**: Confirm the relocation is complete and the application works correctly.

- [X] T008 Run `npx tsc --noEmit` to verify TypeScript compilation succeeds with no errors
- [X] T009 Run `npm test` to confirm all existing tests pass
- [X] T010 Run `grep -rn "eq\|asc" src/ai/persistence.ts` to confirm unused imports were not carried over

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (persistence.ts)**: No dependencies — can start immediately
- **Phase 2 (contentToText)**: No dependencies — can start in parallel with Phase 1
- **Phase 3 (import updates)**: Depends on Phase 1 and Phase 2 being complete (files must exist at new locations)
- **Phase 4 (delete old file)**: Depends on Phase 3 being complete (all consumers must point to new locations)
- **Phase 5 (verify)**: Depends on Phase 4 being complete

### Parallel Opportunities

- T001 (Phase 1) and T002 (Phase 2) can run in parallel
- T003, T004, T005 (Phase 3) can all run in parallel once Phase 1 and 2 are done
- T006 and T007 must be sequential (verify before delete)

```bash
# Phase 1 & 2 — parallel:
Task: "T001 Create src/ai/persistence.ts"
Task: "T002 Add contentToText to src/views/shared.ts"

# Phase 3 — all parallel after Phase 1+2:
Task: "T003 Update src/ai/conversation.ts import"
Task: "T004 Update src/services/mission-chat.service.ts import"
Task: "T005 Update src/routes/missions.ts import"
```

## Implementation Strategy

This is a single-increment refactoring. All phases must complete for the feature to be considered done — there is no meaningful intermediate state (a partially relocated module would break the build).

1. Create the new files first (T001, T002 — parallel)
2. Update all import paths (T003, T004, T005 — parallel)
3. Verify no remaining references (T006)
4. Delete the old file (T007)
5. Run compilation and test suite (T008, T009, T010)
