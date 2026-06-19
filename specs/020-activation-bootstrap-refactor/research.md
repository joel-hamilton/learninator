# Research: Consolidate Activation Bootstrap

## Status

All design questions resolved by codebase analysis. No NEEDS CLARIFICATION items.

## Codebase Findings

### Five duplicated `didActivate` blocks identified

| # | File | Line | Handler |
|---|------|------|---------|
| 1 | `src/routes/missions.ts` | 97 | Mission creation from message |
| 2 | `src/routes/missions.ts` | 340 | Chat route handler |
| 3 | `src/routes/onboarding.ts` | 38 | Guided start |
| 4 | `src/routes/onboarding.ts` | 95 | Guided answer |
| 5 | `src/routes/onboarding.ts` | 143 | Guided skip |

### The duplicated block is identical in all five locations

```typescript
if (result.didActivate) {
  await missionChatService.generateTitle(missionId);
  c.header("HX-Redirect", `/missions/${missionId}`);
  return c.body(null);
}
```

### Helper signature requirements

- `result`: `MissionChatResult` (from `mission-chat.service.ts`) — has `didActivate: boolean` field
- `missionId`: `number`
- `missionChatService`: `MissionChatService` type — exposes `generateTitle(missionId: number): Promise<string | null>`
- `c`: Hono `Context<{ Variables: AppVariables }>` — for `c.header()` and `c.body()`
- Return: `Response | undefined` — the `c.body(null)` response when activated, or `undefined` to signal "not activated, continue"

### Circular dependency analysis

- Routes import from `services/mission-chat.service.ts` (the `MissionChatService` type)
- `services/mission-chat.service.ts` imports from `ai/` and `db/` — not from `routes/`
- A new module in `src/shared/` would import from `services/` (type only) and `hono` (Context type)
- No circular dependency risk: `src/shared/` does not import routes, and nothing imports from it yet (routes will import from it)

### Decision: Module location

**Chosen**: `src/shared/activate-mission.ts`

**Rationale**: The `src/shared/` directory already exists and is the appropriate layer for shared utilities. It sits below both routes and services in the dependency hierarchy, so importing the `MissionChatService` type (from services) and Hono `Context` type (from hono) creates no cycles.

**Alternatives considered**: 
- Adding the helper to `src/services/mission-chat.service.ts` — too tightly coupled; violates separation of concerns (the service shouldn't know about HTTP response headers).
- Adding the helper to an existing shared module — no existing module is a natural fit; a dedicated module is cleaner.
