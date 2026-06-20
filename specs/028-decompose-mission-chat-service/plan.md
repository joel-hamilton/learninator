# Implementation Plan: Decompose MissionChatService.run()

**Branch**: `028-decompose-mission-chat-service` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-decompose-mission-chat-service/spec.md`

## Summary

Extract the three internal pipeline stages of `MissionChatService.run()` — message preparation, conversation execution, and post-chat handling — into independently callable, testable modules. Also extract `buildSystemPrompt` (4-branch prompt construction) and `generateTitle` as separately testable functions. The external `run(input) -> MissionChatResult` seam remains unchanged; callers (route files) see no difference.

Approach: Within `src/services/mission-chat.service.ts`, refactor the monolithic `run()` method into three named internal functions (`prepareMessages`, `executeConversation`, `handlePostChat`) that accept their dependencies explicitly. Make `buildSystemPrompt` a standalone exported function with a `ContentStore` parameter. Keep `generateTitle` as a standalone exported function. Add dedicated unit tests in `src/test/` for each extracted unit.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), Drizzle ORM + better-sqlite3 (database), Anthropic SDK (AI client), htmx (frontend interactivity)

**Storage**: SQLite via better-sqlite3, accessed through Drizzle ORM and store interfaces (MissionStore, ChatStore, ContentStore)

**Testing**: Vitest with in-memory SQLite (createTestDb) and FakeAiClient (queue-based mock). HTTP-level tests use `app.request()`. No mocking library used — only real SQLite and fakes.

**Target Platform**: Linux server (Docker Compose deployment)

**Project Type**: Web application (server-rendered HTML via htmx)

**Performance Goals**: No new performance requirements. Refactoring should not introduce measurable latency overhead (the three extracted functions compose in-process with no additional I/O).

**Constraints**: 
- Existing route-level integration tests must continue to pass without modification
- The `run(input) -> MissionChatResult` external API must remain byte-identical in behavior
- No new npm dependencies permitted
- No changes to `conversationLoop()` in `ai/conversation.ts`

**Scale/Scope**: Single service module: `src/services/mission-chat.service.ts`. Approximately 235 lines, `run()` method is ~90 lines with 6 interleaved responsibilities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I - Factory-Based Testability**: PASS. The refactoring improves testability by exposing internal pipeline stages for independent testing. Each extracted module will accept its dependencies explicitly, satisfying the injectability requirement. The `createMissionChatService` factory pattern is preserved.

**Principle II - HTTP-Level Integration Testing**: PASS. Existing HTTP-level tests remain unchanged and continue to exercise the full `run()` path through `app.request()`. New unit tests for extracted modules are additive — they test finer-grained units using the same FakeAiClient pattern.

**Principle III - Hypermedia-Driven Frontend**: NOT APPLICABLE. This is a backend-only refactoring with no frontend impact.

**Principle IV - Explicit Dependency Injection**: PASS. The refactoring moves from implicit scope-captured dependencies (current `run()` closing over `deps`) to explicitly declared function parameters for each extracted module. This is a strict improvement in dependency visibility.

**Principle V - Migration Snapshot Integrity**: NOT APPLICABLE. No schema changes.

**Principle VI - No Speculative Features (YAGNI)**: PASS. The extraction is motivated by concrete testing needs documented in ADR-0006 and the spec. No new abstractions beyond those required by ADR-0006.

**No violations found.** Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/028-decompose-mission-chat-service/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 (minimal — no external unknowns)
├── quickstart.md        # Validation guide
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── services/
│   └── mission-chat.service.ts   # Refactored — run() delegates to internal modules
├── ai/
│   ├── conversation.ts           # Unchanged
│   ├── teacher.ts                # Unchanged
│   └── persistence.ts            # Unchanged (saveMessage, loadMessages)
└── test/
    ├── chat.test.ts              # Unchanged — existing integration tests
    ├── mission-chat-prepare.test.ts   # NEW: tests for prepareMessages + buildSystemPrompt
    ├── mission-chat-execute.test.ts   # NEW: tests for executeConversation
    ├── mission-chat-post.test.ts      # NEW: tests for handlePostChat
    └── mission-chat-title.test.ts     # NEW: tests for generateTitle
```

**Structure Decision**: Single-project web application. The refactoring stays within `src/services/mission-chat.service.ts`. New tests go in `src/test/` following the existing convention. No new source files created — only extracted functions within the existing module.

## Phase 0: Outline & Research

No external unknowns to research. The feature is a well-understood codebase refactoring:

