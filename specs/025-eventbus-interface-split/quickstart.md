# Quickstart: EventBus Interface Split

## Prerequisites

- TypeScript project compiled with `tsc --noEmit` or via `npm run dev`
- Existing test suite passing on `main` branch

## Validation scenarios

### 1. TypeScript compilation succeeds

```bash
npx tsc --noEmit
```

**Expected**: Zero type errors. All consumer modules correctly reference the appropriate sub-interface.

### 2. All existing tests pass

```bash
npm test
```

**Expected**: All tests pass. No test logic changes — only import/type reference updates in:
- `src/test/generator.test.ts` (spyEventBus return type)
- `src/lessons/generator.test.ts` (FakeEventBus `implements` clause)

### 3. Verify consumer isolation (manual spot-check)

Check that the following modules only import the interface they need:

| Module | Should import | Should NOT have access to |
|--------|--------------|--------------------------|
| `src/ai/conversation.ts` | `ToolEventBus` | `subscribeUser`, `emitUser` |
| `src/ai/workflow-state.ts` | `WorkflowEventBus` | `subscribe`, `emit` |
| `src/lessons/generator.ts` | `ToolEventBus` | `subscribeUser`, `emitUser` |
| `src/routes/home.ts` | `WorkflowEventBus` (via context) | `subscribe`, `emit` |
| `src/services/mission-chat.service.ts` | Both (intersection) | Must have access to all four methods |
| `src/index.ts` | Both (intersection via return type) | Must have access to all four methods |

### 4. Verify `createEventBus()` satisfies both interfaces (manual spot-check)

```typescript
const bus = createEventBus();
// bus.subscribe()          ← should compile (ToolEventBus)
// bus.emit()               ← should compile (ToolEventBus)
// bus.subscribeUser()      ← should compile (WorkflowEventBus)
// bus.emitUser()           ← should compile (WorkflowEventBus)
```
