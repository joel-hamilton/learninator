# Feature Specification: Extract Inline JavaScript

**Feature Branch**: `017-extract-inline-javascript`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Extract Inline JavaScript — ~500+ lines of JavaScript live inside TypeScript template strings across the view layer. None of this code can be type-checked, linted, or tested. A syntax error in a template string is a runtime bug."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - SSE Reconnection Client as a Standalone Static Asset (Priority: P1)

As a developer working on the workflow indicator system, I want the SSE reconnection logic to live in a standalone `public/sse-poller.js` file served as a static asset, so that I can run unit tests against its reconnection behavior (exponential backoff, reconnection states, DOM rendering) and have it linted and type-checked by standard tooling.

**Why this priority**: The SSE reconnection logic is the most complex client-side code in the application — exponential backoff with configurable max retry, connection-state management, concurrent workflow tracking, DOM rendering with escaping, and state reconciliation on reconnect. A bug here silently breaks the workflow indicator for all users. Extracting it first also validates the static-asset serving pipeline.

**Independent Test**: Can be fully tested by serving `public/sse-poller.js` from the dev server and verifying that `workflow_start`, `workflow_step`, `workflow_complete`, and `workflow_error` events are processed correctly and the indicator DOM is updated. The module's side-effect-free functions (e.g., `esc()`, `render()`) can be unit tested in isolation.

**Acceptance Scenarios**:

1. **Given** the application is running with `public/sse-poller.js` as a static asset, **When** a page includes `<script src="/sse-poller.js">`, **Then** the workflow indicator initializes, connects to `/workflows/events` via EventSource, and renders any existing workflows from the `/workflows/state` endpoint.
2. **Given** the SSE connection drops, **When** the `error` event fires on the EventSource, **Then** the indicator shows a "disconnected" state with exponential backoff reconnection (starting at 1s, doubling to a max of 30s), and reconnects without duplicating workflows.
3. **Given** the connection restores after a disconnect, **When** the `open` event fires, **Then** the retry timer resets to 1s, the disconnected state is cleared, and a fetch to `/workflows/state` reconciles any missed events.

---

### User Story 2 - Optimistic Chat and Enter-to-Submit as an htmx Extension (Priority: P1)

As a developer working on chat interactions, I want the optimistic-chat UI (immediate message rendering, thinking dots, Enter-to-submit) moved into `public/htmx-extensions.js` as a proper htmx extension, so that these behaviors are reusable across all chat forms (mission chat, onboarding chat, lesson chat panel) without duplicating inline script tags, and so that syntax errors in this code surface at lint/type-check time rather than at runtime.

**Why this priority**: This ~150-line block runs on every chat-equipped page and is the most-triggered client-side code path (every message send). Being embedded in a template string, a single syntax error here crashes the chat UI on every page. Extracting it as a reusable module eliminates the duplication between `onboardingLayout`, `emptyLessonsMessage`, `missionTabContent`, and `lessonPage` that all currently redeclare the same `hx-on::before-request="optimisticChat(this)"` attributes.

**Independent Test**: Can be tested by loading any chat page (mission chat, onboarding, or lesson panel) and verifying that submitting a message shows an optimistic bubble immediately, the Enter key submits (not just a button click), the thinking indicator appears, and the thinking bubble is removed on htmx response.

**Acceptance Scenarios**:

1. **Given** a chat page loads `htmx-extensions.js`, **When** the user types a message and presses Enter, **Then** the message appears as an optimistic user bubble immediately, a thinking-dots bubble appears, the textarea clears, the submit button is disabled for 2 seconds, and the Enter key does not double-submit.
2. **Given** the htmx response arrives, **When** the `htmx:afterRequest` event fires, **Then** the thinking-dots bubble is removed from the chat container.
3. **Given** the user presses Shift+Enter, **When** the keydown event fires in the textarea, **Then** a newline is inserted into the textarea and the form is NOT submitted.

---

### User Story 3 - Guided Question Helpers Extracted to htmx Extension (Priority: P2)

As a developer working on the onboarding flow, I want the guided-question helper functions (option selection, "other" input toggle, answer validation, followup messages) extracted into `public/htmx-extensions.js`, so that the duplicated copy in `GUIDED_QUESTION_SCRIPT` is eliminated and all guided-question logic lives in one type-checkable, lintable location.

**Why this priority**: The guided-question functions are currently duplicated verbatim in `HTMX_HEAD` (~50 lines) and in `GUIDED_QUESTION_SCRIPT` (~43 lines). Any fix must be applied in two places and the code is invisible to tooling. Extraction eliminates this maintenance hazard.

**Independent Test**: Can be tested by starting a guided onboarding session, selecting options, verifying the "other" input appears for the last option, submitting an answer, and seeing the thinking state replace the question card.

**Acceptance Scenarios**:

1. **Given** a guided onboarding page, **When** the user clicks an option row, **Then** the radio button is checked, the row is highlighted, the submit button is enabled, and if the last option is selected a free-text input appears.
2. **Given** the user types in the "other" text input, **When** they submit, **Then** the hidden field contains the typed value.
3. **Given** the user submits an answer with "other" selected but empty, **When** `submitGuidedAnswer` is called, **Then** the submission is prevented and the other text input receives focus.

