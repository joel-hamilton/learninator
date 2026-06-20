# Quickstart: Lesson QA Review

**Feature**: 027-lesson-qa-review
**Date**: 2026-06-20

## Prerequisites

- Dev environment running (`npm run dev`)
- A mission in "active" status with at least one completed lesson
- ANTHROPIC_API_KEY set (for real AI calls)

## Validation Scenarios

### 1. QA review corrects a factual error

**Setup**: Use a test mission. Complete the latest lesson to trigger next lesson generation.

**Action**: Observe the job progress messages (or SSE events). You should see:
1. Tool progress messages (Reviewing lesson…, Writing lesson…)
2. A "Reviewing lesson…" message
3. Job completes with status "done"

**Verify**: Open the generated lesson. Check the server logs for a `[lesson-qa]` info-level message indicating "corrected" (if the reviewer found and fixed something) or "passed" (if clean).

### 2. QA review falls back on failure

**Setup**: Set `ANTHROPIC_BASE_URL` to an invalid endpoint (or use `FakeAiClient` with a failing chat call) to simulate reviewer failure.

**Action**: Trigger lesson generation.

**Verify**: The lesson is delivered anyway (original content). Server log shows a `[lesson-qa]` warn-level message. The student sees the lesson regardless.

### 3. Review step in all generation paths

**Setup**: For each path below, trigger generation and verify the reviewer runs:

| Path | How to trigger |
|------|---------------|
| Next lesson | Complete current lesson → click "Next Lesson" |
| Sub-lesson | Click "Dive Deeper" on a lesson |
| Regenerate | Rate lesson "too easy" or "too hard" |
| Bridging | Rate lesson "too hard" → bridging option |

**Verify**: Each path shows "Reviewing lesson…" in progress messages before completion.

### 4. Run automated tests

```bash
npm test -- src/test/lessons.test.ts
```

Expected: All lesson generation tests pass, including new test cases for:
- Reviewer corrects content
- Reviewer passes through unchanged content
- Reviewer fails → original delivered
- Reviewer returns empty → original delivered

### 5. Performance check

**Action**: Generate 3 lessons and note the total generation time for each.

**Verify**: The average generation time increase from review is ≤ 30% (typically 2-5 seconds additional on a 15-30 second generation).
