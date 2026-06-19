# Implementation Plan: Remove Mission Access Pass-Through

**Branch**: `021-remove-mission-access-shim` | **Date**: 2026-06-19 | **Spec**: `specs/021-remove-mission-access-shim/spec.md`

**Input**: Feature specification from `specs/021-remove-mission-access-shim/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Delete the 16-line `src/shared/require-mission-access.ts` pass-through module and inline its NaN guard + `store.getMission(missionId, user.id)` call at each of 26 call sites across 6 route files. The module adds no meaningful abstraction -- its entire interface is `(store, missionId, userId) => { if (NaN guard) return undefined; return store.getMission(...); }` -- and every caller already checks for undefined and returns 404. Also delete the module's 67-line test file. Net reduction: approximately 75 lines.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), better-sqlite3 + Drizzle ORM (database)

**Storage**: SQLite via Drizzle ORM; `MissionStore.getMission(missionId, userId)` queries the `missions` table scoped to the owning user

**Testing**: Vitest; in-memory SQLite with `app.request()` for integration tests; no module-level mocking of store or DB

**Target Platform**: Linux server (Docker), macOS (dev)

**Project Type**: Web application (Hono + htmx)

**Performance Goals**: N/A -- pure refactoring, no performance impact

**Constraints**: No behavioral changes; every call site must preserve the identical NaN guard logic; all existing tests must pass without modification

**Scale/Scope**: 6 route files, 26 call sites, 2 files deleted (module + test), net ~75 lines removed

**NEEDS CLARIFICATION (resolved in research.md)**: The spec lists 4 route files but the codebase has 6 callers -- `chat.ts` and `lesson-generation.ts` also import the module. All 6 use the identical pattern.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Rationale |
|-----------|--------|-----------|
| I. Factory-Based Testability | PASS | No change to factory pattern or dependency injection |
| II. HTTP-Level Integration Testing | PASS | Existing integration tests continue unchanged; eliminate module-level unit test |
| III. Hypermedia-Driven Frontend | PASS | No frontend changes |
| IV. Explicit Dependency Injection | PASS | `store` still comes from `c.get("store")` at each handler |
| V. Migration Snapshot Integrity | PASS | No schema changes |
| No speculative features (YAGNI) | PASS | Removing an abstraction that was itself a speculative wrapper |

Gates pass. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/021-remove-mission-access-shim/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── missions.ts          # 7 call sites → inline
│   ├── onboarding.ts        # 4 call sites → inline
│   ├── lessons.ts           # 6 call sites → inline
│   ├── mission-tabs.ts      # 4 call sites → inline
│   ├── chat.ts              # 1 call site → inline
│   └── lesson-generation.ts # 4 call sites → inline
└── shared/
    └── require-mission-access.ts   # DELETED
    └── require-mission-access.test.ts  # DELETED
```

**Structure Decision**: Single project (unchanged). No new directories or files created.

## Complexity Tracking

No constitution violations to justify -- this is a simplification/removal feature.

---

## Phase 0: Research

### Unknowns Identified

1. **Which files import `requireMissionAccess`?** Spec says 4 route files; actual codebase has 6.
2. **What is the exact calling pattern at each site?** Need to verify all 26 use the identical `if (!mission) return c.text("Not found", 404)` pattern.
3. **Is there any indirect usage via re-exports?** Need to check if the function is re-exported from an index/barrel file.
4. **What is the test coverage impact?** The module test must be deleted. Integration tests cover the behavior already.

### Research Tasks

1. Grep all imports of `requireMissionAccess` across the entire project (excluding node_modules and .git).
2. Read each call site to verify the post-call handling pattern.
3. Check barrel files (e.g., `src/shared/index.ts` if it exists) for re-exports.
4. Count total call sites and classify by route file.

### Research Results

See `research.md` for full consolidated findings.

## Phase 1: Design

### Artifacts

- `data-model.md`: No new entities. The `MissionRow` type and `MissionStore.getMission()` signature are already defined in `src/db/store.ts` and remain unchanged.
- `contracts/`: No new interfaces. The only "contract" is the inlined NaN guard pattern, documented inline.
- `quickstart.md`: Validation guide for verifying the refactoring.

### Inline Pattern (canonical form)

Every call site follows this exact transformation:

**Before:**
```ts
const store = c.get("store");
const mission = await requireMissionAccess(store, missionId, user.id);
if (!mission) return c.text("Not found", 404);
```

**After:**
```ts
const store = c.get("store");
if (Number.isNaN(missionId) || missionId < 1) return c.text("Not found", 404);
const mission = await store.getMission(missionId, user.id);
if (!mission) return c.text("Not found", 404);
```

### Deleted Files

1. `src/shared/require-mission-access.ts` (16 lines)
2. `src/shared/require-mission-access.test.ts` (67 lines)

### Files Modified (import removal + inline guard insertion)

1. `src/routes/missions.ts` -- remove import, inline 7 sites
2. `src/routes/onboarding.ts` -- remove import, inline 4 sites
3. `src/routes/lessons.ts` -- remove import, inline 6 sites
4. `src/routes/mission-tabs.ts` -- remove import, inline 4 sites
5. `src/routes/chat.ts` -- remove import, inline 1 site
6. `src/routes/lesson-generation.ts` -- remove import, inline 4 sites

### Agent Context Update

Update the `CLAUDE.md` `<!-- SPECKIT START -->` section to reference this plan.

---

## Phase 2: Tasks

Delegated to `/speckit-tasks` command. The task list will follow this dependency order:

1. Inline guard + store.getMission in each route file, one file at a time
2. Delete `require-mission-access.ts` and its test file
3. Run `npm test` to verify no behavioral changes
4. Clean up any remaining references
