# Research: Typing the InMemory Store Adapters

## Overview

This document captures the analysis performed to determine the correct approach for replacing all `any[]` collections and `any` parameter types in the 8 InMemory store classes in `src/db/store.ts`.

## Row Type to InMemory Store Mapping

| Store Class | Collection(s) | Row Type | Method Parameters to Type |
|---|---|---|---|
| `InMemoryMissionStore` | `missions` | `MissionRow` | `createMission(v)` param, `listMissions(opts)` param |
| `InMemoryLessonStore` | `lessons` | `LessonRow` | `createLesson(v)` param, `listLessons` return, etc. |
| `InMemoryChatStore` | `chatMessages` | `ChatMessageRow` | `saveChatMessage(v)` param |
| `InMemoryChatStore` | `guidedQuestions` | `GuidedQuestionRow` | `createGuidedQuestion(v)` param |
| `InMemoryContentStore` | `missionContents` | `MissionContentRow` | `upsertMissionContent(v)` param |
| `InMemoryRefDocStore` | `referenceDocs` | `ReferenceDocRow` | `createReferenceDoc(v)` param |
| `InMemoryLearningRecordStore` | `learningRecords` | `LearningRecordRow` | `createLearningRecord(v)` param, `updateLearningRecord(id, values)` param |
| `InMemoryUserStore` | `users` | `UserRow` | `createUser(v)` param, `updateUser(id, values)` param |
| `InMemorySessionStore` | `sessions` | `SessionRow` | Already typed `v` param! Only collection needs retyping |

## Spread-Construction Typing Strategy

The InMemory create methods use a common pattern:

```ts
async createMission(v: any) {
  const m = { id: this.id(), ...v, status: v.status ?? "onboarding", ... };
  this.missions.push(m);
  return m;
}
```

When typing `v`, the parameter type should match the corresponding method's interface signature (from the store interface), not the Drizzle `New*` insert type, because the interface signature is what consumers use.

For the construction expression, there are two viable approaches:

### Approach A: Object Spread with Explicit Defaults (Recommended)

Type `v` as the interface parameter shape. After the spread with defaults expressed after the spread, TypeScript will correctly recognize that the result structurally matches the row type if all required fields are present. This may require a type assertion on the return value when the spread produces a type that isn't automatically recognized as the row type.

### Approach B: Assemble Row Object Explicitly

Construct the row piece by piece without spreading `v`, using only individual field assignments. This is more verbose but avoids type inference issues with spreads.

**Decision**: Use Approach A with minimal type assertions where needed. This preserves the existing code structure and avoids unnecessary refactoring.

## Edge Cases

1. **Optional fields in row types**: Fields like `feedbackRating`, `feedbackText`, `completedAt` on `LessonRow` are optional (`| null`). The InMemory stores already handle these by not setting them or explicitly setting `null`. With typed arrays, assigning `null` to an optional field is valid.

2. **Enum fields**: Several schemas use string enums:
   - `MissionRow.status`: `"onboarding" | "active" | "archived"`
   - `LessonRow.status`: `"active" | "in_progress" | "completed"`
   - `LessonRow.feedbackRating`: `"too_easy" | "just_right" | "too_hard" | null`
   - `GuidedQuestionRow.status`: `"pending" | "answered"`
   - `LearningRecordRow.status`: `"active" | "superseded"`
   
   The InMemory stores set default values (e.g., `v.status ?? "onboarding"`) which are valid enum values. No changes needed to the default values themselves.

3. **InMemorySessionStore already partially typed**: The `createSession(v)` parameter already accepts `{ userId: number; token: string; csrfToken: string; expiresAt: string }` rather than `any`. Only the `sessions: any[]` collection needs retyping.

## Dependencies

None. No new packages or type definitions are required — the row types are already exported from `src/db/store.ts`.

## Risks

- **Low risk**: The change is entirely additive (adding type annotations). Runtime behavior is unchanged. Tests verify this.
- **Type assertion brittleness**: If `as MissionRow` assertions are used on constructed objects and the schema changes, the assertion could mask a type mismatch. This is acceptable since the DrizzleMissionStore's actual runtime behavior is the source of truth.
