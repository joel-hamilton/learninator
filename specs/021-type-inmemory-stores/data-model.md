# Data Model: Typed InMemory Store Collections

## Overview

This document maps each InMemory store class to its corresponding Drizzle-inferred row type and documents the typed method signature changes. No schema changes are involved — the row types are already defined in `src/db/store.ts` as `$inferSelect` on the Drizzle table definitions in `src/db/schema.ts`.

## Row Types (already exported from `src/db/store.ts`)

| Row Type | Source Table | Key Enum Fields |
|---|---|---|
| `MissionRow` | `missions` | `status`: `"onboarding" \| "active" \| "archived"`; `onboardingMode`: `"guided" \| "chat"` |
| `LessonRow` | `lessons` | `status`: `"active" \| "in_progress" \| "completed"`; `feedbackRating`: `"too_easy" \| "just_right" \| "too_hard"` \| `null` |
| `ChatMessageRow` | `chatMessages` | `role`: `"user" \| "assistant"` |
| `GuidedQuestionRow` | `guidedQuestions` | `status`: `"pending" \| "answered"` |
| `ReferenceDocRow` | `referenceDocs` | `docType`: `"cheatsheet" \| "algorithm" \| "routine" \| "sequence" \| "other"` |
| `LearningRecordRow` | `learningRecords` | `status`: `"active" \| "superseded"` |
| `MissionContentRow` | `missionContent` | `contentType`: `"mission" \| "notes" \| "resources" \| "glossary"` |
| `UserRow` | `users` | No enum fields |
| `SessionRow` | `sessions` | No enum fields |

## InMemory Store Type Mappings

### 1. InMemoryMissionStore

- **Collection**: `missions: MissionRow[]` (was `any[]`)
- **`createMission`**:
  - Parameter `v`: type from `MissionStore.createMission` signature — `{ userId: number; title: string; slug: string; status?: string; onboardingMode?: string }`
  - Constructed object with defaults: `{ id: this.id(), ...v, status: v.status ?? "onboarding", onboardingMode: v.onboardingMode ?? "guided", createdAt: ..., updatedAt: ... }`
  - Return: `MissionRow`
- **`updateMissionStatus`**: Parameter `status` already typed as `any` in the InMemory but the interface uses `"onboarding" | "active" | "archived"`. Change to match interface.
- **Other methods**: Already have proper signatures matching the interface; no parameter typing changes needed beyond replacing `any[]` collections.

### 2. InMemoryLessonStore

- **Collection**: `lessons: LessonRow[]` (was `any[]`)
- **`createLesson`**:
  - Parameter `v`: type from `LessonStore.createLesson` signature — `{ missionId: number; number: number; title: string; slug: string; htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number }`
  - Constructed object with defaults: `{ id: this.id(), ...v, status: v.status ?? "active", subNumber: v.subNumber ?? null, parentLessonId: v.parentLessonId ?? null, feedbackRating: null, feedbackText: null, completedAt: null, createdAt: ... }`
  - Return: `LessonRow`
- **`listLessons` sort callback**: The `a: any, b: any` parameters in the sort lambda should be typed as `LessonRow`.
- **`updateLessonStatus`**: The method uses a subtype of `LessonRow` for the update target; no change needed to parameter types since they match the interface.

### 3. InMemoryChatStore

- **Collection** `chatMessages`: `ChatMessageRow[]` (was `any[]`)
- **Collection** `guidedQuestions`: `GuidedQuestionRow[]` (was `any[]`)
- **`saveChatMessage(v)`**: Type from `ChatStore.saveChatMessage` — `{ missionId: number; role: "user" | "assistant"; content: string }`
- **`createGuidedQuestion(v)`**: Type from `ChatStore.createGuidedQuestion` — `{ missionId: number; question: string; options: string }`

### 4. InMemoryContentStore

- **Collection**: `missionContents: MissionContentRow[]` (was `any[]`)
- **`upsertMissionContent(v)`**: Type from `ContentStore.upsertMissionContent` — `{ missionId: number; contentType: string; markdownContent: string }`

### 5. InMemoryRefDocStore

- **Collection**: `referenceDocs: ReferenceDocRow[]` (was `any[]`)
- **`createReferenceDoc(v)`**: Type from `RefDocStore.createReferenceDoc` — `{ missionId: number; title: string; slug: string; htmlContent: string; docType: string }`

### 6. InMemoryLearningRecordStore

- **Collection**: `learningRecords: LearningRecordRow[]` (was `any[]`)
- **`createLearningRecord(v)`**: Type from `LearningRecordStore.createLearningRecord` — `{ missionId: number; number: number; title: string; markdownContent: string; status?: string; supersededBy?: number | null }`
- **`updateLearningRecord(id, values)`**: Type `values` from `LearningRecordStore.updateLearningRecord` — `{ status?: string; supersededBy?: number | null }`

### 7. InMemoryUserStore

- **Collection**: `users: UserRow[]` (was `any[]`)
- **`createUser(v)`**: Type from `UserStore.createUser` — `{ email: string; passwordHash: string; name?: string }`
- **`updateUser(id, values)`**: Type `values` from `UserStore.updateUser` — `{ name?: string; email?: string; passwordHash?: string }`

### 8. InMemorySessionStore

- **Collection**: `sessions: SessionRow[]` (was `any[]`)
- **`createSession(v)`**: Already properly typed in signature. No change needed.
- **Other methods**: Already properly typed. No change needed.

## Sort Callback Typing

Several InMemory stores use `.sort((a: any, b: any) => ...)` in method implementations. These `a, b` parameters should be typed as the corresponding row type:
- `InMemoryLessonStore.listLessons`: `(a: LessonRow, b: LessonRow) => ...`
- `InMemoryChatStore.getChatMessages`: `(a: ChatMessageRow, b: ChatMessageRow) => ...`
- `InMemoryLearningRecordStore.listLearningRecords`: `(a: LearningRecordRow, b: LearningRecordRow) => ...`
- `InMemoryRefDocStore.listReferenceDocs`: `(a: ReferenceDocRow, b: ReferenceDocRow) => ...`
