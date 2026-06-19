# Research: Collapse Duplicate Lesson Formatting

## R1: Verify all call sites

Grep sweep across the three affected files:

**`src/views/lesson.ts`**
- Line 27: `formatLessonNumber(lessonNumber, lessonSubNumber)`
- Line 28: `lessonIdStr(lessonNumber, lessonSubNumber)`
- Line 233: `lessonIdStr(prevLesson.number, ...)` (in nav link)
- Line 236: `lessonIdStr(nextLesson.number, ...)` (in nav link)

**`src/views/fragments.ts`**
- `lessonIdStr` called 18+ times across various fragment functions
- `formatLessonNumber` called ~5 times alongside `lessonIdStr` in display contexts

**`src/lessons/generator.ts`**
- Line 83, 145, 208, 255: `this.formatLessonNumber(...)` calls
- No `lessonIdStr` usage

**R2: Identity check**

All three `formatLessonNumber` implementations are byte-for-byte identical in logic:
```ts
const base = String(num).padStart(4, "0");
return sub !== null ? `${base}.${sub}` : base;
```

Both `lessonIdStr` implementations are byte-for-byte identical:
```ts
return subNumber !== null ? `${number}.${subNumber}` : `${number}`;
```

**R3: generator.ts does not use lessonIdStr** -- confirmed.

**R4: generator.ts formatLessonNumber is a private method** -- confirmed. Called via `this.formatLessonNumber(...)`.

## Decisions

| Decision | Rationale |
|----------|-----------|
| Hoist to `src/shared/lesson-numbers.ts` | Fits existing pattern (`slug.ts`, `errors.ts`, `messages.ts`) |
| Export both functions as named exports | Consistent with other shared modules |
| Keep `formatLessonNumber` as a standalone function (not a class method) | Existing callers treat it as a pure function -- no state needed |
| Generator: change `this.formatLessonNumber()` to bare `formatLessonNumber()` | The method has no dependency on `this` |

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Export from one existing file and import from the other two | Creates cross-view dependency -- `lesson.ts` importing from `fragments.ts` or vice versa is semantically wrong |
| Keep private methods but extract via mixin/trait | Over-engineered for two pure functions totaling ~8 lines each |
| Inline the logic at each call site | Defeats the purpose (maintenance duplication) |
