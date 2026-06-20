# Research: Wired Feedback

**Phase 0 output** | **Feature**: specs/026-wired-feedback

## Decision 1: Inline textarea UX pattern

**Decision**: Clicking a rating button replaces the feedback row with an inline `<textarea>` + submit button, preserving the rating button group with the selected rating highlighted. The textarea label changes based on which rating is selected. Pressing Enter or clicking submit fires an htmx POST to the existing `/feedback` endpoint.

**Rationale**: This keeps the interaction within the existing bar (no modal, no popover). htmx handles the swap natively — the server returns the new `feedbackThanksBar` HTML fragment with confirmation + adjustment buttons. The textarea label context-switch ("What made it too hard?" vs "What made it just right?") is handled client-side via a small inline script that updates the label when a different rating is clicked.

**Alternatives considered**:
- Modal with textarea: Rejected — adds friction, hides action buttons, breaks the two-zone layout we just built
- Always-visible textarea: Rejected — clutters the bar when most students won't type feedback
- Separate `/feedback-text` endpoint: Rejected — adds complexity; existing `/feedback` endpoint already handles `feedbackText`

## Decision 2: Feedback summary injection point

**Decision**: A new pure function `buildFeedbackSummary(store, missionId)` returns a formatted string of past feedback. This string is called inside every `buildSystemPrompt` and injected as a section at the end of the system prompt. For `buildUserMessage`, the most recent feedback text (if any) is also injected directly into the user message.

**Rationale**: The `buildSystemPrompt` and `buildUserMessage` closures in `GenerationConfig` are the single place where AI prompts are assembled for each generation type. Injecting there covers all 4 generation paths (next, sub, regenerate, bridge) without touching routes or the `conversationLoop`.

**Alternatives considered**:
- Inject in route handlers before calling generator: Rejected — would need to be repeated in 4 routes; generator owns prompt assembly
- Inject via a new AI tool: Rejected — this is the current broken pattern (AI must remember to call it)
- Inject only in system prompt: Partial — user message injection is also valuable for immediate feedback text

## Decision 3: Carrying feedback text to adjustment buttons

**Decision**: When a student types feedback text and clicks "Make Easier" / "Make Harder" / "Bridge First", the feedback text is included as a hidden field in the htmx POST. The route handler reads it and passes it to the generator as `opts.feedback`. The generator's `buildUserMessage` already supports `opts.feedback` for `generateNext` — the same pattern is added to `generateRegenerate` and `generateBridging`.

**Rationale**: The `generate-next` route already does this pattern (reads `feedback` from body, passes to generator). Extending it to regenerate/bridging routes is symmetric and minimal.

**Alternatives considered**:
- Read feedback from DB in the route: Rejected — the just-typed text may not be saved yet (race condition); passing it directly avoids the DB read
- Always read latest feedback from DB in generator: Rejected — adds latency and the text is already available in the request

## Decision 4: Feedback summary format

**Decision**: The summary includes (a) a table of recent lessons with ratings and text, (b) a trend line. Format:

```
## Student Feedback History

| Lesson | Rating | Notes |
|--------|--------|-------|
| 0001: "Intro to Recursion" | too_hard | "Too much math notation" |
| 0002: "Base Cases" | just_right | — |
| 0003: "Tree Recursion" | too_hard | "Diagrams didn't help" |

Trend: 2 of last 3 rated too_hard. Use simpler language, more scaffolding, smaller steps. Include concrete worked examples. Minimize mathematical notation.
```

Limited to last 5 lessons to constrain prompt length.

**Rationale**: Markdown table format is well-understood by LLMs. The trend line gives the AI explicit calibration instructions derived from the pattern. Limiting to 5 lessons prevents prompt bloat.

**Alternatives considered**:
- JSON format: Rejected — LLMs handle markdown tables better in system prompts
- Raw dump of all feedback: Rejected — too verbose; trend summary is more actionable
- Inject only trend, no table: Rejected — specific feedback text is valuable for addressing concrete complaints
