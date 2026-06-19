# Research: Relocate Message Persistence

## Phase 0 — Unknowns Resolution

### Unknown: Where should saveMessage and loadMessages live?

**Decision**: New file `src/ai/persistence.ts`

**Rationale**: 
- `createStandardHooks` in `src/ai/conversation.ts` is the primary caller of `saveMessage`. Loading the functions into a separate `persistence.ts` module rather than inlining them into `conversation.ts` preserves separation of concerns (conversation loop logic vs. persistence logic).
- `mission-chat.service.ts` also imports both functions — placing them in `src/ai/` keeps AI-layer concerns together.
- The orphaned `tool_result` filtering in `loadMessages` is AI-specific logic (it depends on the conversation tool-use protocol), confirming its place in the AI layer.
- Creating `src/ai/persistence.ts` follows the existing modular structure of `src/ai/` (conversation.ts, teacher.ts, tools.ts, events.ts, etc.) and keeps each file focused.

**Alternatives considered**:
- **Inline into `conversation.ts`**: Would create a longer file mixing persistence with conversation loop logic. Less cohesive.
- **Keep in `src/shared/`**: Current location, but the logic is not "shared" — it is AI-specific.

### Unknown: Are there additional consumers beyond the three listed files?

**Decision**: No additional files import from `src/shared/messages.js`. Verified by:
- Codebase inspection of 26 source files matching `src/shared/messages` import pattern
- Test files in `src/test/` do not import from messages.ts directly — they test via HTTP endpoints

### Unknown: Will tests need import path updates?

**Decision**: No test files import directly from `src/shared/messages.ts`. Tests exercise message persistence through the HTTP endpoints only, so no test modifications are needed.

### Unknown: Should `src/shared/` directory be deleted?

**Decision**: Only delete `src/shared/messages.ts`. Keep the `src/shared/` directory as it may contain other modules (markdown.ts, slug.ts, activate-mission.ts) and the directory itself carries no baggage.

## Related Patterns

- **AI module pattern**: `src/ai/` already contains specialized modules (`teacher.ts`, `tools.ts`, `events.ts`, `errors.ts`, `conversation.ts`, `workflow-state.ts`). Adding `persistence.ts` follows the established convention.
- **View module pattern**: `src/views/shared.ts` already exports display utilities (SVG icons, user menu, spinner). Adding `contentToText` is consistent with its purpose.
