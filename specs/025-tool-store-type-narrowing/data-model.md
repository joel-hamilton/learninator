# Data Model: Tool Store Type Narrowing

## Phase 1 — Design Artifacts

No new data entities are introduced. This feature only narrows existing TypeScript type annotations. The following documents the existing store interfaces as they relate to tool handlers.

## Store Interfaces (Existing, Not Changed)

All interfaces are defined in `src/db/store.ts`. Each is a focused read/write contract for a domain area:

| Interface | Role | Tool Handlers Using It |
|---|---|---|
| `ContentStore` | Read/write markdown content for mission sections (resources, etc.) | `readMissionContent`, `writeMissionContent`, `readResources`, `writeResources` |
| `LessonStore` | CRUD for lessons and sub-lessons, feedback | `createLesson`, `createSubLesson`, `readLesson`, `listLessons`, `listFeedbackHistory`, `regenerateLesson` |
| `ChatStore` | Guided questions storage | `askGuidedQuestion` |
| `RefDocStore` | Reference documents CRUD | `createReferenceDoc`, `listReferenceDocs` |
| `LearningRecordStore` | Learning records CRUD with status/superseded tracking | `createLearningRecord`, `listLearningRecords`, `updateLearningRecord` |
| `MissionStore` | Mission lifecycle (status transitions) | `markMissionActive` |

## ToolHandler Type (Will Be Adapted)

Defined in `src/ai/types.ts`. Currently:

```typescript
export type ToolStore = MissionStore & LessonStore & ChatStore & ContentStore & RefDocStore & LearningRecordStore;

export interface ToolHandlerContext {
  store: ToolStore
  missionId: number
  input: Record<string, unknown>
}

export type ToolHandler = (ctx: ToolHandlerContext) => Promise<string>
```

After this feature:
- `ToolStore` type alias remains unchanged
- `ToolHandlerContext` interface remains unchanged (not used by handlers)
- `ToolHandler` type alias remains (used only by the handler map, not individual handlers)
- Individual handlers use inline parameter types narrowed to their specific store interface
