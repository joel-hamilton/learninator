# Contract: conversationLoop

**Location**: `src/ai/conversation.ts`  
**Export name**: `conversationLoop`  
**Signature**: `async function conversationLoop(params: ConversationLoopParams): Promise<ConversationLoopResult>`

---

## Purpose

Drives the multi-turn AI conversation loop: sends messages to the AI, executes tool calls server-side, and continues until the AI produces a text-only response or a tool named in `pauseOnTools` is encountered.

---

## Input Contract

### ConversationLoopParams

```typescript
interface ConversationLoopParams {
  client: AiClient;
  toolExecutor: ToolExecutor;
  missionId: number;
  systemPrompt: string;
  initialMessages: AiMessageParam[];
  tools: AiTool[];
  options?: ToolCallOptions;
  hooks?: ConversationHooks;
  logger?: Pick<Logger, "debug">;
  pauseOnTools?: Set<string>;
  maxTurns?: number;
  /** NEW: Event bus for tool progress events. If omitted, no events are emitted. */
  events?: EventBus;
}
```

**Validation**:
- `events` is optional; if `undefined`, all `events.emit(...)` calls are skipped via optional chaining
- `missionId` is used as the channel key for event emission
- All other fields have existing validation (unchanged)

---

## Output Contract

### ConversationLoopResult

```typescript
interface ConversationLoopResult {
  text: string;
  finalMessage: AiMessage;
  toolCallsExecuted: number;
  pausedToolUse?: AiToolUseBlock;
}
```
(Unchanged from current implementation.)

---

## Event Emission Contract

When `events` is provided, `conversationLoop` emits two events per tool round:

### tool_start

Emitted **before** `hooks?.onBeforeToolExecution(...)` and before `toolExecutor.executeToolCalls(...)`.

```typescript
events.emit(missionId, {
  type: "tool_start",
  names: string[]  // Display names resolved via TOOL_DISPLAY_NAMES
});
```

### tool_end

Emitted **after** `hooks?.onAfterToolExecution(...)` and after `toolExecutor.executeToolCalls(...)`, regardless of success or failure.

```typescript
events.emit(missionId, {
  type: "tool_end",
  names: string[]  // Same display names as the corresponding tool_start
});
```

**Error safety**:
- If `EventBus.emit()` throws, the error is caught inside `emit()` and does not propagate
- If there are no subscribers, `emit()` is a silent no-op
- The loop does NOT catch errors from `emit()` — it relies on `EventBus`'s internal error handling

---

## Hook Call Order (post-refactor)

```
1. events?.emit(tool_start)
2. hooks?.onBeforeToolExecution(toolUseBlocks)
3. toolExecutor.executeToolCalls(missionId, toolUseBlocks)
4. hooks?.onAfterToolExecution(results)
5. events?.emit(tool_end)
```

Steps 1 and 5 are new; steps 2-4 are unchanged in order but their implementations no longer emit events.
