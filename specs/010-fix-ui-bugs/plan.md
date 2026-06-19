# Implementation Plan: Fix UI Bugs

**Branch**: `010-fix-ui-bugs` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-fix-ui-bugs/spec.md`

## Summary

Fix four categories of UI bugs identified by users and code audit:
1. **Sidebar toggle not visible / can't re-open** — the toggle button is a child of `.sidebar` and gets clipped by `overflow: hidden` when collapsed.
2. **Chat FAB invisible (white-on-white)** — CSS custom property `--accent` is never defined, causing the FAB background to fall back to `transparent` while the icon is white.
3. **Chat messages overflow viewport** — missing `overflow-wrap`/`word-break` on message bubbles lets long unbroken strings push layout.
4. **Undefined design tokens** — `--accent`, `--accent-hover`, `--accent-light`, `--accent-ghost`, `--border`, `--text-muted`, `--text`, `--text-secondary`, `--primary-light` are used but never defined in `:root`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22

**Primary Dependencies**: Hono (server), htmx (frontend), no CSS framework

**Storage**: N/A (UI-only changes, no data model changes)

**Testing**: Vitest (existing test suite), manual browser verification at 375px/768px/1024px/1440px

**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge — last 2 years)

**Project Type**: Web application (server-rendered HTML with htmx)

**Performance Goals**: No regression — page render and interaction latency unchanged

**Constraints**: CSS/HTML changes only; no new dependencies; fixes must work within existing template-literal view architecture

**Scale/Scope**: 5 view files touched (`shared.ts`, `mission.ts`, `lesson.ts`, `home.ts`, `onboarding.ts`); ~50 lines of CSS/HTML changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Factory-Based Testability | N/A | No server-side logic changes |
| II. HTTP-Level Integration Testing | N/A | UI-only; visual verification sufficient |
| III. Hypermedia-Driven Frontend | ✅ PASS | Fixes use htmx patterns and inline CSS/JS in template literals — no framework migration |
| IV. Explicit Dependency Injection | N/A | No route/auth changes |
| V. Migration Snapshot Integrity | N/A | No schema changes |

**No violations.** All fixes are CSS/HTML changes within the existing htmx + template-literal architecture.

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-ui-bugs/
├── plan.md              # This file
├── research.md          # Phase 0 output — root cause analysis
├── quickstart.md        # Phase 1 output — verification guide
└── tasks.md             # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
src/views/
├── shared.ts            # Add --accent tokens, add word-break/overflow-wrap to .msg, add missing tokens
├── mission.ts           # Move .sidebar-toggle outside .sidebar, fix collapse CSS
├── lesson.ts            # Chat panel overflow fixes, use defined tokens
├── home.ts              # Audit fixes (if any found)
└── onboarding.ts        # Audit fixes (if any found)
```

**Structure Decision**: Single web application — all changes confined to `src/views/`. No new files needed.

## Complexity Tracking

> No violations to justify.
