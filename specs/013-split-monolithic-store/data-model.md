# Data Model: Split Monolithic MissionStore

## Focused Store Interfaces

### MissionStore (focused — missions table)

```typescript
export interface MissionStore {
  createMission(values: { userId: number; title: string; slug: string; status?: string; onboardingMode?: string }): Promise<MissionRow>;
  getMission(id: number, userId: number): Promise<MissionRow | undefined>;
  listMissions(userId: number, opts?: { status?: string; limit?: number }): Promise<MissionRow[]>;
  updateMissionTitle(id: number, title: string): Promise<void>;
  updateMissionOnboardingMode(id: number, mode: "guided" | "chat"): Promise<void>;
  updateMissionStatus(id: number, status: "onboarding" | "active" | "archived"): Promise<void>;
  deleteMission(id: number): Promise<void>;
}
```

**Table**: `missions` | **7 methods** | Used by: routes/home, routes/missions, routes/lessons, routes/chat, routes/browse, ai/tools, ai/mission-conversation, onboarding

### LessonStore (lessons table)

```typescript
export interface LessonStore {
  createLesson(values: { missionId: number; number: number; title: string; slug: string; htmlContent: string; status?: string; parentLessonId?: number; subNumber?: number }): Promise<LessonRow>;
  getLesson(missionId: number, number: number, subNumber?: number | null): Promise<LessonRow | undefined>;
  getLatestLesson(missionId: number): Promise<LessonRow | undefined>;
  listLessons(missionId: number): Promise<LessonRow[]>;
  listLessonSummaries(missionId: number): Promise<LessonSummary[]>;
  getMaxLessonNumber(missionId: number): Promise<number>;
  getSubLessonCount(missionId: number, parentLessonId: number): Promise<number>;
  getLessonCount(missionId: number): Promise<number>;
  getMainLessonCount(missionId: number): Promise<number>;
  getMaxSubNumber(parentLessonId: number): Promise<number | null>;
  findLessonBySlug(missionId: number, slug: string): Promise<LessonRow | undefined>;
  updateLessonStatus(missionId: number, number: number, subNumber: number | null, status: string, completedAt?: string | null): Promise<void>;
  updateLessonFeedback(missionId: number, number: number, subNumber: number | null, rating: string, text?: string): Promise<void>;
  listLessonFeedback(missionId: number): Promise<LessonFeedbackSummary[]>;
  updateLessonContent(missionId: number, number: number, subNumber: number | null, title: string, slug: string, htmlContent: string): Promise<void>;
}
```

**Table**: `lessons` | **15 methods** | Includes `getMaxSubNumber` (moved from compatibility alias to canonical). Used by: routes/lessons, ai/tools, lessons/generator

### ChatStore (chat_messages + guided_questions tables)

```typescript
export interface ChatStore {
  saveChatMessage(values: { missionId: number; role: "user" | "assistant"; content: string }): Promise<void>;
  getChatMessages(missionId: number): Promise<ChatMessageRow[]>;
  createGuidedQuestion(values: { missionId: number; question: string; options: string }): Promise<GuidedQuestionRow>;
  getPendingQuestion(missionId: number): Promise<GuidedQuestionRow | undefined>;
  answerQuestion(id: number, answer: string, answerText?: string | null): Promise<void>;
  skipPendingQuestions(missionId: number): Promise<void>;
}
```

**Tables**: `chat_messages`, `guided_questions` | **6 methods** | Used by: ai/conversation, ai/mission-conversation, shared/messages, onboarding, routes/missions

### ContentStore (mission_content table)

```typescript
export interface ContentStore {
  getMissionContent(missionId: number, contentType: string): Promise<MissionContentRow | undefined>;
  upsertMissionContent(values: { missionId: number; contentType: string; markdownContent: string }): Promise<void>;
}
```

**Table**: `mission_content` | **2 methods** | Used by: ai/tools, ai/mission-conversation, routes/missions, routes/chat

### RefDocStore (reference_docs table)

```typescript
export interface RefDocStore {
  createReferenceDoc(values: { missionId: number; title: string; slug: string; htmlContent: string; docType: string }): Promise<ReferenceDocRow>;
  getReferenceDoc(id: number, missionId: number): Promise<ReferenceDocRow | undefined>;
  listReferenceDocs(missionId: number): Promise<ReferenceDocRow[]>;
}
```

**Table**: `reference_docs` | **3 methods** | Used by: ai/tools, routes/missions

### LearningRecordStore (learning_records table)

```typescript
export interface LearningRecordStore {
  createLearningRecord(values: { missionId: number; number: number; title: string; markdownContent: string; status?: string; supersededBy?: number | null }): Promise<LearningRecordRow>;
  listLearningRecords(missionId: number): Promise<LearningRecordRow[]>;
  updateLearningRecord(id: number, values: { status?: string; supersededBy?: number | null }): Promise<void>;
  getLearningRecordCount(missionId: number): Promise<number>;
}
```

**Table**: `learning_records` | **4 methods** | `getLearningRecordCount` moved here from the old monolithic interface. Used by: ai/tools, routes/missions

### UserStore (users table)

```typescript
export interface UserStore {
  getUser(id: number): Promise<UserRow | undefined>;
  getUserByEmail(email: string): Promise<UserRow | undefined>;
  createUser(values: { email: string; passwordHash: string; name?: string }): Promise<UserRow>;
  updateUser(id: number, values: { name?: string; email?: string; passwordHash?: string }): Promise<void>;
}
```

**Table**: `users` | **4 methods** | Used by: auth/index, routes/settings

## Composite Class

```typescript
export class DrizzleMissionStore implements MissionStore, LessonStore, ChatStore, ContentStore, RefDocStore, LearningRecordStore, UserStore {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}
  // ... all method implementations
}
```

## In-Memory Implementations (for tests)

```typescript
export class InMemoryMissionStore implements MissionStore { /* 7 methods */ }
export class InMemoryLessonStore implements LessonStore { /* 15 methods */ }
export class InMemoryChatStore implements ChatStore { /* 6 methods */ }
export class InMemoryContentStore implements ContentStore { /* 2 methods */ }
export class InMemoryRefDocStore implements RefDocStore { /* 3 methods */ }
export class InMemoryLearningRecordStore implements LearningRecordStore { /* 4 methods */ }
export class InMemoryUserStore implements UserStore { /* 4 methods */ }
```

The old `InMemoryMissionStore` (monolithic, 610 lines) is removed.

## Removed Items

- **9 compatibility aliases**: `readMissionContent`, `upsertMissionContentPos`, `getMainLessonByNumber`, `getMaxSubNumber` (moved to canonical), `insertLesson`, `insertReferenceDoc`, `insertLearningRecord`, `insertGuidedQuestion`, `updateLearningRecordPos`
- **Monolithic `MissionStore` interface** (replaced by focused `MissionStore` + 6 other interfaces)
- **`InMemoryMissionStore`** (replaced by 7 focused `InMemory*` classes)
