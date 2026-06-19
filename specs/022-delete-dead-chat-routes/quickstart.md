# Quickstart: Delete Dead ChatRoutes Module

## Prerequisites

- Working development environment (Node.js 22, npm dependencies installed)
- Clean git working tree (no uncommitted changes to unrelated files)

## Validation Steps

### 1. Pre-deletion confirmation

```bash
# Confirm the file is not imported anywhere
grep -rn "chatRoutes" src/ --include='*.ts'
# Expected output: only self-referencing definition in src/routes/chat.ts

grep -rn "from.*routes/chat" src/ --include='*.ts'
# Expected output: nothing (no imports)
```

### 2. Delete the file

```bash
rm src/routes/chat.ts
```

### 3. Verify TypeScript compilation

```bash
npx tsc --noEmit
# Expected: exit code 0, no errors
```

### 4. Run test suite

```bash
npm test
# Expected: all tests pass (exit code 0)
```

### 5. Confirm no remaining references

```bash
grep -rn "chatRoutes" src/ --include='*.ts'
# Expected: no output (identifier fully removed from codebase)
```

## Expected Outcomes

- All existing tests pass without modification
- Clean TypeScript compilation
- The real chat handler at `src/routes/missions.ts:311` continues to work
- `chatRoutes` identifier no longer exists anywhere in the codebase
