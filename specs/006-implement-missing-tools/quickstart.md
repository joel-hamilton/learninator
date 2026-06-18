# Quickstart: Implement Missing AI Tools

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)

## Validation Scenarios

### Scenario 1: list_feedback_history with no lessons

```bash
# Run existing tests to confirm no regression
npm test

# The tools.test.ts will include new test:
# "list_feedback_history returns empty list messaging when no lessons"
# Expected: returns "No feedback yet."
```

### Scenario 2: list_feedback_history with feedback

- Creates a mission with two lessons
- Sets feedback on one lesson
- Calls `list_feedback_history`
- Expected: formatted feedback for the lesson with feedback, and listing for the one without

### Scenario 3: regenerate_lesson updates content

- Creates a lesson
- Calls `regenerate_lesson` with new title, slug, htmlContent
- Reads the lesson back
- Expected: updated content

### Scenario 4: regenerate_lesson on non-existent lesson

- Calls `regenerate_lesson` with a number that doesn't exist
- Expected: error message "Lesson 999 not found."

## Running Tests

```bash
# Run all tests
npm test

# Run just the tool tests
npx vitest run src/ai/tools.test.ts
```
