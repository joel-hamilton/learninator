# Quickstart: Deduplicate Guided-Question JavaScript

## Prerequisites

- Node.js 22, npm dependencies installed (`npm install`)
- Test suite baseline confirmed passing

## Validation Scenarios

### Scenario 1: No duplicate function definitions

1. Open `src/views/shared.ts`
2. Search for `function selectOption`, `function onOptionChange`, `function onOtherInput`, `function validateAnswer`, `function submitGuidedAnswer`
3. Each function name MUST appear exactly once in the file
4. The inline `<script>` tag in the HTML template MUST interpolate `GUIDED_QUESTION_SCRIPT` for the guided-question function bodies instead of defining them inline

### Scenario 2: Existing tests pass

```bash
npm test
```

Expected: All 290+ tests pass (0 failures).

### Scenario 3: Behavioral equivalence

1. Start the dev server: `npm run dev`
2. Create a new mission and navigate to the onboarding page
3. Interact with the guided-question form (select an option, submit)
4. Verify all UI behaviors work identically to before the refactor

## Run Commands

```bash
# Run test suite
npm test

# Start dev server for manual testing
npm run dev
```

## Contracts

See [contracts/](./contracts/) for interface documentation (if applicable).

## Data Model

See [data-model.md](./data-model.md) for entity documentation.
