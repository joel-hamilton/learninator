# Implementation Plan: Chat-Based Mission Editing

**Branch**: `007-chat-based-mission-editing` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-chat-based-mission-editing/spec.md`

## Summary

Remove the broken "Mission" sidebar tab in the mission layout, and rely on the
already-implemented `read_mission_content` / `write_mission_content` AI tools so
users can read and update mission goals directly through chat. Almost all the
backend pieces already exist; this feature is primarily a sidebar cleanup plus
verification that the chat path works end-to-end.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules
**Primary Dependencies**: Hono, htmx, Drizzle ORM (better-sqlite3), Anthropic SDK
**Storage**: SQLite via Drizzle — `mission_content` table already stores mission content (contentType="mission")
**Testing**: Vitest with in-memory SQLite and `FakeAiClient`; HTTP-level via `app.request()`
**Target Platform**: Self-hosted web app (Docker Compose)
**Project Type**: Single web service (Hono backend + htmx hypermedia)
**Performance Goals**: N/A — small UI change + reuse of existing AI tool path
**Constraints**: Mission editing only available for active missions; archived missions are read-only; users cannot modify other users' missions (tool calls scoped via `missionId` from the conversation context, store enforces `userId`)
**Scale/Scope**: ~3 files touched, ~50 LOC removed, 2-3 new tests

## Constitution Check

- **I. Factory-Based Testability**: PASS — no new singletons; reuses `createApp()` injection.
- **II. HTTP-Level Integration Testing**: PASS — tests use `app.request()` + `FakeAiClient` queue.
- **III. Hypermedia-Driven Frontend**: PASS — sidebar tab is template-literal HTML; no JSON.
- **IV. Explicit Dependency Injection**: PASS — chat route already reads `store`/`ai` from `c.get()`.
- **V. Migration Snapshot Integrity**: PASS — no schema change required (`mission_content` table already exists).

No gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-chat-based-mission-editing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── views/
│   └── mission.ts                # Remove "mission" tab from `tabs` array; remove `missionTabContent` if unused
├── routes/
│   └── missions.ts               # No new routes; only verify no leftover references
├── ai/
│   ├── teacher.ts                # read_mission_content + write_mission_content already defined (no edit)
│   ├── tools.ts                  # implementations already registered (no edit)
│   └── mission-conversation.ts   # Already loads TEACHER_TOOLS for active missions (no edit)
└── test/
    └── chat.test.ts              # New tests: AI calls read_mission_content / write_mission_content; tab absence
```

**Structure Decision**: Single-project Hono app. The bulk of this work happens
in `src/views/mission.ts` (sidebar tab removal) and `src/test/`. No new files
created; no new modules introduced.

## Complexity Tracking

No constitutional violations — table omitted.
