# ContentStore Interface Contract

## Purpose

The `ContentStore` interface defines the contract for reading and writing per-mission content documents (mission overview, notes, resources, glossary). It is part of the `DrizzleMissionStore` composite implementation and consumed by AI tool handlers in `src/ai/tools.ts`.

## Interface Definition

```typescript
export interface ContentStore {
  getMissionContent(missionId: number, contentType: string): Promise<MissionContentRow | undefined>;
  upsertMissionContent(values: {
    missionId: number;
    contentType: string;
    markdownContent: string;
  }): Promise<void>;
}
```

## Method: upsertMissionContent

### Signature (unchanged)
```typescript
upsertMissionContent(values: {
  missionId: number;
  contentType: string;
  markdownContent: string;
}): Promise<void>
```

### Preconditions
- `missionId` MUST reference an existing row in the `missions` table (FK constraint enforced by database).
- `contentType` MUST be one of: `"mission"`, `"notes"`, `"resources"`, `"glossary"`.
- `markdownContent` MUST be a non-null string (may be empty).

### Postconditions
- After the call completes successfully, exactly one row exists in `mission_content` for the given `(missionId, contentType)` pair.
- If no row existed before the call, a new row is created with `createdAt` set to the current timestamp.
- If a row already existed before the call, it is updated with the new `markdownContent` and `updatedAt` is refreshed.

### Atomicity Guarantee (NEW in this feature)
- Under concurrent calls with the same `(missionId, contentType)`, exactly one row exists after all calls complete — regardless of interleaving and ordering.
- No application-level locking, transaction isolation, or retry logic is required by callers.

### Error Conditions
- If `missionId` does not exist in `missions`: SQLITE_CONSTRAINT_FOREIGNKEY (unchanged).
- If `contentType` is not one of the enum values: Drizzle type error at TypeScript level (unchanged).
- No new error conditions are introduced by the atomic upsert change.

### Implementation (DrizzleMissionStore)

The implementation uses Drizzle's `onConflictDoUpdate()` on the INSERT builder:

```typescript
async upsertMissionContent(values: {
  missionId: number;
  contentType: string;
  markdownContent: string;
}): Promise<void> {
  await this.db.insert(schema.missionContent).values({
    missionId: values.missionId,
    contentType: values.contentType as any,
    markdownContent: values.markdownContent,
  }).onConflictDoUpdate({
    target: [
      schema.missionContent.missionId,
      schema.missionContent.contentType,
    ],
    set: {
      markdownContent: values.markdownContent,
      updatedAt: new Date().toISOString(),
    },
  });
}
```

### Test Doubles

`InMemoryContentStore` (in `src/db/store.ts`) implements the same contract using an in-memory array. The `upsertMissionContent` method already uses an atomic find-or-create pattern:

```typescript
async upsertMissionContent(v: { ... }) {
  const existing = this.missionContents.findIndex(c => c.missionId === v.missionId && c.contentType === v.contentType);
  if (existing >= 0) {
    this.missionContents[existing].markdownContent = v.markdownContent;
  } else {
    this.missionContents.push({ id: this.id(), ...v, ... });
  }
}
```

This remains unchanged — the in-memory store is single-threaded and does not suffer from the race condition, so no change is needed.
