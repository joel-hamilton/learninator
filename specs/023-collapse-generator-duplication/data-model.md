# Data Model: GenerationConfig

**Phase**: 1 — Design and Contracts

## Entity: GenerationConfig

A configuration object that captures the variable parts of a lesson generation job. Each concrete config implements the callbacks to produce generation-type-specific behavior while the template method handles the shared lifecycle.

### Fields

| Field | Type | Purpose |
|-------|------|---------|
| `jobKeyType` | `"next" \| "sub" \| "regenerate" \| "bridge"` | The generation type prefix used by `buildJobKey` |
| `buildSystemPrompt` | `(missionId: number, mission: MissionInfo, lesson: LessonInfo, direction?: "harder" \| "easier") => string` | Constructs the system prompt for the AI conversation |
| `buildUserMessage` | `(lesson: LessonInfo, opts?: GenerationOpts, direction?: "harder" \| "easier") => string` | Constructs the user message that kicks off generation |
| `findResult` | `(missionId: number, lesson: LessonInfo) => Promise<LessonResult \| null>` | After AI conversation completes, finds the resulting lesson in the store |

### Supporting Types

```
MissionInfo = { title: string; status: string }
LessonInfo = { number: number; subNumber: number | null; title: string }
GenerationOpts = { feedback?: string; notes?: string }
LessonResult = { lessonNumber: number; lessonSubNumber: number | null; lessonTitle: string }
```

### Existing Helpers (unchanged)

- `buildJobKey(missionId, number, subNumber, type)` — exists at module level, reused by template method
- `getRegenerateSystemPrompt(...)` — imported from `../ai/index.js`, called from `generateRegenerate`'s config
- `getBridgingSystemPrompt(...)` — imported from `../ai/index.js`, called from `generateBridging`'s config
- `TEACHER_SYSTEM_PROMPT` — imported and concatenated in `generateNext` and `generateSubLesson`'s configs

## State Transitions

No state transitions. The `GenerationConfig` objects are stateless data — they only provide callbacks. All job lifecycle state (running, done, error, result) remains in `InternalJob` within `LessonGenerator`, unchanged by this refactoring.
