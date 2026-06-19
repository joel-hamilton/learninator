# Implementation Plan: Relocate Message Persistence

**Branch**: `024-relocate-message-persistence` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-relocate-message-persistence/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command.

## Summary

Move `saveMessage` and `loadMessages` from `src/shared/messages.ts` to a new file `src/ai/persistence.ts` (co-located with the AI conversation layer where they are consumed), move `contentToText` to `src/views/shared.ts` (closer to its display-only consumers), delete the now-empty `src/shared/messages.ts`, and update all import paths. Remove unused `eq` and `asc` drizzle-orm imports. No behavioral changes.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: None new — pure TypeScript module relocation

**Storage**: SQLite via better-sqlite3, Drizzle ORM (unchanged, via ChatStore interface)

**Testing**: Vitest, in-process HTTP via `app.request()`, in-memory SQLite, FakeAiClient

**Target Platform**: Linux server (Docker), macOS dev

**Project Type**: Web application (Hono + htmx)

**Performance Goals**: Zero regression — this is pure code relocation with no behavioral changes

**Constraints**: All three functions must preserve exact signatures and behavior

**Scale/Scope**: Three consumer files updated, one file created, one file deleted

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This plan involves:
- **Principle I (Factory-Based Testability)**: Not affected — no changes to app factory or dependency wiring
- **Principle II (HTTP-Level Integration Testing)**: Test suite must continue to pass with zero test modifications
- **Principle IV (Explicit Dependency Injection)**: Not affected — `saveMessage`/`loadMessages` already accept `ChatStore` as a parameter; `contentToText` is a pure function
- **Principle IX (No speculative features / YAGNI)**: The new files contain only moved code, no speculative abstractions

**No violations found.** This is a pure relocation refactoring that improves code organization without introducing any new capabilities or complexity.

## Project Structure

### Documentation (this feature)

```text
specs/024-relocate-message-persistence/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — pure relocation, no new data entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (minimal — public function signatures)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── ai/
│   ├── conversation.ts          # Updated import: saveMessage from ./persistence.js
│   └── persistence.ts           # NEW: saveMessage, loadMessages
├── services/
│   └── mission-chat.service.ts  # Updated import: saveMessage, loadMessages from ../ai/persistence.js
├── routes/
│   └── missions.ts              # Updated import: contentToText from ../views/shared.js, others from ../ai/persistence.js
├── views/
│   └── shared.ts                # RECEIVES: contentToText
└── shared/
    └── messages.ts              # DELETED

src/shared/                      # No remaining content — directory may be kept or removed
```

**Structure Decision**: Single project. The new `src/ai/persistence.ts` follows the existing pattern of AI-layer modules. The `contentToText` function joins existing display helpers in `src/views/shared.ts`.

## Complexity Tracking

> No complexity violations. Pure relocation refactoring with no architectural changes.
