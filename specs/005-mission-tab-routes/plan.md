# Implementation Plan: Mission Tab Routes

**Branch**: `005-mission-tab-routes` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-mission-tab-routes/spec.md`

## Summary

Add two missing route handlers in `src/routes/missions.ts` to fix the 404 on the Mission sidebar tab: a GET route that displays MISSION.md content via the existing `missionTabContent()` view function, and a POST route that handles AI-mediated mission refinement via `conversationLoop()`. Both routes follow the established patterns in the file (auth middleware, store usage, error handling, missionLayout wrapping).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (route handlers), Drizzle (DB via MissionStore), Anthropic SDK (AI conversation loop)

**Storage**: SQLite via better-sqlite3, Drizzle ORM. `store.getMissionContent()` and `store.upsertMissionContent()` for mission content CRUD.

**Testing**: Vitest, `app.request()` for in-process HTTP, `FakeAiClient` for fake AI responses

**Target Platform**: Linux server, Docker Compose

**Project Type**: Web application — Hono server with htmx frontend

**Performance Goals**: Standard web app — routes return HTML fragments, AI calls may take 5-30 seconds

**Constraints**: No new dependencies. Must reuse existing `conversationLoop()`, `missionTabContent()`, `missionLayout()`, `formatMarkdown()`, and `loadMessages()`/`saveMessage()`.

**Scale/Scope**: Single-user routes (multi-user via session auth). Adding 2 route handlers.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | Pass | Routes use `c.get("store")` — injectable via test factory |
| II. HTTP-Level Integration Testing | Pass | Existing pattern for testing routes with `app.request()` |
| III. Hypermedia-Driven Frontend | Pass | Returns HTML fragments, uses existing view functions |
| IV. Explicit Dependency Injection | Pass | Routes get store/ai/logger from Hono context |
| V. Migration Snapshot Integrity | N/A | No schema changes needed |

No violations. Feature is additive within existing architecture.

## Project Structure

### Documentation (this feature)

```text
specs/005-mission-tab-routes/
├── plan.md              # This file
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── routes/
│   └── missions.ts      # Add 2 route handlers (no new files needed)
```

## Complexity Tracking

No constitutional violations — architecture tracking is N/A.

## Phase 0: Research

No unknowns to resolve. All patterns are well-documented in the existing code:

1. **GET route pattern**: See `missionRoutes.get("/:missionId/resources", ...)` at line 551 — same pattern for mission tab: authenticate, get mission, get content, format, wrap in layout.
2. **POST route pattern**: See `missionRoutes.post("/:missionId/chat", ...)` at line 682 — same pattern for refine: authenticate, parse body, save message, run conversationLoop, render result.
3. **View signatures**: `missionTabContent(missionId, formattedMarkdown, confirmationMessage?)` from `src/views/mission.ts`; `missionLayout(user, mission, content, activeTab, backHref?, backLabel?)` from same file.

## Phase 1: Design

### Design Decisions

1. **GET route**: Use `store.getMissionContent(id, "mission")` to fetch the content. If no content exists, show "No mission statement yet." Wrap in `missionLayout()` with `activeTab: "mission"` and default back href (`/`, "Dashboard").

2. **POST route**: Save user message, run `conversationLoop()` with TEACHER_SYSTEM_PROMPT + refinement instructions, re-render mission tab on success with confirmation message. On error, show error in the mission tab content area.

3. **System prompt for refine**: Extend TEACHER_SYSTEM_PROMPT with instructions telling the AI to read/write mission content documents (MISSION.md, NOTES.md) based on user feedback.

### Data Model

No new entities needed. Uses existing:
- `store.getMissionContent(missionId, "mission")` — reads current MISSION.md
- `store.upsertMissionContent(...)` — writes updated content (via AI tools)
- `loadMessages(store, missionId)` / `saveMessage(store, missionId, role, content)` — message persistence

### Contracts

No new external interfaces. Route handlers are internal to the application.

### Quickstart Validation

No implementation code — see `tasks.md` for implementation details.
