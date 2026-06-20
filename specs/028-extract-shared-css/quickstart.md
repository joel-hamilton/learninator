# Quickstart: Extract Shared CSS from Views

## Prerequisites

- Node.js 22
- Project dependencies installed (`npm install`)
- Dev server running (`npm run dev`)

## Setup

No database setup required. This is a purely presentational change.

## Validation Scenarios

### Scenario 1: CSS served as static file

1. Start the dev server: `npm run dev`
2. Open any page (e.g., `http://localhost:3000`)
3. Open browser DevTools > Network tab
4. Verify a request was made to `/static/base.css`
5. Verify the response has `Content-Type: text/css`
6. Verify the response is valid CSS

**Expected**: The page renders with full styling. The CSS file loads successfully.

### Scenario 2: HTML no longer inlines shared CSS

1. Open any page in the browser
2. Open browser DevTools > Elements tab
3. Inspect the `<head>` element
4. Verify there is a `<link rel="stylesheet" href="/static/base.css">` tag
5. Verify there is NO inline `<style>` block containing the shared CSS (no reset, no design tokens, no button styles, etc.)

**Expected**: The `<style>` tag in `<head>` contains at most page-specific rules. All shared foundation CSS is in the external stylesheet.

### Scenario 3: No visual regression

1. Open each of these pages in the browser (before and after the change, or side-by-side):
   - Home: `http://localhost:3000/`
   - Login: `http://localhost:3000/login`
   - Signup: `http://localhost:3000/signup`
   - Mission list (authenticated): `http://localhost:3000/missions`
   - Mission detail: `http://localhost:3000/missions/:id`
   - Lesson: `http://localhost:3000/missions/:id/lessons/:lessonId`
   - Settings: `http://localhost:3000/settings`
   - Browse: `http://localhost:3000/browse`
2. Verify visual appearance is identical

**Expected**: All pages render identically before and after the CSS extraction.

### Scenario 4: Loading bar consistent height

1. Open any page
2. Trigger an htmx request (e.g., click a button that makes an AJAX call)
3. Verify the `#htmx-loading-bar` element appears at the top of the viewport
4. The loading bar height should be `2.5px` (not 3px) across all pages including onboarding

**Expected**: The loading bar is consistently `2.5px` tall on every page.

### Scenario 5: Development caching

1. Run the dev server (`npm run dev`)
2. Make a change to `src/views/base.css` (e.g., change `--rubric` color to a different value)
3. Reload any page
4. Verify the CSS change appears without needing to clear the browser cache

**Expected**: CSS changes take effect immediately on page reload in development mode.

### Scenario 6: Production caching headers

1. Build and run the production Docker container: `docker compose up`
2. Load any page
3. Check the response headers for `/static/base.css`
4. Verify `Cache-Control` header contains `public, max-age=31536000, immutable`

**Expected**: Production caching headers are set.

## Test Command

```bash
npm test
```

All existing tests must pass. No new tests are strictly required, but consider adding a test that verifies the `<link>` tag is present in the rendered HTML.
