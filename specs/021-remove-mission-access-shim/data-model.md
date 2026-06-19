# Data Model: Remove Mission Access Pass-Through

## No Changes

This feature does not add, modify, or remove any database entities, columns, or relationships. It is purely a code refactoring that removes a pass-through module.

## Existing Entities (unchanged)

### MissionRow (`src/db/store.ts`)

Defined as the return type of `MissionStore.getMission()`. Remains unchanged.

Key field for access control: `userId: number` -- the owning user's ID, used in the `store.getMission(missionId, userId)` query to scope access.

### MissionStore interface (`src/db/store.ts`)

The `getMission(missionId, userId)` method signature:
```ts
getMission(missionId: number, userId: number): Promise<MissionRow | undefined>
```

Returns `undefined` when the mission does not exist or does not belong to `userId`. Remains unchanged.

## Validation Rules (inlined from removed module)

The following validation was previously in `requireMissionAccess` and is now inlined at each route:

- If `missionId` is `NaN` (from `Number.isNaN`), return 404
- If `missionId < 1`, return 404
- If `store.getMission(missionId, userId)` returns `undefined`, return 404

## State Transitions

Not applicable -- this feature does not alter any state machine or workflow.
