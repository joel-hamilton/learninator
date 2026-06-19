# Research: Delete Dead ChatRoutes Module

## Summary

No NEEDS CLARIFICATION items existed in the spec. The single research task was to compare the dead file's logic against the real handler to confirm no unique logic would be lost.

## Comparison Results

See the Phase 0 table in `plan.md` for detailed comparison. Key findings:

- The dead file (`src/routes/chat.ts`) is a stale copy from an earlier refactor
- It was never mounted via `app.route()` — no routes were ever registered from it
- It lacks `handleActivation()` and `onboardingMode` support present in the real handler
- It contains unused imports (`conversationLoop`, `createStandardHooks`, `TEACHER_SYSTEM_PROMPT`, `TEACHER_TOOLS`)
- No unique logic exists that needs to be preserved

## Verification

- `grep -rn "chatRoutes\|from.*chat" src/ --include='*.ts'` confirmed the only reference is the definition in the dead file itself
- No other file imports `./chat` or `chatRoutes` anywhere in the source tree
