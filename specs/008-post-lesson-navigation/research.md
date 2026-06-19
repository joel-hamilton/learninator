# Research: Post-Lesson Navigation

**Feature**: 008-post-lesson-navigation
**Date**: 2026-06-18

## Decision 1: LessonGenerator Injection Strategy

**Decision**: Inject `LessonGenerator` via context middleware (same pattern as `store`, `ai`, `toolExecutor`).

**Rationale**:
- The `LessonGenerator` class in `src/lessons/generator.ts` already exists with all four generation methods and its own job tracking Map.
- The route handlers currently duplicate this logic inline with their own `generationJobs` Map and `GenerationJob` type.
- Injecting via middleware follows Constitution Principle IV (Explicit Dependency Injection) — route handlers access it via `c.get("lessonGenerator")`.
- Constructor injection (`createApp({ lessonGenerator })`) is also viable for test overrides, but the middleware pattern is simpler for the production path since `LessonGenerator` has no external dependencies beyond what's already in context (`ai`, `toolExecutor`, `db`, `logger`).

**Alternatives considered**:
- Keep inline job tracking in route handlers: Rejected — duplicates the `LessonGenerator` logic that already exists, violates DRY, makes testing harder.
- Pass `LessonGenerator` via `createApp()` options only: Rejected — adds complexity to the factory signature when middleware achieves the same goal.
- Make `LessonGenerator` methods static: Rejected — loses the per-instance job Map, complicates testing.

## Decision 2: Polling Endpoint Structure

**Decision**: Keep separate polling endpoints per generation type (`/generate-next/status`, `/generate-sub-lesson/status`, `/regenerate/status`, `/generate-bridging/status`) but share a single unified `getJobStatus()` method on `LessonGenerator` keyed by job type.

**Rationale**:
- The UI components (`generationPollingBar`, `regenerationPollingBar`, `bridgingPollingBar`) already expect separate status endpoints.
- `LessonGenerator.buildJobKey()` already includes `type` in the key, making keys unique across generation types.
- A unified `/generation-status?key=xxx` endpoint would require changing all polling bar components — more churn for no benefit.

**Alternatives considered**:
- Single unified status endpoint: Rejected — requires changing all existing polling UI components, increases htmx attribute complexity.
- SSE-based push instead of polling: Rejected — adds complexity (SSE connection management) for a UX that works fine with 1s polling.

## Decision 3: "Explore Something New" Integration

**Decision**: Link to the existing browse flow (`/missions/:id/browse`) rather than building a new topic exploration UI.

**Rationale**:
- `src/browse/explorer.ts` already implements `TopicExplorer` with AI-driven topic narrowing.
- `src/routes/browse.ts` already has the browse UI routes.
- The spec's "Explore Something New" action is exactly what the browse flow does: let the user explore and narrow down a new topic.
- A simple link (or hx-get loading the browse view) is sufficient — no new backend logic needed.

**Alternatives considered**:
- Inline topic picker in a modal: Rejected — duplicates the browse flow logic, adds complexity.
- AI-suggested topics based on mission: Rejected — the browse flow already has AI-driven exploration.

## Decision 4: Feedback-to-Adjustment UI State Transitions

**Decision**: Three distinct UI states with clear transitions:

1. **Active bar** (lesson in progress): Shows only the 3 difficulty rating buttons + a prominent "Mark Complete" button. No generation actions visible yet.
2. **Feedback response** (after rating): Shows rating confirmation + adjustment buttons (if too_easy/too_hard) + "Mark Complete". Replaces the active bar.
3. **Completed bar** (after marking complete): Shows "What's next?" heading + Continue Learning / Dive Deeper / Explore Something New + Mark Incomplete. Replaces everything above.

**Rationale**:
- Current UI shows all 6 buttons at once (`lessonActionBar`) — overwhelming and mixes feedback with navigation.
- Separating feedback (during lesson) from navigation (after completion) matches the user's mental model: first decide if the lesson was good, then decide what to do next.
- The "Mark Complete" transition is the key state change — it moves from "consuming this lesson" to "choosing the next step."

**Alternatives considered**:
- Keep feedback and navigation in one bar but style them differently: Rejected — still cognitively overwhelming; doesn't address the root complaint about unpredictability.
- Modal for post-completion choices: Rejected — adds an unnecessary click; the lesson page already has plenty of space below the content.

## Decision 5: Generation Job Deduplication

**Decision**: Use `LessonGenerator`'s existing `jobs.has(key)` check. The route handler returns an "already generating" message if a job exists for the same key. No additional client-side prevention needed.

**Rationale**:
- `LessonGenerator.generateNext()` and friends already check `if (this.jobs.has(key)) return key;` before creating a new job.
- htmx's `hx-swap="outerHTML"` replaces the button bar with a polling bar on first click, making the button disappear — double-clicks are naturally prevented.
- Server-side dedup is the safety net for edge cases (rapid clicks before the swap completes, multiple tabs).

**Alternatives considered**:
- Client-side button disable on click: Redundant with htmx's outerHTML swap but could be added as a progressive enhancement. Not needed for correctness.
- Database-level job tracking: Rejected — jobs are ephemeral (60s expiry), no need to persist them.

## Decision 6: "Continue Learning" System Prompt Change

**Decision**: Change the system prompt for the "Continue Learning" action to ALWAYS instruct `create_lesson` (main lesson), removing the AI's discretion to choose between `create_lesson` and `create_sub_lesson`.

**Rationale**:
- The current prompt says "Decide whether the next step is a new topic (use create_lesson) or a same-topic follow-up / deeper dive (use create_sub_lesson)" — this is the root cause of unpredictable behavior.
- If the user wants a sub-lesson, they'll click "Dive Deeper" which explicitly uses `create_sub_lesson`.
- The AI still reviews existing lessons and feedback history to calibrate content, but the lesson type is no longer its decision.

**Alternatives considered**:
- Let the AI decide but show what it will create before executing: Rejected — adds latency (two-step confirmation) and still offloads a UX decision to the AI.
- Merge Continue Learning and Dive Deeper into one button + AI decides: Rejected — this is the current behavior that the user explicitly wants to fix.
