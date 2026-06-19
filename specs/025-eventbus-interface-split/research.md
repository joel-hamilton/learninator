# Research: EventBus Interface Split

## Task 1: Confirm all `EventBus` import sites

### Source files (types + imports that need updating)

| File | Current Usage | New Interface |
|------|---------------|---------------|
| `src/ai/events.ts` | Defines `EventBus` interface + `createEventBus(): EventBus` | Split into `ToolEventBus` + `WorkflowEventBus`; `createEventBus()` returns intersection |
| `src/ai/index.ts` | Barrel exports `EventBus` | Export `ToolEventBus` + `WorkflowEventBus` instead |
| `src/ai/conversation.ts` | `import type { EventBus }`; `events?: EventBus` param | `import type { ToolEventBus }`; `events?: ToolEventBus` |
| `src/ai/workflow-state.ts` | `import type { EventBus }`; constructor param `events: EventBus` | `import type { WorkflowEventBus }`; param `events: WorkflowEventBus` |
| `src/services/mission-chat.service.ts` | `import type { EventBus }`; deps `events: EventBus` | Import both; `events: ToolEventBus & WorkflowEventBus` or separate fields |
| `src/lessons/generator.ts` | `import type { EventBus }`; options `events?: EventBus` | `import type { ToolEventBus }`; `events?: ToolEventBus` |
| `src/types.ts` | `import type { EventBus }`; `events: EventBus` in AppVariables | `import type { ToolEventBus, WorkflowEventBus }`; `events: ToolEventBus & WorkflowEventBus` |
| `src/index.ts` | `createEventBus()` — autowired, no explicit type annotation | No change needed (return type satisfies both interfaces) |

### Test files

| File | Current Usage | New Interface |
|------|---------------|---------------|
| `src/test/conversation.test.ts` | `createEventBus()` for setup | No change (return type still valid) |
| `src/test/generator.test.ts` | `spyEventBus(): { bus: EventBus }` | Change to `ToolEventBus` |
| `src/lessons/generator.test.ts` | `createEventBus()` + `FakeEventBus implements EventBus` | `FakeEventBus` implements `ToolEventBus` |

## Task 2: Confirm type compatibility

**Decision**: Use TypeScript intersection type `ToolEventBus & WorkflowEventBus`.

**Rationale**: The `createEventBus()` function already implements all four methods (`subscribe`, `emit`, `subscribeUser`, `emitUser`). In TypeScript's structural type system, the return value already satisfies both interfaces independently. The intersection type simply documents this fact at the return type.

**Alternatives considered**:
- Two separate factory functions (`createToolEventBus()` + `createWorkflowEventBus()`): Unnecessary complexity since the current implementation already handles both domains in one closure.
- Keeping `EventBus` as a type alias for the intersection: Defeats the purpose of the split by preserving the name but still works technically.

## Task 3: Check barrel export

**Decision**: Update `src/ai/index.ts` to export `ToolEventBus` and `WorkflowEventBus` instead of `EventBus`. Optionally keep `EventBus` as an exported alias for the intersection type to smooth migration.

**Current export**: `export type { EventBus, ToolEvent, WorkflowEvent } from "./events.js"`

**New export**: `export type { ToolEventBus, WorkflowEventBus, ToolEvent, WorkflowEvent } from "./events.js"`

## Summary of changes

- **12 files modified** (8 source + 3 test + 1 types)
- **No new files created**
- **No runtime behavior change**
- **No database schema changes**
- **All existing tests pass with only import/type updates**
