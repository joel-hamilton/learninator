# Contract: LessonGenerator Conversation Hooks

**Location**: `src/lessons/generator.ts`  
**Method**: `LessonGenerator.runConversation()` (private)

---

## Purpose

Provides domain-specific hooks for the lesson generation conversation loop. After refactoring, these hooks only manage `job.messages` updates (tool labels visible in the job progress UI). Event emission is handled by `conversationLoop`.

---

## Hook Implementation (post-refactor)

### onBeforeToolExecution

```typescript
onBeforeToolExecution: async (toolUseBlocks) => {
  for (const block of toolUseBlocks) {
    const label = this.toolLabel(
      block.name,
      block.input as Record<string, unknown> | undefined,
    );
    job.messages.push(label);
  }
}
```

**REMOVED**: `pendingToolNames` tracking  
**REMOVED**: `events?.emit(missionId, { type: "tool_start", names: pendingToolNames })`

### onAfterToolExecution

```typescript
onAfterToolExecution: async (_results) => {
  // No-op — events emitted by conversationLoop
}
```

**REMOVED**: `events?.emit(missionId, { type: "tool_end", names: pendingToolNames })`

### onTruncated

```typescript
onTruncated: async () => {
  job.messages.push("Response was cut short…");
}
```

(Unchanged.)

---

## conversationLoop Invocation (post-refactor)

```typescript
await conversationLoop({
  client: ai,
  toolExecutor,
  missionId,
  systemPrompt,
  initialMessages,
  tools: TEACHER_TOOLS,
  events,              // NEW: EventBus instance from GeneratorDeps
  hooks: {
    onBeforeToolExecution: async (toolUseBlocks) => { /* job.messages.push only */ },
    onAfterToolExecution: async (_results) => { /* no-op */ },
    onTruncated: async () => { /* unchanged */ },
  },
});
```
