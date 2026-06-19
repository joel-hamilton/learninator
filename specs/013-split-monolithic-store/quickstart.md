# Quickstart: Split Monolithic MissionStore

## Prerequisites

- Node.js 22, npm
- All existing tests pass on `main`: `npm test`

## Validation Steps

### 1. Verify focused interfaces exist

```bash
# Each focused interface should be exported from store.ts
grep -n "export interface" src/db/store.ts
```

Expected: 7 interfaces — `MissionStore`, `LessonStore`, `ChatStore`, `ContentStore`, `RefDocStore`, `LearningRecordStore`, `UserStore`.

### 2. Verify MissionStore is focused (≤ 8 methods)

```bash
# Count methods on MissionStore interface
grep -c "Promise<" src/db/store.ts
```

The focused `MissionStore` (after the split) should have exactly 7 methods.

### 3. Verify no compatibility aliases remain

```bash
grep -n "Compatibility aliases" src/db/store.ts
```

Expected: No matches.

```bash
# Search for any alias method definition
grep -n "readMissionContent\|upsertMissionContentPos\|getMainLessonByNumber\|insertLesson\|insertReferenceDoc\|insertLearningRecord\|insertGuidedQuestion\|updateLearningRecordPos" src/db/store.ts
```

Expected: No matches for alias wrapper methods.

### 4. Verify callers use focused interfaces

```bash
# Chat should use ChatStore
grep -n "ChatStore\|MissionStore" src/ai/conversation.ts

# Shared messages should use ChatStore
grep -n "ChatStore\|MissionStore" src/shared/messages.ts

# Auth should use UserStore
grep -n "UserStore\|MissionStore" src/auth/index.ts

# Settings should use UserStore
grep -n "UserStore\|MissionStore" src/routes/settings.ts
```

### 5. Run full test suite

```bash
npm test
```

Expected: All tests pass. Exit code 0.

### 6. Verify InMemory stores are focused

```bash
grep -n "export class InMemory" src/db/store.ts
```

Expected: 7 `InMemory*` classes (not a single monolithic `InMemoryMissionStore`).

### 7. Verify store.test.ts split

```bash
ls src/db/__tests__/
```

Expected: Per-interface test files like `mission-store.test.ts`, `lesson-store.test.ts`, etc.