---

### User Story 4 - Browse Page Client Logic as a Standalone Static Asset (Priority: P2)

As a developer working on the browse/explore feature, I want the browse-page JavaScript (skeleton card injection on form submit, "Something Else" custom input expansion) extracted into `public/sse-poller.js` (appended to the same file) or a dedicated `public/browse.js`, so that the ~35 lines of client-side logic are lintable and disconnected from the template string that generated them.

**Why this priority**: The browse page skeleton-injection logic runs on every topic drill-down. A syntax error in the template_string renders the entire browse flow non-functional. Extraction is straightforward and low-risk.

**Independent Test**: Can be tested by loading the browse page, clicking a topic card, verifying that skeleton cards appear immediately while the AI response loads, and clicking "Something Else" expands an inline text input.

**Acceptance Scenarios**:

1. **Given** the browse page loads, **When** the user clicks a topic card, **Then** the card dims immediately and the options grid is replaced with skeleton placeholder cards.
2. **Given** the browse page shows option cards, **When** the user clicks the "Something Else" card, **Then** the card expands to show a text input and the Enter key submits the custom value.

---

### User Story 5 - Small Inline UI Behaviors Remain Inline or Migrate (Priority: P3)

As a developer maintaining the application, I want small, page-specific UI behaviors (sidebar toggle with localStorage, lesson FAB chat panel toggle, iframe resize listener, mode-select toggle on the new-mission page) to either remain inline in their template strings or be extracted only if they exceed a complexity threshold (more than 15 lines or contain stateful logic).

**Why this priority**: These snippets (10-25 lines each) are easily understood in context. Extracting them adds indirection without proportional benefit. The priority is to establish the pattern for new JS files and remove the large, risky blocks first.

**Independent Test**: This story is about the decision boundary rather than an independently testable feature. Each snippet should continue to work exactly as before — the sidebar persists collapse across navigation, the FAB opens/closes the chat panel, the iframe resizes to content height, and the mode selector toggles.

**Acceptance Scenarios**:

1. **Given** the mission layout page loads, **When** the user clicks the sidebar toggle, **Then** the sidebar collapses, the toggle button moves to the left edge, and the collapse state persists across page navigations via localStorage.
2. **Given** a lesson page loads, **When** the user clicks the FAB, **Then** the chat panel opens and the FAB disappears; clicking close hides the panel and shows the FAB again.
3. **Given** the new-mission page loads, **When** the user clicks "Chat Setup", **Then** the mode-input hidden field updates and the selected styling changes.

---

### Edge Cases

- What happens when the `public/` directory is missing? The static-asset server middleware MUST return a 404 for missing files, not crash.
- What happens when `sse-poller.js` fails to load (network error, 404)? The site-wide workflow indicator degrades gracefully — it simply never activates, which is the same as the current behavior before the first page load.
- How does the `htmx-extensions.js` file interact with htmx 2.x? The file must define standard htmx extensions using `htmx.defineExtension()`, not override core behavior.
- How do inline event handlers (e.g., `onclick="toggleUserMenu(this)"`, `oninput="autoResize(this)"`) reference functions defined in external files? Functions must be attached to `window` explicitly (as they are currently via function declarations in script tags).
- What if two different pages include the same external JS file twice? The static server should cache the file and the browser should cache it; scripts must be idempotent (no duplicate event listener registration).
- How does the `sse-poller.js` script avoid double-initialization when included on pages that also inline related state? The script already guards with `if (!indicator) return;` — this guard remains.
- What about the inline script injected into lesson iframe `srcdoc` for ResizeObserver? This script runs inside a sandboxed iframe with a different origin, so it cannot be extracted to the parent page's static files. It MUST remain inline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST serve static files from the `public/` directory via a Hono static file middleware, with the path prefix `/` (so `/sse-poller.js` maps to `public/sse-poller.js`).
- **FR-002**: The SSE reconnection logic in `src/shared/sse-poller.ts` MUST be replaced: the `ssePollerScript()` function must produce a `<script src="/sse-poller.js">` tag instead of an inline `<script>` block.
- **FR-003**: The `public/sse-poller.js` file MUST implement all existing SSE behavior: EventSource connection to `/workflows/events`, exponential backoff reconnection (1s initial, 30s max), workflow state rendering in `#workflow-indicator`, disconnect/reconnect UI, and state reconciliation on reconnect via `/workflows/state`.
- **FR-004**: The optimistic-chat functions (`optimisticChat`, `autoResize`, Enter-to-submit keydown handler, `htmx:afterRequest` cleanup) and guided-question helpers (`selectOption`, `onOptionChange`, `onOtherInput`, `validateAnswer`, `submitGuidedAnswer`, `addFollowupMessage`, `cleanupThinking`) MUST be extracted into `public/htmx-extensions.js` as one or more htmx extensions.
- **FR-005**: The `HTMX_HEAD` template in `src/views/shared.ts` MUST load `htmx-extensions.js` via `<script src="/htmx-extensions.js">` and remove all extracted function declarations from the inline `<script>` block, keeping only CSS and non-extracted inline behaviors (user menu toggle, modal overlay click-to-close, non-extracted page-specific handlers).
- **FR-006**: The `GUIDED_QUESTION_SCRIPT` export in `src/views/shared.ts` MUST be removed and all consumers updated to rely on `htmx-extensions.js` instead.
- **FR-007**: The browse-page skeleton-injection and `expandCustomInput` logic in `src/views/browse.ts` MUST be extracted into a `public/htmx-extensions.js` extension or a dedicated `public/browse.js` file.
- **FR-008**: The sidebar toggle JavaScript in `src/views/mission.ts` (localStorage persistence, collapse/expand) MAY remain inline due to its small size and page-specific nature.
- **FR-009**: The lesson-page chat panel, FAB toggle, and iframe resize logic in `src/views/lesson.ts` MAY remain inline due to their page-specific nature.
- **FR-010**: The lesson iframe ResizeObserver script injected into the `srcdoc` attribute MUST remain inline (it runs inside a sandboxed iframe and cannot reference parent-page static assets).
- **FR-011**: The `public/` directory MUST be added to version control with at least placeholder files. A note in CLAUDE.md should instruct developers to place new client-side JS there.
- **FR-012**: All extracted JS files MUST be idempotent — they must not produce errors if loaded multiple times on the same page (e.g., from htmx swaps that replace the head).
- **FR-013**: The existing `generationProgressPanel`, `activationProgressPanel`, and `emptyLessonsMessage` inline `setInterval` polling scripts in `src/views/fragments.ts` MAY remain inline if they are short (under 25 lines) and page-specific, but SHOULD be considered for future extraction if they grow.

