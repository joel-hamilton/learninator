# Feature Specification: Decompose MissionChatService.run()

**Feature Branch**: `028-decompose-mission-chat-service`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description of architectural improvement to decompose MissionChatService.run() into three internal modules (prepareMessages, executeConversation, handlePostChat) with independent test surfaces.

## User Scenarios & Testing

### User Story 1 - Developer verifies message preparation in isolation (Priority: P1)

As a developer, I want to test message preparation (saving the user message, building the system prompt, loading prior messages) as an independent unit, so that I can verify each step of the pipeline separately without running the full conversation loop.

**Why this priority**: Message preparation is the first pipeline stage and has the most branches (4 system prompt variants). Isolating it catches formatting errors and prompt logic bugs early.

**Independent Test**: Can be tested by calling the extracted `prepareMessages()` function with known inputs and asserting the returned system prompt string and messages array, without any AI client or conversation loop.

**Acceptance Scenarios**:

1. **Given** a user message for an onboarding mission in guided mode, **When** `prepareMessages` is called, **Then** the saved user message includes the guided onboarding mode instructions in the system prompt.
2. **Given** a user message with a lesson context object, **When** `prepareMessages` is called, **Then** the saved message is prefixed with `[Re: Lesson N: Title]` and the system prompt includes lesson-specific instructions.
3. **Given** a mission in active status with stored mission content, **When** `prepareMessages` is called, **Then** the system prompt includes the stored mission goals.
4. **Given** a mission in active status without stored mission content, **When** `prepareMessages` is called, **Then** the system prompt omits the mission goals section.
5. **Given** a user message with additional context but no lesson, **When** `prepareMessages` is called, **Then** the user message includes the context prefix.

---

### User Story 2 - Developer verifies conversation execution independently (Priority: P1)

As a developer, I want to test the conversation execution (running the conversation loop with hooks and detecting activation) in isolation, so that I can verify activation detection and workflow state lifecycle without the message preparation or post-chat logic.

**Why this priority**: Conversation execution is the core orchestration logic. Activation detection (`didActivate`) has implications for the entire post-chat flow and is a common source of bugs.

**Independent Test**: Can be tested by calling the extracted `executeConversation()` function with a pre-built system prompt and messages array (supplied by test, not from prepareMessages), and asserting the returned text and didActivate flag.

**Acceptance Scenarios**:

1. **Given** a conversation loop input that does not trigger `mark_mission_active`, **When** `executeConversation` completes, **Then** `didActivate` is false and the result contains assistant text.
2. **Given** a conversation loop input that triggers `mark_mission_active`, **When** `executeConversation` completes, **Then** `didActivate` is true.
3. **Given** any conversation execution, **When** it completes successfully, **Then** the workflow state is marked as completed.
4. **Given** a conversation that throws an AIError, **When** `executeConversation` catches it, **Then** the workflow state is marked as failed with the error message.
5. **Given** a conversation loop with `pauseOnTools` containing a relevant tool, **When** execution pauses, **Then** the result includes the paused tool use block.

---

### User Story 3 - Developer verifies post-chat handling in isolation (Priority: P2)

As a developer, I want to test the post-chat handling (saving the assistant message, mapping the result, triggering title generation) as an independent unit, so that I can verify result mapping and conditional title generation without the preceding pipeline stages.

**Why this priority**: Post-chat handling is the last pipeline stage. While less critical than the first two, it consolidates the result mapping contract that routes depend on.

**Independent Test**: Can be tested by calling the extracted `handlePostChat()` function with a mock conversation result and asserting the returned `MissionChatResult` structure.

**Acceptance Scenarios**:

1. **Given** a conversation that completed with `didActivate = true`, **When** `handlePostChat` is called, **Then** a title generation is triggered via the AI client.
2. **Given** a conversation that completed with `didActivate = false`, **When** `handlePostChat` is called, **Then** no title generation is triggered.
3. **Given** a conversation that returned an empty text result, **When** `handlePostChat` maps the result, **Then** the final text defaults to "Let us continue."

---

### User Story 4 - Developer verifies buildSystemPrompt branches (Priority: P2)

As a developer, I want to test `buildSystemPrompt` as a near-pure function (with a content store dependency) so that I can verify each of the 4 branches produces the correct prompt text without running the AI or conversation loop.

**Why this priority**: The 4-branch system prompt logic combines string concatenation and conditional content loading. Testing it separately prevents prompt errors from being discovered only during AI calls.

**Independent Test**: Can be tested by calling `buildSystemPrompt` with various combinations of `missionStatus`, `onboardingMode`, and `lesson` parameters and asserting the returned string contains expected substrings.

**Acceptance Scenarios**:

1. **Given** `missionStatus === "onboarding"` and `onboardingMode === "guided"`, **When** `buildSystemPrompt` is called, **Then** the returned prompt contains "Guided Onboarding Mode" and "ask_guided_question".
2. **Given** `missionStatus === "onboarding"` and `onboardingMode === "chat"`, **When** `buildSystemPrompt` is called, **Then** the returned prompt contains "Chat Onboarding Mode".
3. **Given** a `lesson` object with number and title, **When** `buildSystemPrompt` is called, **Then** the returned prompt includes the lesson number and title and lesson-specific instructions.
4. **Given** an active mission with stored content in the database, **When** `buildSystemPrompt` is called, **Then** the returned prompt includes "Current mission goals:" followed by the stored content.
5. **Given** an active mission without stored content, **When** `buildSystemPrompt` is called, **Then** the returned prompt does not contain "Current mission goals:".

