# Contracts: Relocate Message Persistence

This feature is a pure code relocation — no external interfaces, no API changes, no new contracts.

The moved functions preserve their exact TypeScript signatures (verified against the existing codebase):

## `saveMessage`

```typescript
export async function saveMessage(
  store: ChatStore,
  missionId: number,
  role: "user" | "assistant",
  content: unknown
): Promise<void>
```

## `loadMessages`

```typescript
export async function loadMessages(
  store: ChatStore,
  missionId: number
): Promise<AiMessageParam[]>
```

## `contentToText`

```typescript
export function contentToText(content: string): string
```

All three functions have zero behavioral changes. The contracts are identical before and after the move.
