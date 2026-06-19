# Contract: `handleActivation()` Helper

## Module

`src/shared/activate-mission.ts`

## Function Signature

```typescript
import type { Context } from "hono";
import type { AppVariables } from "../types.js";
import type { MissionChatService } from "../services/mission-chat.service.js";
import type { MissionChatResult } from "../services/mission-chat.service.js";

/**
 * Handle mission activation after a `missionChatService.run()` call.
 *
 * If `result.didActivate` is true, generates a mission title and redirects
 * the client to the mission page via `HX-Redirect`. Otherwise, returns
 * `undefined` so the caller can proceed with normal response rendering.
 *
 * @param result        The result from missionChatService.run()
 * @param missionId     The mission ID
 * @param missionChatService  The mission chat service instance from context
 * @param c             The Hono context (for setting headers and returning response)
 * @returns A Response (empty body, 200) if activated, or undefined if not
 */
export function handleActivation(
  result: { didActivate: boolean },
  missionId: number,
  missionChatService: Pick<MissionChatService, "generateTitle">,
  c: Context,
): Response | undefined;
```

## Contract Rules

1. **Input guard**: If `result.didActivate` is falsy, the function MUST return `undefined` immediately without calling `generateTitle` or modifying headers.
2. **Title generation**: `missionChatService.generateTitle(missionId)` MUST be called and `await`ed BEFORE setting the redirect header.
3. **Header**: The `HX-Redirect` header MUST be set to `/missions/${missionId}`.
4. **Response body**: The function MUST return `c.body(null)` (empty body, status 200).
5. **No side effects**: Besides title generation, headers, and return value, the function MUST NOT perform any other side effects (logging, notifications, etc.).
6. **Error propagation**: If `generateTitle()` throws, the error MUST propagate to the caller uncaught — the helper MUST NOT swallow exceptions.

## Caller Contract

Each route handler that previously contained the inline `didActivate` block MUST replace it with:

```typescript
const activated = handleActivation(result, missionId, missionChatService, c);
if (activated) return activated;
```

This is the ONLY code that route handlers should contain related to activation handling.

## Test Contract

Existing HTTP-level tests (in `missions.test.ts`, `onboarding.test.ts`, `chat.test.ts`) MUST pass without modification. The `FakeAiClient` queue entry consumption pattern must remain identical — activation flows still consume 3 queue entries per activation.
