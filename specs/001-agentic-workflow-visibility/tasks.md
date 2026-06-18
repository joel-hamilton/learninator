# Tasks: Agentic Workflow Visibility

**Input**: Design documents from `specs/001-agentic-workflow-visibility/`

**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/sse-events.md, research.md, quickstart.md

**Tests**: Tests are NOT explicitly requested in the feature specification. Test tasks below are integration tests that validate user story independence per quickstart.md scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend core infrastructure that all user stories depend on

- [x] T001 Extend EventBus in `src/ai/events.ts` with user-scoped channel: add `subscribeUser(userId, cb)` and `emitUser(userId, event)` methods alongside existing mission-scoped methods, add `WorkflowEvent` type per contracts/sse-events.md
- [x] T002 Create WorkflowStateManager in `src/ai/workflow-state.ts` with `startWorkflow()`, `stepUpdate()`, `completeWorkflow()`, `failWorkflow()`, `getActiveWorkflows(userId)`, `getWorkflow(workflowId)` per data-model.md entity spec
- [x] T003 [P] Create SSE reconnection helper in `src/shared/sse-poller.ts` — export a function `ssePollerScript()` that returns a `<script>` string with EventSource creation, exponential backoff reconnection, and a disconnection indicator DOM update
- [x] T004 [P] Add `workflowState` to AppVariables in `src/types.ts` and inject WorkflowStateManager instance via middleware in `src/index.ts` using `c.set("workflowState", workflowState)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Site-wide indicator plumbing that MUST be complete before ANY user story can display progress

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Add `GET /workflows/state` HTTP polling endpoint in `src/routes/missions.ts` — returns JSON snapshot of all active workflows for authenticated user from WorkflowStateManager
- [x] T006 Add `GET /workflows/events` SSE endpoint in `src/routes/missions.ts` — streams user-scoped workflow events via `streamSSE()` using `events.subscribeUser()`
- [x] T007 Create site-wide indicator view fragment in `src/views/fragments.ts` — function `siteWideIndicator()` returning HTML for a fixed-position banner with id `workflow-indicator`, styled per Constitution Principle III (htmx-compatible, no SPA)
- [x] T008 [P] Add site-wide indicator CSS in `src/views/shared.ts` — styles for `#workflow-indicator` (fixed position, z-index above content, visible/hidden states, spinner, error state, multiple workflow summary)
- [x] T009 Render site-wide indicator in shared chrome via `src/views/shared.ts` layout function — include `siteWideIndicator()` fragment and `ssePollerScript()` on every page
- [x] T010 [P] Remove old per-page `tool-banner` div and duplicated CSS from `src/views/mission.ts`, `src/views/lesson.ts`, `src/views/onboarding.ts` — delete `<div id="tool-banner" class="tool-banner"></div>` elements and their associated `.tool-banner` CSS blocks
- [x] T011 Remove old `toolBannerScript()` function and its call sites from `src/views/shared.ts` — replace with new site-wide indicator script

**Checkpoint**: Foundation ready — a site-wide indicator appears on every page, connects to SSE, and shows "No active workflows" when idle. Old banner code is gone.

---

## Phase 3: User Story 1 - See AI Teacher's Real-Time Actions (Priority: P1) 🎯 MVP

**Goal**: During chat, the page-local detail panel shows each tool call step in real time with student-friendly labels. The site-wide indicator shows a summary.

**Independent Test**: Start a chat, send a message that triggers tool use, observe tool steps appearing in the page-local panel and site-wide banner.

### Implementation for User Story 1

- [x] T012 [US1] Create page-local chat detail panel fragment in `src/views/fragments.ts` — function `chatProgressPanel(missionId, steps)` returning HTML for a collapsible step list showing completed/active/pending steps with student-friendly labels
- [x] T013 [US1] Render chat progress panel in `src/views/mission.ts` chat tab — include `chatProgressPanel()` below the chat messages area, initially hidden, shown when workflow events arrive
- [x] T014 [US1] Wire `conversationLoop` hooks in `src/routes/missions.ts` chat POST handler to WorkflowStateManager — on `onBeforeToolExecution` call `startWorkflow()` or `stepUpdate()`, on `onAfterToolExecution` mark step complete, on chat response done call `completeWorkflow()`
- [x] T015 [US1] Wire `conversationLoop` hooks in `src/routes/chat.ts` (standalone chat route) same as T014 — start/step/complete workflow via WorkflowStateManager
- [x] T016 [US1] Add student-friendly tool label mapping — extend `toolLabel()` pattern from `src/lessons/generator.ts` to cover ALL teacher tools (list_lessons → "Looking up previous lessons...", read_lesson → "Reviewing lesson...", etc.) in a shared location `src/ai/workflow-state.ts` as `toolDisplayLabel(name, input?)`
- [x] T017 [US1] Emit user-scoped workflow events from WorkflowStateManager — on each state change (`startWorkflow`, `stepUpdate`, `completeWorkflow`, `failWorkflow`), call `events.emitUser(userId, workflowEvent)`
- [x] T018 [US1] Add integration test in `src/test/workflow-visibility.test.ts` — verify chat tool calls produce workflow events, page-local panel renders step labels, site-wide indicator shows summary

