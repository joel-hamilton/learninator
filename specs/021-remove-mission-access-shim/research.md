# Research: Remove Mission Access Pass-Through

## Unknowns Resolved

### 1. Complete list of importing files

| File | Call Sites | Spec Listed? |
|------|-----------|-------------|
| `src/routes/missions.ts` | 7 | Yes |
| `src/routes/onboarding.ts` | 4 | Yes |
| `src/routes/lessons.ts` | 6 | Yes |
| `src/routes/mission-tabs.ts` | 4 | Yes |
| `src/routes/chat.ts` | 1 | No (omitted from spec) |
| `src/routes/lesson-generation.ts` | 4 | No (omitted from spec) |
| `src/shared/require-mission-access.test.ts` | 6 (test file, to be deleted) | N/A |
| **Total** | **26 call sites in 6 route files** | |

### 2. Calling pattern at every site

Every call site follows this identical pattern:
```ts
const mission = await requireMissionAccess(store, missionId, user.id);
if (!mission) return c.text("Not found", 404);
```

No site deviates from the post-call undefined check. Some sites add additional checks after the mission-access check (e.g., `mission.status !== "onboarding"`), but these are orthogonal to the access check.

### 3. Indirect re-exports

No barrel file (`src/shared/index.ts` does not exist). No other module (ai/, services/, lessons/, browse/) imports `requireMissionAccess`. The only imports are direct imports from the 6 route files.

### 4. Test coverage impact

- **Deleted test**: `src/shared/require-mission-access.test.ts` (67 lines, 6 unit tests) -- covers the NaN guard and delegation behavior in isolation.
- **Existing coverage**: All 26 call sites are already exercised by integration tests (`src/test/lessons.test.ts`, `src/test/missions.test.ts`, `src/test/chat.test.ts`, `src/test/onboarding.test.ts`) via `app.request()`. The NaN guard is tested end-to-end by integration tests that send non-numeric mission IDs.
- **Net effect**: Removing the unit test is safe because the guard logic is trivial (2-line boolean expression) and is exercised by integration tests at every call site.

### 5. Store access pattern

The `store` is obtained in each route handler via:
```ts
const store = c.get("store");
```
where `store` is typed as `DrizzleMissionStore` (which implements `MissionStore`). The `store.getMission(missionId, userId)` method returns `Promise<MissionRow | undefined>`.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Inline NaN guard placement | Before `store.getMission()` call | Same order as current: guard fails fast without DB query |
| ID variable naming | Match existing convention at each site | Some sites use `id` (after `parseInt`), some use `missionId`; preserve local names |
| Import removal | Remove the `requireMissionAccess` import line | No other shared module exports are used in the same import statement (each import is standalone) |
| Test file deletion | Remove the `require-mission-access.test.ts` file | No other test imports from it; behavior fully covered by integration tests |

## Alternatives Considered

- **Keep the module but rename it**: No benefit -- the problem is the existence of a pass-through, not its name.
- **Move the guard into `store.getMission`**: Would couple validation to the store layer; the guard is a route-level concern (HTTP input validation), not a data-access concern.
- **Add the NaN guard to the route param parsing**: Some routes already `parseInt()` and could include the NaN check at parse time, but this would require touching the param-parsing line, which is more invasive than adding a guard line.