---

### User Story 5 - Developer verifies generateTitle separately (Priority: P3)

As a developer, I want to test `generateTitle` as an independent function so that I can verify the title generation logic, message-loading edge cases, and error handling without running a full conversation.

**Why this priority**: Title generation uses the AI client with a low model and has error handling that swallows exceptions. Testing it prevents silent regressions.

**Independent Test**: Can be tested by calling `generateTitle` with a seeded chat store containing known messages and asserting the returned title is non-null and calls the AI client appropriately.

**Acceptance Scenarios**:

1. **Given** a chat store with multiple messages, **When** `generateTitle` is called, **Then** the AI client receives a request with model `"low"` and the returned title is saved to the mission store.
2. **Given** a chat store with no messages, **When** `generateTitle` is called, **Then** it returns `null` without calling the AI client.
3. **Given** an AI client that throws an error, **When** `generateTitle` is called, **Then** it returns `null` without propagating the error.

---

### Edge Cases

- What happens when `onboardingMode` is not set for an onboarding mission? Should default to `"guided"`.
- What happens when the AI returns an empty title string? The function should return `null` and not update the mission title.
- What happens when the conversation loop pauses on a tool in executeConversation? The pausedToolUse should propagate through handlePostChat unchanged.
- What happens when message is empty (just context/lesson navigation)? No user message should be saved to the store.
- What happens when `buildSystemPrompt` is called with both `missionStatus === "onboarding"` and a `lesson` object? Following current logic, `onboarding` status takes precedence.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST extract message preparation logic from `run()` into a separate callable module or function (`prepareMessages`) whose responsibilities are: saving the user message (with context/lesson prefixing), building the system prompt (delegating to `buildSystemPrompt`), and loading prior messages.
- **FR-002**: The system MUST extract conversation execution logic from `run()` into a separate callable module or function (`executeConversation`) whose responsibilities are: running the conversation loop with hooks, detecting activation via `mark_mission_active`, and managing workflow state lifecycle (start, step update, complete/fail).
- **FR-003**: The system MUST extract post-chat handling logic from `run()` into a separate callable module or function (`handlePostChat`) whose responsibilities are: mapping the conversation result to `MissionChatResult`, and triggering title generation if `didActivate` is true.
- **FR-004**: The `buildSystemPrompt` function MUST remain as a separate callable function with the same 4-branch logic (onboarding guided, onboarding chat, lesson-specific, default active with optional content loading).
- **FR-005**: The `generateTitle` function MUST remain as a separate callable function, testable without invoking `run()`.
- **FR-006**: The external API (`run(input): MissionChatResult`) MUST remain unchanged. All existing callers in route files (missions, chat, lessons, onboarding) MUST continue to work without modification.
- **FR-007**: Each of the three extracted internal modules MUST accept their dependencies explicitly (not by closing over the outer `createMissionChatService` scope), so they can be unit-tested in isolation with mock dependencies.
- **FR-008**: The `MissionChatDeps` interface MUST be adjusted if any of the extracted modules require a subset of the current dependencies, ensuring each module only receives the dependencies it needs.

### Key Entities

- **`prepareMessages`**: Internal module/function that takes a `MissionChatInput` and returns a prepared context (system prompt string + messages array + parsed input). Accepts `ChatStore`, `ContentStore` as dependencies.
- **`executeConversation`**: Internal module/function that takes a system prompt, messages array, tools config, and runtime dependencies, runs the conversation loop, and returns a conversation result with `didActivate` flag. Accepts `AiClient`, `ToolExecutor`, `WorkflowStateManager`, event bus, logger as dependencies.
- **`handlePostChat`**: Internal module/function that takes a conversation result, mission context, and AI client, and returns the final `MissionChatResult`. May trigger `generateTitle` conditionally.
- **`buildSystemPrompt`**: Standalone callable function with 4 branches, optionally accepting a `ContentStore` for loading stored mission content.
- **`generateTitle`**: Standalone callable function accepting a `ChatStore` and `MissionStore` and `AiClient`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Each of the three internal pipeline stages (`prepareMessages`, `executeConversation`, `handlePostChat`) can be invoked and tested in isolation with mock dependencies, without setting up the full AI client or conversation loop.
- **SC-002**: The `buildSystemPrompt` function can be tested in all 4 branches without setting up a conversation loop or AI client, using only a test content store (or in-memory variant).
- **SC-003**: The `generateTitle` function can be tested with seeded message data without invoking `run()` or the conversation loop.
- **SC-004**: All existing route-level chat tests continue to pass without modification, confirming the `run(input) -> MissionChatResult` seam remains stable.
- **SC-005**: New unit tests covering the extracted modules exist in `src/test/` and are part of the normal `npm test` run.
- **SC-006**: A developer adding a new chat mode can write a test for the `buildSystemPrompt` branch without touching any conversation loop or message persistence logic.

## Assumptions

- The caller (`run()`) will coordinate the three pipeline stages in order: prepareMessages -> executeConversation -> handlePostChat.
- The existing `FakeAiClient` infrastructure is sufficient for testing the extracted modules. No new test infrastructure is required.
- Route files import only `run()` and `generateTitle()` from the service -- internal modules do not need to be exported from the service module unless explicitly tested.
- The `WorkflowStateManager` is already testable via its own interface and does not need modification.
- The `conversationLoop` function from `ai/conversation.ts` remains unchanged; only its invocation is extracted into `executeConversation`.
