# Research: Tool Store Type Narrowing

## Phase 0 — Unknowns Resolution

No `[NEEDS CLARIFICATION]` markers exist in the specification. All unknowns were resolved during spec creation:

### Decision: Type assertion strategy for handler map

- **Decision**: Use `as ToolHandler` cast in `buildHandlerMap()`
- **Rationale**: Each handler accepts a narrower parameter type than `ToolHandlerContext`. TypeScript's structural typing ensures the cast is safe — `ToolStore` (the concrete runtime type) satisfies all narrower interfaces. The cast is confined to the map construction and does not leak into handler implementations.
- **Alternatives considered**:
  1. **Union type for Map values**: `Map<string, (ctx: ToolHandlerContext | NarrowedCtx1 | ...) => ...>` — type-safe but verbose and harder to maintain.
  2. **Generic wrapper**: `wrap<C>(handler: (ctx: C) => ...): ToolHandler` — unnecessary abstraction for zero-runtime-cost change.

### Decision: ToolHandler type alias

- **Decision**: Keep the `ToolHandler` type alias in `src/ai/types.ts` for internal use by `buildHandlerMap()`
- **Rationale**: Removes the need to change `types.ts`. The alias serves as the map's value type constraint. It is no longer used as the parameter type of individual handlers, but remains as a backward-compatible type for the map.

### Decision: `readResources` and `writeResources` delegation

- **Decision**: Narrow these to `ContentStore` (matching their delegate targets)
- **Rationale**: They delegate to `readMissionContent` / `writeMissionContent` which require `ContentStore`. Their own store type must be compatible.

### Decision: No handler uses multiple interfaces

- **Finding**: Every handler's method calls fall within a single store interface. No handler requires an intersection of multiple interfaces. The mapping is one-to-one.

## Technology Choices

No new technologies introduced. Existing TypeScript structural typing behavior is leveraged.