- **Current architecture**: ADR-0006 documents the bundling of 6 responsibilities in `run()`
- **Dependencies**: All are existing project dependencies (AiClient, ToolExecutor, ChatStore, ContentStore, MissionStore, WorkflowStateManager, ToolEventBus, WorkflowEventBus, Logger)
- **Techniques**: Function extraction with explicit dependency parameters is a standard refactoring pattern. No new patterns needed
- **Test infrastructure**: FakeAiClient already supports tool-use responses, pause-on-tools, and system prompt inspection via `lastSystemPrompt`. No new test infrastructure needed

### Design Decisions

**Decision 1: Module boundaries — keep extracted functions in the same file vs. separate files**

- **Chosen approach**: Keep all extracted functions within `mission-chat.service.ts` as private module-scoped functions (not exported).
- **Rationale**: The three pipeline stages are tightly coupled to the service's types (`MissionChatInput`, `MissionChatResult`, `MissionChatDeps`). Extracting to separate files would require circular-import-safe type sharing or duplication. Keeping them in one file follows the existing pattern (the file is ~235 lines; after extraction it will be similar).
- **Alternatives considered**: Separate files per pipeline stage. Rejected because they would need to import the same types and there's no consumer outside this module.

**Decision 2: buildSystemPrompt export strategy**

- **Chosen approach**: Export `buildSystemPrompt` from the module (it already exists as a module-scoped function; we add `export`).
- **Rationale**: Tests need to call it directly with controlled inputs. Exporting it is the simplest way to make it testable without adding a wrapper or test-only entry point.
- **Alternatives considered**: Testing via the `prepareMessages` wrapper. Rejected because that would couple buildSystemPrompt tests to message-saving logic.

**Decision 3: Dependency passing for extracted functions**

- **Chosen approach**: Each extracted function accepts its specific subset of `MissionChatDeps` as explicit parameters, not the full `deps` object.
- **Rationale**: FR-007 requires explicit dependencies. Narrowing the parameter surface makes the function's actual needs visible at the call site and simplifies testing (only mock what the function uses).
- **Pattern**: 
  - `prepareMessages(input, chatStore, contentStore)` -> `{ systemPrompt, messages, didActivateRef }`
  - `executeConversation(systemPrompt, messages, tools, pauseOnTools, deps)` -> `{ text, pausedToolUse, didActivate }` where `deps` is a narrow object with `{ ai, toolExecutor, workflowState, events, logger, chatStore, missionId }`
  - `handlePostChat(result, deps)` -> `MissionChatResult` where `deps` is a narrow object with `{ chatStore, missionId, didActivate, ai, missionStore }`
  - `generateTitle(chatStore, missionStore, ai, missionId)` -> `Promise<string | null>`

**Decision 4: `run()` method signature**

- **Chosen approach**: `run(input)` composes the three stages in order. No behavioral change to callers.
- **Implementation sketch**: 
  ```typescript
  async function run(input: MissionChatInput): Promise<MissionChatResult> {
    // 1. Prepare
    const prep = await prepareMessages(input, chatStore, contentStore);
    // 2. Execute
    const execResult = await executeConversation(prep.systemPrompt, prep.messages, 
      input.tools ?? TEACHER_TOOLS, input.pauseOnTools, 
      { ai, toolExecutor, workflowState, events, logger, chatStore, missionId: input.missionId });
    // 3. Handle post-chat
    return handlePostChat(execResult, { chatStore, missionId: input.missionId, 
      didActivate: execResult.didActivate, ai, missionStore, logger });
  }
  ```

## Phase 1: Design & Contracts

### Data Model

No new entities or data model changes. The refactoring affects only function boundaries within `mission-chat.service.ts`. The existing types remain:

- `MissionChatInput` — unchanged input shape
- `MissionChatResult` — unchanged result shape  
- `MissionChatDeps` — unchanged (though extracted functions use subsets)

### Interface Contracts

No new external interfaces. The only public API remains `run(input)` and `generateTitle(missionId)`. `buildSystemPrompt` becomes an exported function for testing purposes.

### Extracted Function Contracts

**`prepareMessages(input, chatStore, contentStore)`**

| Input | Source |
|-------|--------|
| `input: MissionChatInput` | Caller |
| `chatStore: ChatStore` | Deps subset |
| `contentStore: ContentStore` | Deps subset |

| Output | Description |
|--------|-------------|
| `systemPrompt: string` | Built from `buildSystemPrompt(missionId, missionStatus, onboardingMode, lesson)` |
| `messages: ChatMessage[]` | Loaded via `loadMessages(chatStore, missionId)` after user message saved |
| `savedUserContent: string` | The actual content saved as user message (for logging/debugging) |

