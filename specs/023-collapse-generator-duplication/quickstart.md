# Quickstart: Collapse Generator Duplication

## Validation Scenarios

These scenarios verify the refactoring preserves behavioral equivalence.

### Prerequisites

- Node.js 22, npm installed
- Project dependencies installed (`npm install`)
- Working directory is repo root (`/Users/joel/Sites/learninator`)

### Scenario 1: Existing tests pass

```bash
npm test
```

**Expected**: All tests pass with 0 failures. No test files were modified.

**If failing**: Check that the refactored method signatures and return types match the originals. The four public methods must accept the same parameters and return strings (job keys).

### Scenario 2: Behavioral equivalence check (manual inspection)

1. Open `src/lessons/generator.ts` in the original (git stash) and refactored versions.
2. For each of the four generation types, verify:
   - `buildJobKey` is called with the same type prefix
   - `TEACHER_SYSTEM_PROMPT` base is included (for `generateNext` and `generateSubLesson`)
   - Dedicated prompt builders are used (for `generateRegenerate` and `generateBridging`)
   - The correct store method is called in `findResult` (`getLatestLesson` vs `getLesson`)

### Scenario 3: Line count reduction

```bash
# Count lines in the four method regions (original)
git show HEAD:src/lessons/generator.ts | grep -n "generateNext\|generateSubLesson\|generateRegenerate\|generateBridging\|private runGeneration" 

# Count lines in the refactored version
grep -n "generateNext\|generateSubLesson\|generateRegenerate\|generateBridging\|private runGeneration\|const.*Config.*=" src/lessons/generator.ts
```

**Expected**: The refactored code has at least 100 fewer lines in the combined method/config area compared to the original.

### Scenario 4: New generation kind is one config object (conceptual)

To add a fifth generation kind (e.g., "prerequisite"), a developer should only need to write:

```typescript
private generatePrerequisite(
  missionId: number,
  lesson: LessonInfo,
  mission: MissionInfo,
): string {
  return this.runGeneration({
    jobKeyType: "prerequisite",
    buildSystemPrompt: (mid, m, l) => `...`,
    buildUserMessage: (l, opts) => `...`,
    findResult: (mid, l) => this.deps.store.getLatestLesson(mid),
  });
}
```

This should NOT require copying any structural lifecycle code.
