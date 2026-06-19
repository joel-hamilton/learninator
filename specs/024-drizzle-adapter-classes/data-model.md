# Data Model: Drizzle Adapter Classes

## Architecture Overview

No new data entities. This refactor decomposes the existing `DrizzleMissionStore` class into focused adapter classes. Each adapter corresponds to exactly one database table (or table pair) and implements exactly one store interface.

## Adapter Class Responsibilities

### Entity: `DrizzleMissionAdapter`
- **Implements**: `MissionStore`
- **Table(s)**: `missions`
- **Dependency**: `BetterSQLite3Database<typeof schema>`
- **Cross-domain**: `deleteMission()` cascades to chat_messages, guided_questions, lessons, reference_docs, learning_records, mission_content

### Entity: `DrizzleLessonAdapter`
- **Implements**: `LessonStore`
- **Table(s)**: `lessons`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleChatAdapter`
- **Implements**: `ChatStore`
- **Table(s)**: `chat_messages`, `guided_questions`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleContentAdapter`
- **Implements**: `ContentStore`
- **Table(s)**: `mission_content`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleRefDocAdapter`
- **Implements**: `RefDocStore`
- **Table(s)**: `reference_docs`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleLearningRecordAdapter`
- **Implements**: `LearningRecordStore`
- **Table(s)**: `learning_records`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleUserAdapter`
- **Implements**: `UserStore`
- **Table(s)**: `users`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

### Entity: `DrizzleSessionAdapter`
- **Implements**: `SessionStore`
- **Table(s)**: `sessions`
- **Dependency**: `BetterSQLite3Database<typeof schema>`

## Composite

### Entity: `DrizzleStore` (convenience composite)
- **Implements**: All 8 store interfaces (via composition)
- **Dependencies**: All 8 Drizzle*Adapter instances
- **Construction**: `new DrizzleStore(new DrizzleMissionAdapter(db), new DrizzleLessonAdapter(db), ...)`
- **Method delegation**: Each method delegates to the corresponding adapter method
- **Purpose**: Preserves backward compatibility for `c.get("store")` call sites

## File Structure

```
src/db/
├── adapters/
│   ├── index.ts                      # DrizzleStore composite class + re-exports
│   ├── drizzle-mission-adapter.ts
│   ├── drizzle-lesson-adapter.ts
│   ├── drizzle-chat-adapter.ts
│   ├── drizzle-content-adapter.ts
│   ├── drizzle-refdoc-adapter.ts
│   ├── drizzle-learning-record-adapter.ts
│   ├── drizzle-user-adapter.ts
│   └── drizzle-session-adapter.ts
├── store.ts                          # Interfaces + InMemory stores (unchanged)
├── schema.ts                         # Schema definitions (unchanged)
├── index.ts                          # DB connection singleton (unchanged)
├── migrate.ts                        # Migration runner (unchanged)
└── migrations/                       # Migration files (unchanged)
```

## Wiring Diagram

```
createApp(db)
├── new DrizzleMissionAdapter(db)
│   └── implements MissionStore
├── new DrizzleLessonAdapter(db)
│   └── implements LessonStore
├── new DrizzleChatAdapter(db)
│   └── implements ChatStore
├── new DrizzleContentAdapter(db)
│   └── implements ContentStore
├── new DrizzleRefDocAdapter(db)
│   └── implements RefDocStore
├── new DrizzleLearningRecordAdapter(db)
│   └── implements LearningRecordStore
├── new DrizzleUserAdapter(db)
│   └── implements UserStore
├── new DrizzleSessionAdapter(db)
│   └── implements SessionStore
├── new DrizzleStore(mission, lesson, chat, content, refdoc, lr, user, session)
│   └── stored as c.set("store", store) — backward compat for routes
├── createToolExecutor(all 6 tool interfaces)
├── createLessonGenerator(missionAdapter, lessonAdapter)
└── createMissionChatService(missionAdapter, chatAdapter, contentAdapter)
```
