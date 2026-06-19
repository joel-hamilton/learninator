# Data Model: Relocate Message Persistence

No new data entities are introduced. This is a pure code relocation with no schema changes, no new database tables, and no new data types.

## Existing Data Entities (unchanged)

### ChatMessage (in `src/db/schema.ts`)

| Field | Type | Notes |
|-------|------|-------|
| id | integer (PK) | Auto-increment |
| missionId | integer (FK → missions.id) | With index |
| role | text | "user" or "assistant" |
| content | text | JSON-serialized content |
| createdAt | text | ISO 8601 timestamp |

### ChatStore (in `src/db/store.ts`)

The `ChatStore` interface (already defined) provides:
- `saveChatMessage(params)` — persists a chat message row
- `getChatMessages(missionId)` — retrieves all messages for a mission, ordered by creation time

## Moved Functions (no signature change)

| Function | Current Location | New Location |
|----------|-----------------|--------------|
| `saveMessage(store, missionId, role, content)` | `src/shared/messages.ts` | `src/ai/persistence.ts` |
| `loadMessages(store, missionId)` | `src/shared/messages.ts` | `src/ai/persistence.ts` |
| `contentToText(content)` | `src/shared/messages.ts` | `src/views/shared.ts` |