**Checkpoint**: Chat tool steps visible in real time on the chat page and summarized in site-wide indicator. User Story 1 works independently.

---

## Phase 4: User Story 2 - Site-Wide Workflow Status Indicator (Priority: P2)

**Goal**: Site-wide indicator persists across page navigation and reloads within a session, shows all active workflows, links to detail pages, handles disconnect/reconnect.

**Independent Test**: Trigger lesson generation, navigate to different pages, verify indicator persists. Reload page, verify indicator re-renders with current state.

### Implementation for User Story 2

- [x] T019 [US2] Implement site-wide indicator DOM update logic in `src/views/shared.ts` — JavaScript function `updateWorkflowIndicator(workflows)` that renders summary (count of active workflows, type labels) or "idle" state, called by SSE event handlers
- [x] T020 [US2] Implement click-to-navigate on site-wide indicator — clicking a workflow summary in the indicator navigates to the workflow's `linkUrl` (the relevant mission/lesson page)
- [x] T021 [US2] Implement page-load catch-up in site-wide indicator script — on page load (or SSE reconnect), fetch `GET /workflows/state` and call `updateWorkflowIndicator()` with the result before subscribing to SSE
- [x] T022 [US2] Implement disconnect/reconnect UI — when SSE connection drops, show "Connection lost. Reconnecting..." in indicator; when reconnected, re-fetch state and resume updates
- [x] T023 [US2] Implement workflow completion auto-dismiss — when last active workflow completes, show "complete" state for `MIN_SHOW_MS` (800ms), then dismiss indicator
- [x] T024 [US2] Add integration tests in `src/test/workflow-visibility.test.ts` — verify indicator persists across page navigation (request different pages, assert indicator still references active workflows), verify reload recovery (fetch /workflows/state after simulated reload), verify disconnect/reconnect behavior

**Checkpoint**: Site-wide indicator works across all pages, survives navigation and reload, handles multiple workflows and disconnection. User Stories 1 AND 2 both work.

---

## Phase 5: User Story 3 - Track Lesson Generation Progress (Priority: P3)

**Goal**: Lesson generation page shows detailed progress (phase, sub-lesson count). Site-wide indicator shows generation summary.

**Independent Test**: Request lesson generation, observe progress phases and sub-lesson counts on mission page and site-wide indicator.

### Implementation for User Story 3

- [x] T025 [US3] Wire LessonGenerator.runConversation to WorkflowStateManager in `src/lessons/generator.ts` — at job start call `startWorkflow()` with type `"lesson_generation"`, in `onBeforeToolExecution` hook call `stepUpdate()`, on completion call `completeWorkflow()`, on error call `failWorkflow()`
- [x] T026 [US3] Add sub-lesson progress counting in LessonGenerator — after each `create_lesson` or `create_sub_lesson` tool execution, update workflow step detail with "Sub-lesson N of M" or increment a running count
- [x] T027 [US3] Create page-local generation progress panel fragment in `src/views/fragments.ts` — function `generationProgressPanel(jobKey, workflow)` returning HTML showing completed steps list, current phase, and sub-lesson count
- [x] T028 [US3] Render generation progress panel in `src/views/mission.ts` lesson area — include `generationProgressPanel()` that polls/generates from workflow state, replacing the current inline "Generating..." badge approach in `src/views/fragments.ts`
- [x] T029 [US3] Wire all four LessonGenerator methods (generateNext, generateSubLesson, generateRegenerate, generateBridging) to call WorkflowStateManager consistently — ensure each creates a workflow run with the correct label and linkUrl
- [x] T030 [US3] Add integration tests in `src/test/workflow-visibility.test.ts` — verify generation start/completion produces correct workflow events, verify progress message updates on each tool call, verify different generation types produce correct labels

**Checkpoint**: Lesson generation progress visible in detail on the mission page and summarized in site-wide indicator. User Stories 1, 2, AND 3 all work.

---

## Phase 6: User Story 4 - Visibility During Mission Activation (Priority: P4)

**Goal**: Mission activation steps (title generation, activation) are visible during onboarding completion.

**Independent Test**: Complete onboarding questionnaire, observe activation steps appear in page-local panel and site-wide indicator.

### Implementation for User Story 4

