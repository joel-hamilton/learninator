# Quickstart: Typing the InMemory Store Adapters

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- TypeScript 5.x with `--strict` mode (enabled via `tsconfig.json`)

## Validation Scenarios

### Scenario 1: Compile-time type safety (SC-001, SC-004)

Verify that all InMemory store collections use typed arrays instead of `any[]`.

```bash
# TypeScript compilation must succeed with zero type errors
npx tsc --noEmit --strict
```

**Expected**: Exit code 0, no type errors. Any remaining `any` in InMemory store declarations counts as a failure.

### Scenario 2: Enum validation at compile time (SC-002)

To verify the fix works, introduce a deliberate type error in an InMemory store method call (e.g., pass `"inactive"` instead of `"active"` to `updateMissionStatus`). This should be done temporarily — the failing test demonstrates proof.

This scenario is for manual verification only and should be reverted before committing.

**Expected**: TypeScript reports a compile error for the invalid enum value.

### Scenario 3: Full test suite (SC-003)

```bash
# All existing tests must pass without any modifications
npm test
```

**Expected**: All tests pass with exit code 0. No test file was modified.

### Scenario 4: Editor intellisense (SC-005)

Open `src/db/store.ts` and inspect any InMemory store method. Hovering over the return value should show the exact row type (e.g., `MissionRow`, `LessonRow`) with full property autocompletion.

**Expected**: Editor shows concrete row types, not `any`.

## Mapping Reference

Each InMemory store class maps to its row type for the internal collection. For full details, see `data-model.md`.

| InMemory Store Class | Collection Type | Row Type |
|---|---|---|
| `InMemoryMissionStore` | `missions: MissionRow[]` | `MissionRow` |
| `InMemoryLessonStore` | `lessons: LessonRow[]` | `LessonRow` |
| `InMemoryChatStore` | `chatMessages: ChatMessageRow[]` + `guidedQuestions: GuidedQuestionRow[]` | `ChatMessageRow`, `GuidedQuestionRow` |
| `InMemoryContentStore` | `missionContents: MissionContentRow[]` | `MissionContentRow` |
| `InMemoryRefDocStore` | `referenceDocs: ReferenceDocRow[]` | `ReferenceDocRow` |
| `InMemoryLearningRecordStore` | `learningRecords: LearningRecordRow[]` | `LearningRecordRow` |
| `InMemoryUserStore` | `users: UserRow[]` | `UserRow` |
| `InMemorySessionStore` | `sessions: SessionRow[]` | `SessionRow` |
