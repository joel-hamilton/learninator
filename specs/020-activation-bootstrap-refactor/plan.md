# Implementation Plan: Consolidate Activation Bootstrap

**Branch**: `020-activation-bootstrap-refactor` | **Date**: 2026-06-19 | **Spec**: spec.md

**Input**: Feature specification from `specs/020-activation-bootstrap-refactor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extract the identical 3-line `if (result.didActivate)` block duplicated across five route handlers (two in `missions.ts`, three in `onboarding.ts`) into a single shared helper function. The helper accepts `(result, missionId, missionChatService, c)` and performs title generation plus `HX-Redirect`. The helper lives in a new `src/shared/activate-mission.ts` module to avoid circular dependencies with the mission-chat service or route modules.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono (web framework), Anthropic SDK (AI client)

**Storage**: SQLite via better-sqlite3 / Drizzle ORM (not directly involved in this refactor)

**Testing**: Vitest, HTTP-level via `app.request()`, `FakeAiClient` for AI queue

**Target Platform**: Linux server (Docker), also macOS for dev

**Project Type**: Web application (server-rendered HTML via htmx)

**Performance Goals**: No change — pure structural refactoring; zero overhead (one extra function call)

**Constraints**: Must not create circular imports between the new helper module, route modules, and the mission chat service. The helper only imports types, not runtime modules.

**Scale/Scope**: 5 route handlers in 2 files, ~15 lines of duplicated code consolidated to 1 shared function

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Factory-Based Testability (PASS)
The new helper function accepts Hono `Context` as a parameter and does not create its own singletons or module-level state. Callers pass `c` and `missionChatService` explicitly. Tests can exercise the helper by constructing appropriate inputs — no hidden globals to mock.

### Gate II — HTTP-Level Integration Testing (PASS)
The helper operates at the response-header level (setting `HX-Redirect`, returning body). Existing HTTP-level tests exercise the full request/response cycle and will continue to pass without modification. No new test infrastructure is needed.

### Gate III — Hypermedia-Driven Frontend (PASS)
The helper preserves the `HX-Redirect` header contract with the htmx frontend. No JSON responses introduced. The return type is `Response | undefined` as before.

### Gate IV — Explicit Dependency Injection (PASS)
The helper receives `missionChatService`, `missionId`, and the Hono `Context` as explicit parameters — not as module-level imports. This follows the same DI pattern as the route handlers that call it.

### Gate V — Migration Snapshot Integrity (N/A)
No schema changes. No migration files needed.

**Conclusion**: All applicable gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/020-activation-bootstrap-refactor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — confirmed no open questions
├── data-model.md        # Phase 1 output — no new entities, interface contract
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/           # Phase 1 output — function signature contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── shared/
│   └── activate-mission.ts    # NEW — shared helper function
├── routes/
│   ├── missions.ts            # MODIFIED — replace 2 inline didActivate blocks
│   └── onboarding.ts          # MODIFIED — replace 3 inline didActivate blocks
├── services/
│   └── mission-chat.service.ts # UNCHANGED
└── test/
    ├── missions.test.ts       # UNCHANGED (should pass as-is)
    ├── onboarding.test.ts     # UNCHANGED (should pass as-is)
    └── chat.test.ts           # UNCHANGED (should pass as-is)
```

**Structure Decision**: Single-project layout (no monorepo). The new helper goes in `src/shared/` which already exists and has no dependencies on route or service modules. This avoids circular imports with the mission-chat service.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.
