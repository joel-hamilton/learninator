# Quickstart: Route Generator Through Store Seam

**Feature**: 014-generator-through-store-seam | **Plan**: [plan.md](./plan.md)

## Validation Scenarios

### 1. Verify no Drizzle imports in generator

```bash
grep -E "drizzle-orm|from.*\.\./db/schema" src/lessons/generator.ts
# Expected: no matches (empty output)
```

### 2. Verify GeneratorDeps uses store, not db

```bash
grep "store.*MissionStore" src/lessons/generator.ts
# Expected: `store: MissionStore;` in GeneratorDeps interface
```

### 3. Verify index.ts wiring uses store + events

```bash
grep -A5 "createLessonGenerator" src/index.ts
# Expected: { ai, toolExecutor, store, events: eventBus, logger }
```

### 4. Run existing test suite (zero regressions)

```bash
npm test
# Expected: all passing, zero modifications to existing test files
```

### 5. TypeScript compilation

```bash
npx tsc --noEmit
# Expected: no errors
```

### 6. Construct generator with InMemoryMissionStore (unit-test isolation)

```bash
node -e "
import { InMemoryMissionStore } from './src/db/store.js';
import { LessonGenerator } from './src/lessons/generator.js';
import { FakeAiClient } from './src/ai/fake.js';
import { createEventBus } from './src/ai/events.js';

const store = new InMemoryMissionStore();
const gen = new LessonGenerator({
  ai: new FakeAiClient([]),
  toolExecutor: { execute: async () => [] },
  store,
  events: createEventBus(),
  logger: { info() {}, error() {}, warn() {}, debug() {} },
});
console.log('Generator constructed with InMemoryMissionStore:', gen instanceof LessonGenerator);
"
# Expected: Generator constructed with InMemoryMissionStore: true
```

### 7. End-to-end: generation flow via HTTP

```bash
# Run the dev server, then:
# 1. Create a mission, complete onboarding
# 2. Click "Continue Learning" → verify polling bar appears, lesson loads
# 3. Click "Dive Deeper" → verify sub-lesson generates
# 4. Click "Too Easy" / "Too Hard" → verify regenerated lesson renders
# 5. Click "Bridging Lesson" → verify bridging sub-lesson appears
```

## Prerequisites

- Node.js 22+
- `npm install` (dependencies installed)
- Database migrated: `npm run db:migrate`
- Environment variables set (see `CLAUDE.md`)
