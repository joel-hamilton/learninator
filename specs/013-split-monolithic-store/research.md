# Research: Split Monolithic MissionStore

## Decision 1: Single-file vs. Multi-file Store Layout

**Decision**: Keep all interfaces and the composite Drizzle implementation in `src/db/store.ts`. Do not extract to `src/db/stores/*.ts`.

**Rationale**: FR-015 and FR-016 in the spec present both options. Single-file is chosen because:
- The composite class (`DrizzleMissionStore`) shares a single `BetterSQLite3Database` instance. Splitting across files would require either a barrel re-export or passing the db instance to each sub-store constructor — adding indirection without benefit at this scale.
- All focused interfaces total ~41 methods across 7 domains. Even with implementations, the file stays manageable (~400 lines of interfaces, ~200 lines of implementations).
- Zero production callers need individual store instantiation; they always get the composite.
- Tests benefit from focused `InMemory*` classes regardless of file layout.

**Alternatives considered**: Extracting each interface + adapter to separate files under `src/db/stores/` would improve discoverability for very large teams but adds import path churn and potential circular dependency issues for cross-domain operations like `deleteMission`.

## Decision 2: Interface Naming Strategy

**Decision**: Retain `MissionStore` as the focused mission-only interface (8 methods). The composite class name stays `DrizzleMissionStore`.

**Rationale**: 
- The spec says "to minimize diff size, the MissionStore interface is retained for mission-only methods."
- Files that currently import `MissionStore` and use only mission methods continue to compile without changes.
- Renaming to something like `Store` or `LearninatorStore` creates unnecessary diff noise.

**Alternatives considered**: Renaming to `DrizzleStore` was suggested (FR-003) but rejected because the existing name is well-known and the class still primarily represents the mission-tutoring domain.

## Decision 3: Guided Questions Belong on ChatStore

**Decision**: Group `createGuidedQuestion`, `getPendingQuestion`, `answerQuestion`, `skipPendingQuestions` under `ChatStore`.

**Rationale**: FR-019 mandates this. Guided questions are part of the onboarding/chat flow and share the same mission context. They're always accessed alongside chat messages (e.g., in `routes/missions.ts` the onboarding handler checks both `getChatMessages` and `getPendingQuestion`).

**Alternatives considered**: A separate `GuidedQuestionStore` would be premature — the spec acknowledges this is a pragmatic choice and guided questions can be extracted later if they gain an independent lifecycle.

## Decision 4: Remove Compatibility Aliases Aggressively

**Decision**: Delete all 9 compatibility aliases from both `DrizzleMissionStore` and `InMemoryMissionStore`.

**Rationale**: Research confirmed ALL 9 aliases are called ONLY from `src/db/store.test.ts`. No production code uses them. Migrating the test file to canonical method names is a mechanical change.

**Caller migration map**:
| Alias call in test | Replacement |
|---|---|
| `store.readMissionContent(id, type)` | `(await store.getMissionContent(id, type))?.markdownContent ?? null` or inline |
| `store.upsertMissionContentPos(id, type, md)` | `store.upsertMissionContent({ missionId: id, contentType: type, markdownContent: md })` |
| `store.getMainLessonByNumber(id, num)` | `store.getLesson(id, num, null)` |
| `store.getMaxSubNumber(parentId)` | Add `getMaxSubNumber` as canonical method on `LessonStore`, or inline in test |
| `store.insertLesson(data)` | `store.createLesson(data)` |
| `store.insertReferenceDoc(data)` | `store.createReferenceDoc(data)` |
| `store.insertLearningRecord(data)` | `store.createLearningRecord(data)` |
| `store.insertGuidedQuestion(data)` | `store.createGuidedQuestion(data)` |
| `store.updateLearningRecordPos(id, num, data)` | Lookup + `store.updateLearningRecord(record.id, data)` |

Note: `getMaxSubNumber` is also used in `src/lessons/generator.ts` (via raw Drizzle, not store). The canonical version will be added to `LessonStore`.

## Decision 5: `deleteMission` Cascading Deletes

**Decision**: Keep `deleteMission` on the focused `MissionStore` interface. The implementation continues to cascade-delete across all related tables directly (as it does today).

**Rationale**: The spec's assumption section states "This cross-domain behavior must be retained, likely on MissionStore." The cascading delete is a mission lifecycle operation — when a mission is deleted, all its related data goes with it. Placing it on `MissionStore` keeps the semantics clear.

## Decision 6: `getLearningRecordCount` Moves to `LearningRecordStore`

**Decision**: Move `getLearningRecordCount(missionId)` from the old monolithic interface to `LearningRecordStore`.

**Rationale**: FR-018 requires this. It queries the `learning_records` table, not the `lessons` table. The AI tool `createLearningRecord` in `tools.ts` already imports/uses both lesson and learning record methods — it will import both interfaces.

## Decision 7: `AppVariables.store` Type

**Decision**: `AppVariables.store` changes from `MissionStore` to `DrizzleMissionStore` (the concrete composite class).

**Rationale**: FR-007 requires type that satisfies all focused interfaces. `DrizzleMissionStore` implements every focused interface via `implements` clauses, so `c.get("store")` returns a value assignable to any focused interface. This is the minimal change that preserves backward compatibility.

**Alternatives considered**: An intersection type (`MissionStore & LessonStore & ChatStore & ...`) would work but is harder to maintain (add a new interface → update the intersection in types.ts). A union type would be incorrect (narrows, doesn't widen).

## Decision 8: Test File Strategy

**Decision**: Split `src/db/store.test.ts` into per-interface test files under `src/db/__tests__/`. Keep existing integration tests in `src/test/` using the composite `DrizzleMissionStore`.

**Rationale**: FR-013 requires per-interface test files. The `InMemory*` implementations enable focused unit tests. Integration tests at `src/test/*.test.ts` continue to use the composite via `createApp()` — their test logic doesn't change.
