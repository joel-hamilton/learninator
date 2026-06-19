# Data Model: Fix UI Bugs

**Feature**: Fix UI Bugs | **Date**: 2026-06-18

## Summary

No data model changes. This feature is entirely CSS/HTML fixes in the view layer. No database schema, store, or route changes.

## Affected Design Tokens (CSS Custom Properties)

These are the CSS custom properties affected — not a database model, but worth documenting as they represent the design system's "data":

### New tokens to add in `src/views/shared.ts`

| Token | Value | Purpose |
|---|---|---|
| `--accent` | `#4f46e5` | Primary interactive color (FAB background, action buttons) |
| `--accent-hover` | `#4338ca` | Accent hover state |
| `--accent-light` | `#eef2ff` | Subtle accent background |
| `--accent-ghost` | `#f5f3ff` | Near-white accent background |

### Token aliases to add in `src/views/shared.ts`

| Token | Maps to | Value | Purpose |
|---|---|---|---|
| `--border` | `var(--rule)` | `#e0dbd2` | Border color (alias for consistency) |
| `--text` | `var(--ink)` | `#1e1b18` | Primary text (alias) |
| `--text-secondary` | `var(--ink-secondary)` | `#5c5650` | Secondary text (alias) |
| `--text-muted` | `var(--ink-muted)` | `#9c9589` | Muted text (alias) |

These aliases prevent breakage in views that reference these tokens without needing to rename every occurrence.
