# Implementation Plan: Extract Shared CSS from Views

**Branch**: `028-extract-shared-css` | **Date**: 2026-06-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-extract-shared-css/spec.md`

## Summary

Extract the ~490-line inlined `HTMX_HEAD` `<style>` block from `src/views/shared.ts` into a standalone static CSS file (`src/views/base.css`), served with aggressive caching headers. Remove duplicated CSS rules from individual view files' inline `<style>` blocks, consolidating shared definitions (`.header`, `.chat-messages`, `#htmx-loading-bar`, etc.) into the single `base.css`. Page-specific style overrides remain co-located with their markup per ADR-0004. The `HTMX_HEAD` template literal becomes a `<link rel="stylesheet">` tag.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, ES modules

**Primary Dependencies**: Hono 4.x (`@hono/node-server` 1.x) — uses `c.html()` for HTML template literal responses. Hono ships with `serveStatic` middleware in `hono/dist/middleware/serve-static/` but requires the adapter-specific package (`@hono/node-server` does NOT bundle `serveStatic` natively; it requires `@hono/node-server`'s built-in static file handling or a manual route).

**Storage**: N/A — CSS is a static file, not a database entity. The file lives on the filesystem and is served by the HTTP server.

**Testing**: Vitest via `app.request()` (in-process HTTP, no port binding). CSS extraction is tested visually (no visual regression) and via page HTML inspection (presence of `<link>` tag, absence of inlined `<style>` for shared rules). No new test files needed — existing tests confirm pages render without crashes.

**Target Platform**: Linux server (Docker Compose deployment), modern browsers (Chrome, Firefox, Safari)

**Project Type**: Web application (Hono/htmx server-rendered HTML)

**Performance Goals**: HTML payload reduced by ~4KB per page (the size of inlined CSS). Subsequent page loads serve `base.css` from browser cache (zero network bytes for CSS).

**Constraints**: 
- Must NOT change visual appearance (pixel-identical rendering)
- Must NOT break htmx dynamic content loading (shared styles must apply to htmx-loaded fragments too)
- Development caching must not hide CSS changes (dev-mode cache invalidation needed)
- Aggressive caching in production (`Cache-Control: public, max-age=31536000, immutable`)

**Scale/Scope**: 7 view files with `<style>` blocks (auth.ts, browse.ts, home.ts, lesson.ts, mission.ts, onboarding.ts, profile.ts, settings.ts) plus shared.ts. ~490 lines of foundation CSS to extract.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate I — Factory-Based Testability (Principle I)

**Status: PASS**. The CSS extraction does not introduce any new singletons or module-level state. Static file serving can be injected via `createApp()` options if needed, or can use Hono's built-in middleware. No new database connections or AI clients are involved.

### Gate II — HTTP-Level Integration Testing (Principle II)

**Status: PASS**. The change is purely presentational. Existing HTTP-level tests (`app.request()`) continue to work unchanged. Static CSS files are served through the same Hono app; tests that check HTML output can verify the `<link>` tag presence without needing to test CSS loading.

### Gate III — Hypermedia-Driven Frontend (Principle III)

**Status: PASS**. No templating engine is introduced. htmx remains the interactivity mechanism. CSS is plain CSS — no preprocessor or build step. htmx-loaded fragments continue to receive shared styles from `base.css` (external stylesheets apply to dynamically loaded content).

### Gate IV — Explicit Dependency Injection (Principle IV)

**Status: PASS**. No new context dependencies are introduced. The static CSS file is served via Hono middleware, not through `c.get()` injection.

### Gate V — Migration Snapshot Integrity (Principle V)

**Status: N/A**. No database schema changes.

### Additional Constitution Checks

- **Immediate UI feedback**: CSS extraction does not affect loading indicators, spinner animations, or the `htmx-request` class behavior. The `#htmx-loading-bar` will be defined consistently in one place.
- **No speculative features**: The extraction is purely mechanical — move shared CSS to a file, deduplicate. No new CSS features or abstractions.
- **YAGNI**: No build step, no CSS preprocessor, no PostCSS, no Tailwind. Plain CSS file served directly.

**Overall: GATE PASSED**. No violations requiring Complexity Tracking.

## Research

The following investigations were conducted during Phase 0:

1. **Exact contents of `HTMX_HEAD`**: The inlined `<style>` block in `src/views/shared.ts` (lines 52-584) contains ~533 lines of CSS covering: design tokens (CSS custom properties), reset, typography, scrollbar, loading bar, spinner/thinking dots, animations, badges, buttons, form elements, chat messages, chat form, section labels/headers, markdown body, user menu, modal, workflow indicator, chat progress panel, generation progress panel, and activation progress panel. Additionally, the HTML includes the htmx script tag and Google Fonts preconnect/link tags.

2. **View files with CSS duplication**: The following view files have their own `<style>` blocks that may contain duplicated shared rules:
   - `src/views/auth.ts` — login/signup page styles
   - `src/views/browse.ts` — topic browsing page styles
   - `src/views/home.ts` — dashboard styles
   - `src/views/lesson.ts` — lesson view styles
   - `src/views/mission.ts` — mission detail styles
   - `src/views/onboarding.ts` — guided Q&A onboarding styles (3 separate `<style>` blocks)
   - `src/views/profile.ts` — user profile styles
   - `src/views/settings.ts` — settings page styles

3. **Static file serving with Hono**: Hono's `serveStatic` middleware is available in the main hono package for Deno/Node.js adapters, but `@hono/node-server` (v1.19.14) does not include it directly. The simplest approach is to register a manual route handler that reads the CSS file and serves it with the proper `Content-Type` and caching headers. Alternatively, `import { serveStatic } from '@hono/node-server/serve-static'` may be available depending on the version. Fallback: a simple route handler using `fs.readFileSync` or `Bun.file` style approach. Since this is a Node.js project using `@hono/node-server`, the path should be: use a manual catch-all route or a dedicated handler. Actually, looking at `@hono/node-server` API, the package does export `serveStatic` at `@hono/node-server/serve-static`. But the simplest approach is a manual route: `app.get("/static/:file", async (c) => { ... })`.

4. **Loading bar conflict**: `shared.ts` defines `#htmx-loading-bar` with `height: 2.5px` in the CSS rule (line 142). `onboarding.ts` has an inline style `height:3px` on the loading bar element (line 162). The CSS rule in shared.ts should be the source of truth (2.5px), and the onboarding.ts inline style should be removed to use the shared definition.

5. **Duplicate class definitions**: `.header` is defined 5 times across views, `.chat-messages` 4 times. Each view file's `<style>` block must be audited to identify rules that belong in `base.css` vs. rules that are page-specific.

## Project Structure

### Documentation (this feature)

```text
specs/028-extract-shared-css/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 validation guide
├── contracts/           # Phase 1 interface contracts
└── tasks.md             # Phase 2 implementation tasks
```

### Source Code (repository root)

```text
src/
├── views/
│   ├── base.css         # NEW — extracted shared foundation CSS (was HTMX_HEAD's <style>)
│   ├── shared.ts        # MODIFIED — HTMX_HEAD uses <link> instead of inline <style>
│   ├── auth.ts          # MODIFIED — remove duplicated shared rules from <style>
│   ├── browse.ts        # MODIFIED — remove duplicated shared rules from <style>
│   ├── home.ts          # MODIFIED — remove duplicated shared rules from <style>
│   ├── lesson.ts        # MODIFIED — remove duplicated shared rules from <style>
│   ├── mission.ts       # MODIFIED — remove duplicated shared rules from <style>
│   ├── onboarding.ts    # MODIFIED — remove duplicated shared rules + fix loading bar
│   ├── profile.ts       # MODIFIED — remove duplicated shared rules from <style>
│   └── settings.ts      # MODIFIED — remove duplicated shared rules from <style>
└── index.ts             # MODIFIED — add route to serve /static/base.css
```

**Structure Decision**: Single web application. The CSS file lives alongside the TypeScript views in `src/views/` since it is the CSS equivalent of a view template. Static serving routes map `/static/*` to the CSS file. Page-specific `<style>` blocks remain in their respective view files.

## Complexity Tracking

> No Constitution Check violations found. Complexity Tracking table is not needed.

## Phase 1 Design

### Data Model

No database entities are involved. The only "entity" is the `base.css` file, which is a static asset:

- **base.css**: Contains all shared CSS currently inlined in `HTMX_HEAD`. This is a plain CSS file served from the filesystem. No build step, no preprocessing. CSS custom properties (design tokens) are defined in `:root` selectors as they are today.

### Contracts

No external API contracts are involved. The only interface is the HTTP route:

- **GET /static/base.css**: Returns the CSS file with:
  - `Content-Type: text/css`
  - `Cache-Control: public, max-age=31536000, immutable` (production)
  - `Cache-Control: no-cache` or query-param cache busting (development)

### Quickstart Validation

See [quickstart.md](quickstart.md) for validation instructions.

## Agent Context Update

After completing this plan, run `/speckit-agent-context-update` to update the `CLAUDE.md` plan reference to point to this plan file.
