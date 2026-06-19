# Research: Chat-Based Mission Editing

## Decision: Reuse existing `read_mission_content` / `write_mission_content` tools

**Rationale**: Both tools already exist in `src/ai/teacher.ts` (lines 153-186)
and are implemented in `src/ai/tools.ts` against `MissionStore.getMissionContent`
and `upsertMissionContent`. The `mission_content` table (with `contentType =
"mission"`) already persists per-mission markdown. No new tool surface or schema
required.

**Alternatives considered**:
- *New `update_mission_goals` tool*: rejected — duplicates the existing upsert.
- *Dedicated REST endpoint for goal editing*: rejected — chat is the explicit
  UX direction per the spec.

## Decision: Remove the broken "Mission" sidebar tab outright

**Rationale**: The tab links to `/missions/:id/mission`, which has no route
handler — it 404s. `missionTabContent` exists in `src/views/mission.ts` but is
not rendered by any current route, so it can also be removed. The icon entry
for `key: "mission"` in the sidebar icon helper can be left untouched (harmless
dead branch) or pruned.

**Alternatives considered**:
- *Wire the route to render `missionTabContent` and keep the tab*: rejected —
  the spec explicitly directs us to remove the tab and use chat instead.
- *Redirect `/missions/:id/mission` → `/missions/:id/chat`*: rejected — no
  inbound links exist (the only consumer was the removed tab); a redirect would
  be defensive code with no user benefit.

## Decision: Mission-content scoping enforced via existing store calls

**Rationale**: `MissionStore.upsertMissionContent` operates on `missionId`, and
the chat route resolves `missionId` from the URL only after `getMission(id,
user.id)` returns a row for the authenticated user. Cross-user modification is
already prevented at the route layer.

**Alternatives considered**:
- *Add an explicit per-tool `userId` check*: rejected — the route guard already
  fails closed; adding redundant checks at the tool layer adds noise.

## Decision: Do not pre-seed mission content into the system prompt

**Rationale**: FR-006 calls for the AI to have access to current mission
content at chat start. The simplest path is the read tool — the AI calls
`read_mission_content` when it needs to. Pre-seeding into every system prompt
adds tokens to every turn and risks staleness when the user has just edited.

**Alternatives considered**:
- *Inject latest mission content into system prompt each turn*: rejected for
  the reasons above; the read tool covers transparency requests cleanly.
