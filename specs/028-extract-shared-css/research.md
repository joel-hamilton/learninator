# Research: Extract Shared CSS from Views

## Research Tasks

### 1. Determine Hono static file serving approach

**Decision**: Use a dedicated Hono route handler to serve `base.css` from the filesystem.

**Rationale**: `@hono/node-server` does not bundle `serveStatic` in a way that is straightforward for this project. A simple route handler using `fs.readFileSync` (or `fs.promises.readFile` for async) with proper `Content-Type` and caching headers is the simplest approach that works with the existing dependency tree. The route can be registered as `app.get("/static/:file", ...)`.

**Alternatives considered**:
- `@hono/node-server/serve-static` import — depends on version compatibility and may add unnecessary complexity for a single file
- `@hono/serve-static` package — adds a dependency for serving one file
- Copy to `public/` directory — requires Dockerfile changes and adds build step complexity

**Caching strategy**:
- Production: `Cache-Control: public, max-age=31536000, immutable` (1 year, never revalidate)
- Development: `Cache-Control: no-cache, must-revalidate` or append a content-hash query parameter
- Content-hash approach: `base.v1.css`, `base.v2.css` on each change, or use `?v=<git-hash>` query param

### 2. Audit duplicate CSS across view files

**Decision**: Each view file's `<style>` block must be manually audited against the shared CSS in `HTMX_HEAD` to identify:
- Rules that are direct duplicates of shared rules → remove from view file
- Rules that are shared rules with minor overrides → keep the override in the view file, remove the shared portion
- Rules that are truly page-specific → keep unchanged

The 5 files known to import HTMX_HEAD: `auth.ts`, `home.ts`, `lesson.ts`, `mission.ts`, `onboarding.ts`. Additionally `browse.ts`, `profile.ts`, and `settings.ts` have their own `<style>` blocks but may not import HTMX_HEAD (need to verify).

**Known duplicates**:
- `.header` — defined in 5 places, needs consolidation
- `.chat-messages` — defined in 4 places, needs consolidation
- `#htmx-loading-bar` — 2.5px in shared.ts CSS vs 3px inline in onboarding.ts

### 3. Resolve loading bar conflict

**Decision**: Use `2.5px` as the canonical height. Rationale: the CSS rule in `HTMX_HEAD` (shared.ts) is the authoritative shared definition. The inline style `height:3px` in `onboarding.ts` appears to be a copy-paste artifact or an unintentional deviation. Remove the inline style from onboarding.ts so the loading bar element uses the shared CSS rule.

**Alternatives considered**:
- Use 3px everywhere — no strong reason to prefer this over 2.5px
- Make configurable — violates YAGNI (no scenario requires configurable loading bar height)

### 4. Development cache invalidation

**Decision**: Use a simpler approach that avoids content hashing. Since the dev server is restarted frequently during development, use `Cache-Control: no-cache, must-revalidate` in dev mode. The dev server can check `NODE_ENV` or a similar flag to determine which caching header to send.

**Alternatives considered**:
- Content hash in filename (`base.v1.css`) — requires manual version bumps or automated hashing
- Query parameter (`?v=<hash>`) — requires computing a hash at startup and passing it to the template
- No caching in dev — simplest, sufficient for single-developer workflow

### 5. Integration with existing templates

**Decision**: The `HTMX_HEAD` template literal in `shared.ts` will change from:

```typescript
export const HTMX_HEAD = `<script src="..."></script>
<link ...>
<style>...490 lines of CSS...</style>`;
```

to:

```typescript
export const HTMX_HEAD = `<script src="..."></script>
<link ...>
<link rel="stylesheet" href="/static/base.css">`;
```

The Google Fonts preconnect/link tags remain in `HTMX_HEAD` (they are not CSS — they are HTML link/preconnect elements). The htmx script tag also remains in `HTMX_HEAD`. Only the `<style>` block is extracted.

The `HTMX_LOADING_BAR` constant remains unchanged (it is an HTML element, not CSS).
