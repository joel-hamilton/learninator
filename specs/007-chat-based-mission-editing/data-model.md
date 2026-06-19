# Data Model: Chat-Based Mission Editing

No schema changes. The existing `mission_content` table covers all storage needs.

## Existing entity: `mission_content`

Defined in `src/db/schema.ts` (line 37). One row per `(missionId, contentType)`.

| Field            | Type    | Notes                                          |
|------------------|---------|------------------------------------------------|
| `id`             | integer | PK                                             |
| `missionId`      | integer | FK → `mission.id`                              |
| `contentType`    | text    | `"mission"` for goals/statement                |
| `markdownContent`| text    | The mission goals as markdown                  |
| `createdAt`      | text    | ISO timestamp                                  |
| `updatedAt`      | text    | ISO timestamp                                  |

Reads via `MissionStore.getMissionContent(missionId, "mission")`.
Writes via `MissionStore.upsertMissionContent({ missionId, contentType: "mission", markdownContent })`.

## State transitions

The mission `status` enum (`onboarding | active | archived`) gates editing:

- **onboarding**: chat goes through the guided/free-chat onboarding system
  prompt — goal-setting via dedicated flow, not via `write_mission_content` on
  the user's behalf in normal chat.
- **active**: AI may call `write_mission_content` to update the mission goals
  on user request.
- **archived**: chat input still works, but the AI is instructed (via system
  prompt language and spec edge case) to decline goal edits; the route does not
  hard-block since the user might be asking read-only questions.

No new transitions introduced by this feature.
