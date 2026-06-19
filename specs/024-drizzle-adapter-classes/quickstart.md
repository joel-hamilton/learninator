# Quickstart: Drizzle Adapter Classes

## Validation Scenarios

Run these to validate the refactor is complete and correct:

### Scenario 1: Build Compiles

```bash
npx tsc --noEmit
```

Expected: Zero type errors. All imports resolve.

### Scenario 2: All Tests Pass

```bash
npm test
```

Expected: All existing tests pass (0 failures, 0 errors).

### Scenario 3: Verify InMemoryToolStore Removed

```bash
grep -r "InMemoryToolStore" src/
```

Expected: No matches found.

### Scenario 4: Verify DrizzleMissionStore Removed

```bash
grep -r "class DrizzleMissionStore" src/
```

Expected: No matches found.

### Scenario 5: Verify Individual Adapters Exist

```bash
ls src/db/adapters/
```

Expected: `drizzle-mission-adapter.ts`, `drizzle-lesson-adapter.ts`, `drizzle-chat-adapter.ts`, `drizzle-content-adapter.ts`, `drizzle-refdoc-adapter.ts`, `drizzle-learning-record-adapter.ts`, `drizzle-user-adapter.ts`, `drizzle-session-adapter.ts`, `index.ts`

### Scenario 6: Verify Each Adapter Implements One Interface

```bash
grep "implements" src/db/adapters/drizzle-*-adapter.ts
```

Expected: Each file has exactly one interface in its `implements` clause (except `index.ts` which has the composite).

### Scenario 7: Verify Services Receive Only Needed Interfaces

```bash
grep "store:" src/services/mission-chat.service.ts | head -1
grep "store:" src/lessons/generator.ts | head -1
grep "createToolExecutor" src/ai/tools.ts | head -1
```

Expected:
- MissionChatDeps.store = `MissionStore & ChatStore & ContentStore` (3 interfaces)
- GeneratorDeps.store = `MissionStore & LessonStore` (2 interfaces)
- createToolExecutor = `ToolStore` (6 interfaces)

### Scenario 8: Verify AppVariables.store Type

```bash
grep "store:" src/types.ts
```

Expected: `store: MissionStore & LessonStore & ChatStore & ContentStore & RefDocStore & LearningRecordStore & UserStore & SessionStore` (or similar intersection type).

## Rollback

If any validation scenario fails:
1. The refactor is incomplete — check that all call sites were updated
2. Restore from git: `git checkout -- src/`
3. Fix the specific issue and re-run scenarios 1-2
