# Contracts: Extract View-Model Functions

## Overview

This feature has no external interface contracts. The "contracts" are the function signatures documented in [data-model.md](../data-model.md) — each extracted function is a pure data transformation with clearly defined input and output types.

## Imports

The extracted functions import from existing shared utilities:
- `contentToText` and `formatMarkdown` from `src/shared/messages.ts` (chat message rendering)
- `chatMessageBubble` from `src/views/shared.ts` (chat message HTML rendering)
- `lessonCard` from `src/views/lesson.ts` (lesson card rendering via enriched data)

## Constraints

- Functions MUST NOT import or reference any Hono, database, or AI client code
- Functions MUST NOT produce side effects (no console, no file I/O, no network)
- Functions MUST return fresh data/HTML on each call (no caching/memoization needed)