**`executeConversation(systemPrompt, messages, tools, pauseOnTools, deps)`**

| Input | Source |
|-------|--------|
| `systemPrompt: string` | From `prepareMessages` |
| `messages: ChatMessage[]` | From `prepareMessages` |
| `tools: AiTool[]` | From `input.tools ?? TEACHER_TOOLS` |
| `pauseOnTools: Set<string> | undefined` | From `input.pauseOnTools` |
| `deps: ExecuteDeps` | `{ ai, toolExecutor, workflowState, events, logger, chatStore, missionId }` |

| Output | Description |
|--------|-------------|
| `text: string` | Assistant reply text |
| `didActivate: boolean` | True if `mark_mission_active` was called |
| `pausedToolUse: AiToolUseBlock | undefined` | Set if loop paused on a tool |

**`handlePostChat(result, deps)`**

| Input | Source |
|-------|--------|
| `result: { text, didActivate, pausedToolUse }` | From `executeConversation` |
| `deps: PostDeps` | `{ chatStore, missionId, didActivate, ai, missionStore, logger }` |

| Output | Description |
|--------|-------------|
| `MissionChatResult` | `{ text, didActivate, pausedToolUse }` — text defaults to "Let us continue." if empty |

- If `didActivate` is true, calls `generateTitle(chatStore, missionStore, ai, missionId)` before returning.

### buildSystemPrompt branches

| Condition | Prompt content |
|-----------|----------------|
| `missionStatus === "onboarding"` + `onboardingMode === "guided"` | TEACHER_SYSTEM_PROMPT + "Guided Onboarding Mode" instructions |
| `missionStatus === "onboarding"` + `onboardingMode !== "guided"` | TEACHER_SYSTEM_PROMPT + "Chat Onboarding Mode" instructions |
| `lesson` provided (mission active) | TEACHER_SYSTEM_PROMPT + mission ID + lesson-specific instructions |
| Active (default) | TEACHER_SYSTEM_PROMPT + mission ID + mission content (if stored) |

### Validation & Testing Strategy

**Existing tests (unchanged)**: `chat.test.ts`, `missions.test.ts`, `onboarding.test.ts` — all continue to pass as-is. These are the HTTP-level integration tests that exercise the full `run()` path.

**New unit tests**:

1. **`mission-chat-prepare.test.ts`** (or integrated into existing chat test file):
   - `buildSystemPrompt` unit tests: call with various combinations of `missionStatus`, `onboardingMode`, `lesson`, and stored content. Assert string contents (substring matching for specific prompt sections).
   - `prepareMessages` integration-style tests: call with a real in-memory `ChatStore` and `ContentStore`. Assert user message saved to store, correct system prompt returned, messages loaded.

2. **`mission-chat-execute.test.ts`**:
   - Call `executeConversation` with FakeAiClient that returns text only. Assert `didActivate = false`, text returned, workflow state completed.
   - Call with FakeAiClient that returns `mark_mission_active` tool use. Assert `didActivate = true`, workflow state completed.
   - Call with FakeAiClient that throws. Assert workflow state failed.

3. **`mission-chat-post.test.ts`**:
   - Call `handlePostChat` with `didActivate = true`. Assert `generateTitle` is called (via mock store/ai).
   - Call with `didActivate = false`. Assert title generation NOT called.
   - Call with empty text. Assert default "Let us continue." in result.

4. **`mission-chat-title.test.ts`**:
   - Call `generateTitle` with seeded messages in chat store. Assert AI client receives model `"low"` and title is saved to mission store.
   - Call with empty chat store. Assert returns `null`.
   - Call with throwing AI client. Assert returns `null` (error swallowed).

**Test naming convention**: Follow `src/test/<domain>.test.ts` convention. For focused unit tests of extracted functions, consider a subdirectory `src/test/services/` or prefixing with `mission-chat-` to distinguish from the HTTP-level `chat.test.ts` and `missions.test.ts`.

## Complexity Tracking

No constitution violations found. Complexity Tracking table not required.

## Post-Design Constitution Re-Check

*Re-check after Phase 1 design.*

All principles continue to pass. No violations introduced. The design:
- Improves testability (Principle I) by enabling isolated unit tests
- Is fully compatible with HTTP-level integration tests (Principle II)
- Has no frontend impact (Principle III)
- Strengthens explicit dependency injection (Principle IV) by narrowing function parameter surfaces
- Involves no schema changes (Principle V)
- Adds no speculative abstractions (Principle VI)

**No violations. Proceed to task generation.**
