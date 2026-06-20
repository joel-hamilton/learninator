# Data Model: Extract Shared CSS from Views

## Overview

This feature involves no database entities. The "data model" is the organization of CSS rules across the codebase. The existing state has shared CSS inlined in every page's HTML; the target state extracts it to a single file.

## Entities

### base.css (NEW)

The single static CSS file containing all shared foundation styles. Located at `src/views/base.css`.

**Contents** (extracted from `HTMX_HEAD` inline `<style>` block, lines 52-584 of `shared.ts`):

| Section | CSS Rules | Lines |
|---------|-----------|-------|
| Design Tokens | `:root` custom properties (colors, spacing, shadows, fonts) | ~60 |
| Reset | `*` box-sizing, `html`/`body` defaults, `a` links | ~10 |
| Focus Ring | `:focus-visible` outline | ~3 |
| Selection | `::selection` style | ~3 |
| Scrollbar | `::-webkit-scrollbar` pseudo-elements | ~4 |
| Loading Bar | `#htmx-loading-bar` position/animations | ~9 |
| HTMX Indicator Toggle | `.htmx-indicator` show/hide | ~5 |
| Spinner | `.spinner` animation | ~2 |
| Thinking Dots | `.thinking-dots` bounce animation | ~5 |
| Animations | `@keyframes fadeInUp`, `fadeIn`, `slideInRight` + classes | ~10 |
| Staggered Entrance | `.stagger > *` nth-child delays | ~12 |
| SVG Icon | `.svg-icon` base size | ~2 |
| Badges | `.badge` + variants (default, active, in-progress, completed, etc.) | ~12 |
| Buttons | `.btn` + `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-accent`, `.btn-sm`, `.btn-lg` | ~35 |
| Form Elements | `.input` base + hover/focus states | ~10 |
| Chat Messages | `.msg-row`, `.msg-avatar`, `.msg` (user/assistant) + standalone variants | ~60 |
| Chat Form | `.chat-form`, textarea, button | ~40 |
| Section Label | `.section-label` | ~7 |
| Section Header | `.section-header` | ~4 |
| Markdown Body | `.markdown-body` typography, code, pre, blockquote, table, links | ~40 |
| User Menu | `.user-menu`, `.user-menu-trigger`, `.user-menu-dropdown` | ~30 |
| Modal | `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-close`, `.modal-body`, `.modal-footer` | ~48 |
| Workflow Indicator | `#workflow-indicator` + states (visible, error, disconnected) | ~40 |
| Chat Progress | `.chat-progress`, `.chat-progress-header`, `.chat-progress-steps` | ~28 |
| Generation Progress | `.generation-progress`, `.gen-progress-header` | ~12 |
| Activation Progress | `.activation-progress`, `.activation-progress-header` | ~12 |

**File type**: Plain CSS (no preprocessor)
**Encoding**: UTF-8
**Line endings**: LF

### HTMX_HEAD (MODIFIED)

Template literal in `src/views/shared.ts`. Currently contains:
- `<script>` tag for htmx
- Google Fonts `<link>` tags (preconnect + stylesheet)
- Inline `<style>` block (~490 lines of CSS)

After extraction:
- `<script>` tag for htmx — UNCHANGED
- Google Fonts `<link>` tags — UNCHANGED  
- `<link rel="stylesheet" href="/static/base.css">` — REPLACES the inline `<style>` block

### View File Style Blocks (MODIFIED)

Each view file that imports `HTMX_HEAD` has its own page-specific `<style>` block:

| File | Current State | After Extraction |
|------|--------------|------------------|
| `auth.ts` | Has `<style>` block | Only page-specific auth styles remain; shared rules removed |
| `browse.ts` | Has `<style>` block | Only page-specific browse styles remain; shared rules removed |
| `home.ts` | Has `<style>` block | Only page-specific home styles remain; shared rules removed |
| `lesson.ts` | Has `<style>` block | Only page-specific lesson styles remain; shared rules removed |
| `mission.ts` | Has `<style>` block | Only page-specific mission styles remain; shared rules removed |
| `onboarding.ts` | 3 `<style>` blocks | Only page-specific onboarding styles remain; `#htmx-loading-bar` inline style fixed |
| `profile.ts` | Has `<style>` block | Only page-specific profile styles remain; shared rules removed |
| `settings.ts` | Has `<style>` block | Only page-specific settings styles remain; shared rules removed |

## State Transitions

No state transitions. This is a file-level refactoring with no runtime state.