- [x] T031 [US4] Wire mission activation flow in `src/routes/missions.ts` onboarding completion handler to WorkflowStateManager — call `startWorkflow()` with type `"mission_activation"` before title generation, `stepUpdate()` for title generation, `stepUpdate()` for mark_mission_active, `completeWorkflow()` on success
- [x] T032 [US4] Create activation progress panel in `src/views/onboarding.ts` — replace generic loading state after final onboarding answer with a step indicator showing "Creating your mission...", "Generating title...", "Activating..."
- [x] T033 [US4] Render activation progress panel during the onboarding-to-mission transition — after final guided question answer, show the step indicator instead of a bare spinner
- [x] T034 [US4] Add integration tests in `src/test/workflow-visibility.test.ts` — verify activation flow produces workflow events, verify steps display in correct order, verify terminal state after activation completes

**Checkpoint**: All four user stories independently functional. Mission activation steps visible.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T035 [P] Audit all tool/step labels for student-friendly language (middle-school reading level, no "execute", "tool", or "API" — per FR-013) in `src/ai/workflow-state.ts` `toolDisplayLabel()` function
- [x] T036 [P] Error state polish — ensure all workflow error paths (FR-005) display the failed step name and a description in both site-wide indicator and page-local panels
- [x] T037 Run quickstart.md validation scenarios VS-1 through VS-7 manually, fix any issues found
- [x] T038 [P] Remove any remaining references to old `tool-banner` id or `toolBannerScript` across all view files and ensure no dead CSS remains

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T004) — BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational. No dependency on US2/US3/US4.
  - US2 (P2): Can start after Foundational. Builds on US1's event emission (T017) but independently testable.
  - US3 (P3): Can start after Foundational. Uses WorkflowStateManager wired in US1/T017.
  - US4 (P4): Can start after Foundational. Uses same wiring pattern.
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. Wires core event emission that US2-US4 consume.
- **User Story 2 (P2)**: Can start after Foundational. Consumes events from US1's WorkflowStateManager wiring (T017), but can be tested with manually created workflow runs before US1 is complete.
- **User Story 3 (P3)**: Can start after Foundational. LessonGenerator wiring is independent of US1 chat wiring.
- **User Story 4 (P4)**: Can start after Foundational. Activation wiring is independent of US1/US3 wiring.

### Within Each User Story

- Page-local panel fragment → render in view → wire backend → test
- Backend wiring tasks depend on WorkflowStateManager (T002)
- View tasks depend on site-wide indicator (T007–T009)

### Parallel Opportunities

- T001, T002, T003, T004 can run in parallel (different files)
- T007, T008 can run in parallel (different files)
- T010 (remove old banner) can run once new infrastructure exists
- US3 and US4 can run in parallel with each other (different files, no shared state)
- Within US1: T012 (fragment) and T016 (labels) can run in parallel
- Within US3: T027 (fragment) is independent of T025 (wiring)
- Polish: T035, T036, T038 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch independent tasks together:
Task: "Create page-local chat detail panel fragment in src/views/fragments.ts"
Task: "Add student-friendly tool label mapping in src/ai/workflow-state.ts"

# Then sequential:
Task: "Render chat progress panel in src/views/mission.ts"
Task: "Wire conversationLoop hooks in src/routes/missions.ts"
Task: "Wire conversationLoop hooks in src/routes/chat.ts"
Task: "Emit user-scoped workflow events from WorkflowStateManager"
Task: "Add integration test in src/test/workflow-visibility.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch independent tasks together:
Task: "Implement site-wide indicator DOM update logic in src/views/shared.ts"
Task: "Implement click-to-navigate on site-wide indicator"

# Then:
Task: "Implement page-load catch-up in site-wide indicator script"
Task: "Implement disconnect/reconnect UI"
Task: "Implement workflow completion auto-dismiss"
Task: "Add integration tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T011)
3. Complete Phase 3: User Story 1 (T012–T018)
4. **STOP and VALIDATE**: Chat tool steps appear in real time. Site-wide indicator shows chat summary.
5. Deploy/demo if ready — this already delivers the core value.

### Incremental Delivery

1. Setup + Foundational → site-wide indicator renders on every page, old banner gone
2. Add User Story 1 → chat tool visibility works (MVP!)
3. Add User Story 2 → indicator persists across navigation, reconnection works
4. Add User Story 3 → lesson generation progress with sub-lesson counts
5. Add User Story 4 → mission activation steps visible
6. Polish → labels audited, errors polished, quickstart validated

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (chat)
   - Developer B: User Story 2 (site-wide indicator persistence)
   - Developer C: User Story 3 + 4 (generation + activation wiring)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The old `tool-banner` id and `toolBannerScript` function must be COMPLETELY removed (T010, T011, T038) — no dead code or CSS
- Student-friendly labels per FR-013: "Looking up your progress..." not "Executing get_mission_lessons tool"
- All SSE endpoints use existing `streamSSE` from Hono — no new dependencies
- WorkflowStateManager is in-memory only — no database migration needed
