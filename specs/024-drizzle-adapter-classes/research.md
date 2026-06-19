# Research: Drizzle Adapter Classes

## Decision Overview

All technical context is already well-understood from the existing codebase. No unknowns required investigation.

## Current Wiring Analysis

### `ToolStore` type (`src/ai/types.ts:78`)
```typescript
export type ToolStore = MissionStore & LessonStore & ChatStore & ContentStore & RefDocStore & LearningRecordStore;
```
Used by `createToolExecutor()` and `ToolHandlerContext`. The tool handlers use all 6 interfaces.

### `createStandardHooks` (`src/ai/conversation.ts:59-63`)
Already accepts `ChatStore` — no change needed.

### `saveMessage` / `loadMessages` (`src/shared/messages.ts`)
Already accept `ChatStore` — no change needed.

### `MissionChatDeps.store` (`src/services/mission-chat.service.ts:16`)
```typescript
store: MissionStore & ChatStore & ContentStore
```
Needs 3 interfaces for: mission status checks (MissionStore), chat persistence (ChatStore), mission content reading (ContentStore).

### `GeneratorDeps.store` (`src/lessons/generator.ts:25`)
```typescript
store: MissionStore & LessonStore
```
Needs 2 interfaces for: lesson CRUD (LessonStore), mission reads (MissionStore).

### `createToolExecutor` (`src/ai/tools.ts:264`)
Takes `ToolStore` — needs all 6 tool-accessible interfaces.

### `AppVariables.store` (`src/types.ts:33`)
```typescript
store: DrizzleMissionStore
```
Concrete class type. Change to intersection of all 8 store interfaces.

## Key Decisions

### Decision 1: Adapter files location
**Decision**: `src/db/adapters/` directory, one file per adapter.
**Rationale**: `src/db/` already has `store.ts`, `schema.ts`, `index.ts`, `migrate.ts`. A subdirectory keeps adapter files organized without cluttering the parent.
**Alternatives considered**: Single file with all adapters (defeats purpose of splitting).

### Decision 2: Convenience composite class
**Decision**: Create a `DrizzleStore` composite class at `src/db/adapters/index.ts` that composes all 8 adapters for use as `c.get("store")`.
**Rationale**: Preserves backward compatibility for ~20 call sites across route handlers, middleware, and event handlers that access `c.get("store")`. Each service/tool executor still receives only the specific adapters it needs.
**Alternatives considered**: 
- Intersection type only (forces all call sites to import all 8 adapters — verbose)
- Spread individual adapters across `AppVariables` (too many context variables)

### Decision 3: InMemoryToolStore deletion
**Decision**: Delete `InMemoryToolStore`. Tests already can use individual InMemory* stores.
**Rationale**: The class adds zero value — every method is a one-line delegation.
**Impact**: Search for all test imports of `InMemoryToolStore` and update them.

### Decision 4: Adapter naming convention
**Decision**: `Drizzle{Name}Adapter` where `{Name}` matches the interface name minus "Store" suffix (e.g., `DrizzleMissionAdapter` implements `MissionStore`).
**Rationale**: Clear mapping from class name to interface.

### Session Store Note
`DrizzleSessionAdapter` is needed for consistency but `InMemorySessionStore` already exists independently. The auth middleware currently uses `DrizzleMissionStore` for sessions — this will be migrated to `DrizzleSessionAdapter`.
