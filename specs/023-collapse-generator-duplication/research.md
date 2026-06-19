# Research: Collapse Generator Duplication

**Phase**: 0 — Design Research and Confirmation

## Design Decision

The refactoring will extract a `runGeneration(config: GenerationConfig)` template method within `LessonGenerator`. Each of the four existing public methods will become a thin delegation to the template with its own config object.

## Decision: GenerationConfig shape

**Decision**: A single `GenerationConfig` interface with `buildJobKey` (reusing the existing module-level helper), `buildSystemPrompt`, `buildUserMessage`, and `findResult` callbacks.

**Rationale**: These four dimensions are what vary across the four methods. Everything else (job dedup check, `runGenerationJob` call, error handling, cleanup timer) is identical. The callbacks produce strings/compatible result types, so no generic complexity is needed.

**Alternatives considered**:
- Abstract subclass: unnecessary inheritance, harder to read, Java-esque overhead
- Function overloads: would not eliminate duplication since the shared lifecycle would still be duplicated
- Higher-order function with 4 args: simpler but would lose named-callback clarity

## Decision: Result-finding strategy

**Decision**: Keep the differing strategies:
- `generateNext`, `generateSubLesson`, `generateBridging`: look for the latest lesson that differs from the current one (`getLatestLesson`)
- `generateRegenerate`: look for the same lesson after regeneration (`getLesson`)

**Rationale**: These are genuinely different operations (one looks for a NEW lesson, the other looks for the UPDATED same lesson). Forcing them into a single approach would require an awkward branching inside the callback. The config pattern cleanly accommodates this.

## Decision: Optional direction parameter

**Decision**: `buildSystemPrompt` and `buildUserMessage` in `GenerationConfig` should accept an optional `direction` parameter (for `generateRegenerate`'s harder/easier toggle). Other configs will ignore it.

**Rationale**: Better than adding a separate `direction` field on the config or making callbacks variadic. TypeScript's optional parameter handles this cleanly.

## Hidden Dependency Check

- `buildJobKey` at module level (line 51-58) is already used by all four methods. It remains unchanged and is called from the template.
- `getRegenerateSystemPrompt` and `getBridgingSystemPrompt` are imported from `../ai/index.js`. These are called via `buildSystemPrompt` in the respective configs, so the import stays.
- `TEACHER_SYSTEM_PROMPT` is imported and concatenated by `generateNext` and `generateSubLesson` in their `buildSystemPrompt` callbacks. `generateRegenerate` and `generateBridging` use the dedicated prompt builders. All imports remain unchanged.
- No tests directly mock `LessonGenerator` internals. Tests use `FakeAiClient` at the AI layer, so internal restructuring is invisible to them.

**Result**: No hidden dependencies. The refactoring is self-contained within `generator.ts`.

## Test Coverage Verification

Relevant test areas:
- `src/test/lessons.test.ts` — exercises lesson generation flow (likely tests `generateNext` and `generateRegenerate`)
- `src/test/chat.test.ts` — tests chat including activation that triggers generation

Both test layers use `FakeAiClient` with queued responses. The refactoring does not touch the AI client, store layer, or any route handlers, so tests should pass without changes.
