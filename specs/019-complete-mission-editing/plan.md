# Implementation Plan: Complete Mission Editing Coverage

**Branch**: `019-complete-mission-editing` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-complete-mission-editing/spec.md`

## Summary

Fill all test-coverage and behavior gaps found in the 007-chat-based-mission-editing
analysis: inject mission content into chat conversation context (FR-006 gap), add
cross-user scoping enforcement tests (FR-008 gap), verify remaining sidebar tab
routes (SC-004 gap), and add edge-case tests for all five unverified scenarios.
Almost all implementation already exists; this is ~90% test writing and ~10%
context-injection wiring.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules
**Primary Dependencies**: Hono, htmx, Drizzle ORM (better-sqlite3), Anthropic SDK
**Storage**: SQLite via Drizzle — `mission_content` table already stores mission content
**Testing**: Vitest with in-memory SQLite and `FakeAiClient`; HTTP-level via `app.request()`
**Target Platform**: Self-hosted web app (Docker Compose)
**Project Type**: Single web service (Hono backend + htmx hypermedia)
**Performance Goals**: N/A — test coverage addition, no runtime changes
**Constraints**: Mission content injection must happen in active-mission chat only; onboarding and archived missions have different flows
**Scale/Scope**: ~4 files touched, 0 LOC removed, ~100 LOC of tests added, 1 context-injection change in `mission-conversation.ts`

## Constitution Check

- **I. Factory-Based Testability**: PASS — no new singletons; tests use `createTestApp()` with injected `FakeAiClient` and in-memory DB.
- **II. HTTP-Level Integration Testing**: PASS — all new tests use `app.request()` + `FakeAiClient` queue. No mocks.
- **III. Hypermedia-Driven Frontend**: PASS — sidebar tab test checks HTML responses; no JSON endpoints added.
- **IV. Explicit Dependency Injection**: PASS — mission content injection reads from `c.get("db")` via store.
- **V. Migration Snapshot Integrity**: PASS — no schema changes.

No gate violations.

## Project Structure

### Documentation (this feature)

```text
specs/019-complete-mission-editing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (no new contracts)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── ai/
│   └── mission-conversation.ts   # Inject mission content into system prompt for active missions
├── test/
│   ├── chat.test.ts              # New tests: content injection, cross-user scoping, edge cases
│   └── missions.test.ts          # New tests: remaining sidebar tab route verification
```

**Structure Decision**: Single-project Hono app. No new files created. The only
non-test change is in `mission-conversation.ts` to inject `mission_content`
into the system prompt or tool context for active-mission chats.

## Complexity Tracking

No constitutional violations — table omitted.
