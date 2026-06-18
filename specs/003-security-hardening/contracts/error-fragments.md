# Contracts: htmx Error Fragments

## Overview

All security-related error responses are HTML fragments compatible with htmx's swap model. No JSON error responses. Each fragment is styled to match the existing UI pattern used in `src/routes/chat.ts` error handling.

## Input Too Long Error

**Contract**: When a user-submitted input exceeds the configured character limit.

**Response**: HTML fragment replacing the standard response target.

```text
Status: 200 OK (htmx swaps content, not status-based)
Content-Type: text/html
```

**Fragment format** (chat/answer contexts):
```html
<div class="msg assistant" style="color:var(--danger);">
  Your message is too long (12,345 characters). Please shorten it to under 10,000 characters.
</div>
```

**Fragment format** (title rename context):
```html
<span style="color:var(--danger);">Title must be 200 characters or fewer.</span>
```

**Fragment format** (mission creation context):
```html
<div class="msg assistant" style="color:var(--danger);">
  That topic is a bit long — please keep it under 200 characters.
</div>
```

**Fragment format** (feedback context):
```html
<div class="msg assistant" style="color:var(--danger);">
  Feedback text must be under 2,000 characters.
</div>
```

## Rate Limited Error

**Contract**: When a user exceeds the per-category sliding window limit.

**Response**: HTML fragment, same pattern as input-too-long.

```text
Status: 200 OK
Content-Type: text/html
```

**Fragment format**:
```html
<div class="msg assistant" style="color:var(--danger);">
  You're sending messages too quickly. Please wait a moment before sending another.
</div>
```

## Client Expectations

- All fragments use `style="color:var(--danger);"` to render in the app's danger color
- All fragments use the `msg assistant` CSS class for consistent chat-bubble styling (where applicable)
- No `HX-Retarget` header — fragments replace the normal swap target
- Status 200 (not 4xx) so htmx processes the response normally without triggering error handlers
