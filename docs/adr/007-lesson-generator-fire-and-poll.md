# ADR-0007: LessonGenerator as fire-and-poll background job manager

**Status:** Accepted
**Date:** 2026-06-16

## Context

Lesson generation runs an AI conversation loop that may take 30–120 seconds.
Doing this synchronously in a request handler would time out. Two route handlers
in `lessons.ts` each contained nearly identical async IIFE blocks: capture AI
and toolExecutor from context, run conversationLoop, track job in a global Map,
expose polling endpoints.

The four generation kinds (next, sub-lesson, regenerate, bridging) each had the
same 5-step structure: build key → deduplicate → system prompt → user message →
result callback. Only the prompts and result-finding logic varied.

## Decision

`createLessonGenerator()` produces a module with a public interface of:

- `generateNext(missionId, lesson, feedback?)` — start next-lesson generation
- `generateSubLesson(missionId, lesson)` — start sub-lesson generation
- `generateRegenerate(missionId, lesson, direction)` — regenerate an existing lesson
- `generateBridging(missionId, lesson)` — generate a bridging lesson
- `getJobStatus(key)` — poll for completion (returns `JobStatus`)

Internally, the four public methods delegate to a single `runGeneration(config)`
template method. The config object provides `buildSystemPrompt`,
`buildUserMessage`, and `findResult` callbacks.

Jobs are tracked in an internal `JobStore` (in-memory `Map` by default,
injectable for tests). The client polls via `GET
/missions/:missionId/lessons/generation/status?key=...`.

The QA review pass (second AI pass that reviews generated lessons for errors)
uses a separate `runReview()` method with `REVIEWER_SYSTEM_PROMPT` — same
fire-and-poll pattern, different AI call.

## Consequences

- 4 route handlers collapsed into 2 thin adapters that delegate to the generator
- ~120 lines of structural duplication eliminated by the template method
- Adding a 5th generation kind means one config object, not a new 50-line method
- Job storage is in-memory (lost on restart) — acceptable for generation jobs
  that complete within ~2 minutes
- The template method abstraction (lambda factories for prompts and result
  finding) creates indirection — the flow is harder to follow than 4 explicit
  methods would be
- QA review pass adds a second AI call per generated lesson, doubling cost and
  latency. Accepted as a correctness trade-off
