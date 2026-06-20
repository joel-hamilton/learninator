# ADR-0004: htmx with server-rendered HTML fragments

**Status:** Accepted
**Date:** pre-reviews (foundational)

## Context

The application is a multi-user AI tutoring webapp. The interaction model
involves forms, AI chat, guided Q&A flows, and content display. A
single-page-application framework (React, Vue) would require duplicating
routing, validation, and auth logic across client and server.

## Decision

Use htmx for frontend interactivity. All forms use htmx attributes (`hx-post`,
`hx-target`, `hx-swap`). The server returns HTML fragments, not JSON. View
functions live in `src/views/` as template literals — no templating engine.
Inline CSS and JavaScript are injected via template strings alongside the HTML
they style.

## Consequences

- No client-side build step, no JavaScript framework dependency
- Route handlers own the full request/response cycle — no API layer to
  synchronize with a client router
- CSS is duplicated across view files (each view injects its own `<style>`
  block). This is the accepted trade-off for co-locating styles with the markup
  they affect
- View functions are pure: data in, HTML string out. Testable with snapshot
  assertions
- Immediate feedback pattern: `htmx-request` class provides instant visual
  feedback on any element that triggers an AI call