### Key Entities *(include if feature involves data)*

- **SSE Poller (`public/sse-poller.js`)**: Standalone JavaScript module managing an EventSource connection to `/workflows/events` with exponential backoff reconnection. Initializes automatically on page load. Renders workflow state into `#workflow-indicator`. No build step — plain ES5-compatible JavaScript.
- **htmx Extension (`public/htmx-extensions.js`)**: JavaScript file registering one or more htmx 2.x extensions via `htmx.defineExtension()`. Provides `optimistic-chat` extension (optimistic message rendering, Enter-to-submit, auto-resize) and guided-question helper functions (option selection, validation). No build step.
- **Static File Middleware**: Hono middleware that serves files from the `public/` directory. Must not interfere with existing route handlers (e.g., must only serve files that physically exist).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero inline JavaScript exceeding 25 lines remains in any `src/views/*.ts` template string. All non-trivial client-side behavior lives in `.js` files under `public/`.
- **SC-002**: The `sse-poller.js` file is loadable and functional when served as a static asset — the workflow indicator connects, reconnects with exponential backoff, and renders workflow state identically to the current inline implementation.
- **SC-003**: The `htmx-extensions.js` file registers at least one working htmx extension that is referenced via `hx-ext` attributes in page templates, replacing the current `hx-on::before-request` and `hx-on::after-request` inline handlers for chat forms.
- **SC-004**: All chat pages (mission chat, onboarding chat, lesson chat panel) continue to show optimistic message bubbles, auto-resize textareas, and submit on Enter — verified by manual testing on each page type.
- **SC-005**: All existing tests pass without modification. No chat, onboarding, lesson, or browse test requires changes due to JS extraction.
- **SC-006**: A syntax error introduced into any extracted `.js` file is caught by linter or TypeScript (if checked as a `.ts` file and compiled) rather than manifesting as a runtime bug in the browser.

## Assumptions

- The `public/` directory will be served by Hono's `serveStatic()` middleware (from `@hono/node-server` or `hono/serve-static`) with the default path mapping.
- The `sse-poller.js` and `htmx-extensions.js` files will be written in plain JavaScript (ES5-compatible), not TypeScript, because they are served directly to the browser without a build step. TypeScript type-checking can be applied by creating corresponding `.ts` source files that compile to the `public/` directory, but this is a nice-to-have, not required.
- htmx 2.x extension API (`htmx.defineExtension()`) is available at runtime. The extensions will be defined defensively (checking for `htmx` on `window`).
- The feature branch will be created from `main` and merged back via a pull request. The existing spec-driven workflow (spec clarification, planning, implementation tasks) will be followed.
- The existing inline JS for page-specific behaviors (sidebar toggle, FAB chat toggle, iframe resize listener, mode-select toggle, fragment polling scripts) can remain inline as they are under 25 lines, well-understood in context, and unlikely to benefit from extraction. This decision can be revisited if any of these snippets grows or causes bugs.
- The CSS embedded in template strings (design tokens, layout styles, component styles) is out of scope. This spec addresses JavaScript extraction only.
- The iframe ResizeObserver script injected into the lesson `srcdoc` attribute runs in a sandboxed iframe context, so it MUST remain inline. This is a hard technical constraint.
