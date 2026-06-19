# AI Tool Contract

This feature exposes no new HTTP endpoints. The user-facing "contract" is the
set of AI tools the teacher can invoke during chat. Both tools already exist in
`src/ai/teacher.ts` — this document records them as the contract this feature
relies on.

## `read_mission_content`

**Purpose**: Let the AI read a mission content document (mission goals, notes,
resources, or glossary).

**Inputs**:
- `content_type`: one of `"mission" | "notes" | "resources" | "glossary"`.

**Behavior**: Returns the markdown content for the requested document for the
current mission. Empty string if no content exists yet.

**Scoping**: Implementation receives `missionId` from the conversation context,
which the route only sets after verifying `getMission(missionId, user.id)`.

## `write_mission_content`

**Purpose**: Let the AI create or update a mission content document on behalf
of the user.

**Inputs**:
- `content_type`: one of `"mission" | "notes" | "resources" | "glossary"`.
- `markdown_content`: full markdown to upsert.

**Behavior**: Upserts the row in `mission_content` for `(missionId,
content_type)`. Survives reloads and new sessions (FR-005).

**Scoping**: Same as the read tool — `missionId` comes from the route context.

## When the AI is expected to use these tools

- User asks "what are my mission goals?" → `read_mission_content("mission")`.
- User asks to change/refine the mission → `write_mission_content("mission",
  <updated markdown>)`, then confirm in the chat reply (FR-004).
- For archived missions, the AI declines goal edits per the system prompt /
  spec edge case.
