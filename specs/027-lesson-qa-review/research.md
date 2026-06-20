# Research: Lesson QA Review

**Feature**: 027-lesson-qa-review
**Date**: 2026-06-20

## Decision 1: How the reviewer interacts with the AI

**Decision**: Use `ai.chat()` — a single-turn text-in/text-out call with no tools.

**Rationale**: The reviewer's job is to examine existing HTML and return corrected HTML. It doesn't need database access or tool execution — it's a pure editing pass. `ai.chat()` is simpler, faster, and avoids the overhead of tool-use infrastructure. The conservative mandate (FR-002) means the reviewer shouldn't be rewriting major sections, so a simple edit pass is sufficient.

**Alternatives considered**:
- `chatWithTools()` with limited tools: Overkill — the reviewer shouldn't create new lessons or modify the database. Adding tool access risks the reviewer making structural changes outside its mandate.
- Multi-turn review loop: Unnecessary complexity. A single review pass with clear instructions handles the conservative mandate.

## Decision 2: Where to hook the review into the generation lifecycle

**Decision**: In `startGeneration()`, after `runConversation()` completes but before the job status is set to "done". The review runs after `findResult()` locates the newly created lesson, then reads its content, sends it for review, and updates the lesson if corrections were made.

**Rationale**: This is the only point where the full lesson content exists in the database and the job is still in "running" state. The review step's progress message ("Reviewing lesson…") appears alongside the existing tool progress messages. If the review fails, the original content is already saved and the job simply completes with the original result.

**Alternatives considered**:
- Pre-save hook (review before `create_lesson` tool executes): Impossible — the generating AI calls `create_lesson` as a tool during the conversation loop. There's no interception point.
- Post-delivery async review: Violates the spec's requirement that review happens before the student sees the lesson.

## Decision 3: Review model tier

**Decision**: Use the `"high"` model tier for the review pass.

**Rationale**: Accuracy matters more than cost for QA review. The reviewer must correctly distinguish between an error and a stylistic choice. The `"high"` tier (Sonnet) has better judgment for this task than `"low"` (Haiku). The cost is one additional high-tier API call per lesson generation.

**Alternatives considered**:
- Same tier as generation: The generation already uses "high" implicitly (via `conversationLoop`). The review step adds a second high-tier call — acceptable for quality.
- Low tier for review: Would be faster/cheaper but the spec requires catching errors the generation missed — a less capable model adds risk of poor corrections.

## Decision 4: Failure handling strategy

**Decision**: Wrap the review step in try/catch. On any failure (API error, timeout, empty response), log the failure and deliver the original (unreviewed) content. Never block delivery.

**Rationale**: Per FR-006, the fallback path is essential. The worst outcome is the student waiting indefinitely for a broken review step. The original content is already saved to the database before review starts, so the fallback is zero-cost.

**Alternatives considered**:
- Retry on failure: Adds latency without guarantee of success. A single failure likely indicates a transient API issue — retrying prolongs the user's wait for no benefit.
- Queue for later review: Adds complexity (new job type, new storage) for marginal benefit. The conservative mandate means most reviews are pass-through; catching errors later doesn't help the current student.

## Decision 5: Progress indication during review

**Decision**: Push a "Reviewing lesson…" message to the job's messages array before starting the review. This message is visible to the frontend via the existing job polling mechanism.

**Rationale**: FR-005 requires continued progress visibility. The job polling endpoint (`getJobStatus`) returns `job.messages.at(-1)` for the "running" state. Adding a message before the review call ensures the frontend updates. No new UI elements needed.

**Alternatives considered**:
- Separate progress event type: Would require new SSE event wiring. The existing message array is sufficient for a single additional step.
- No progress update: Violates FR-005 and the project's CLAUDE.md requirement for immediate visible feedback during AI calls.
