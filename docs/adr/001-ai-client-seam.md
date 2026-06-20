# ADR-0001: AiClient interface with FakeAiClient for tests

**Status:** Accepted
**Date:** 2026-06-15

## Context

The AI module was a singleton with no interface. Every route handler called
`ai.chatWithTools()` and `ai.continueWithToolResults()` directly against the
Anthropic SDK. There was one adapter (the real SDK), which meant the seam was
hypothetical — no ability to substitute for tests. Every test that touched AI
behavior required network calls or complex mocking of the SDK.

## Decision

Define an `AiClient` interface with three methods: `chat`, `chatWithTools`,
`continueWithToolResults`. The Anthropic implementation becomes an adapter behind
that interface. Tests inject a `FakeAiClient` that returns predetermined
responses from a queue.

**Two adapters justify the seam**: `AnthropicAiClient` (prod) and `FakeAiClient`
(tests).

## Consequences

- All AI-dependent code paths are testable without network calls
- Tests can script exact AI response sequences (tool_use → continue cycles)
- Error recovery paths (429, 500, timeout) become testable
- The `createApp()` factory accepts an optional `ai` parameter for test injection
- Adding a new AI provider means implementing one interface, not changing every call site
