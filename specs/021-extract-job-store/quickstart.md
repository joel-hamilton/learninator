# Quickstart: Extract JobStore Interface

**Date**: 2026-06-19

## Prerequisites

- Node.js 22, `npm install` completed
- All existing tests pass: `npm test`

## Validation Scenarios

### Scenario 1: InMemoryJobStore works independently

```bash
# Start the Node.js REPL or create a test file
node -e "
const { InMemoryJobStore } = require('./src/lessons/job-store');
const store = new InMemoryJobStore();

// getJob on empty store returns undefined
console.assert(store.getJob('nonexistent') === undefined, 'missing key returns undefined');

// setJob then getJob
store.setJob('key-1', { status: 'running', messages: ['Working...'], result: null, error: null });
console.assert(store.getJob('key-1') !== undefined, 'stored job is retrievable');
console.assert(store.getJob('key-1')!.status === 'running', 'status matches');

// deleteJob removes the job
store.deleteJob('key-1');
console.assert(store.getJob('key-1') === undefined, 'deleted job is gone');

// deleteJob is idempotent
store.deleteJob('key-1'); // should not throw

console.log('All InMemoryJobStore assertions passed');
"
```

### Scenario 2: Existing tests pass

```bash
npm test
```

Expected: All existing tests pass without modification. The `LessonGenerator` behavior is identical to before the extraction.

### Scenario 3: Lesson generator with explicit JobStore

Create a minimal test:

```typescript
// Verify LessonGenerator accepts a custom JobStore via deps
import { createLessonGenerator, InMemoryJobStore } from './src/lessons/index';
import { createFakeAiClient } from './src/ai/fake';

const fakeAi = createFakeAiClient(/* queue responses */);
const store = new InMemoryJobStore();
const generator = createLessonGenerator({
  ai: fakeAi,
  jobStore: store,  // explicit injection
  // ... other deps
});

const key = generator.generateNext(/* ... */);
const status = generator.getJobStatus(key);
console.assert(status.status === 'running');
```

## Expected Outcome

| Check | Expectation |
|-------|-------------|
| `InMemoryJobStore` instantiable standalone | Yes |
| All existing tests pass | Yes (zero modifications) |
| `LessonGenerator` no longer owns `Map` | Yes (uses `JobStore` via deps) |
| `InternalJob` type is exported | Yes |
| `buildJobKey()` and `JobStatus` unchanged | Yes |
