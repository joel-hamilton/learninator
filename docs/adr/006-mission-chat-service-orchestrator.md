# ADR-0006: MissionChatService as single conversation orchestrator

**Status:** Accepted
**Date:** 2026-06-16

## Context

Originally, three route files (missions, chat, lessons) each contained copy-pasted
conversation-loop orchestration: save user message → build system prompt → load
prior messages → run conversation loop → detect activation → generate title →
redirect. The same activation bootstrap (didActivate → generateTitle →
HX-Redirect) was duplicated across 5 call sites.

The route layer imported `conversationLoop`, `TEACHER_SYSTEM_PROMPT`,
`TEACHER_TOOLS`, `saveMessage`, and `loadMessages` directly — the route layer's
interface included AI mechanics it shouldn't need to know about.

## Decision

`createMissionChatService()` is the single entry point for all AI chat in
missions. Its `run()` method accepts a `MissionChatInput` with intent parameters
(message, onboarding mode, lesson context, pauseOnTools) and returns a
`MissionChatResult`.

The service owns:
- System prompt construction (4 branches: onboarding guided, onboarding chat,
  lesson-specific, default active)
- Message persistence
- Conversation loop execution with tool hooks
- Workflow state lifecycle (start → step → complete)
- Activation detection and title generation

Routes call `missionChatService.run(input)` and handle HTTP concerns (redirects,
response rendering). They no longer import AI internals directly.

The conversation hook knot was untied on 2026-06-19: event emission
(tool_start/tool_end) moved into `conversationLoop` itself. Callers provide
domain-specific hooks (message persistence) via `createStandardHooks()`; the
framework owns event emission.

## Consequences

- Locality: conversation mechanics live in one module
- Activation bootstrap collapsed from 5 duplicated blocks to one helper
- Adding a chat mode means adding a branch to `buildSystemPrompt`, not copying
  the loop
- The `run()` method bundles 6 responsibilities — a future internal
  decomposition (prepareMessages, executeConversation, handlePostChat) would
  improve testability
