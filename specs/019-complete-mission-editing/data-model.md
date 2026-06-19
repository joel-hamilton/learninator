# Data Model: Complete Mission Editing Coverage

**Feature**: 019-complete-mission-editing
**Date**: 2026-06-18

No new entities, tables, or columns. This feature operates entirely on the existing
`mission_content` table and `missions` table.

## Existing Entities Used

### mission_content (table, already exists)

| Column | Type | Purpose |
|--------|------|---------|
| id | integer (PK, autoIncrement) | Row ID |
| missionId | integer (FK → missions.id) | Scoped to a single mission |
| contentType | text | `"mission"`, `"notes"`, `"resources"`, or `"glossary"` |
| markdownContent | text | The stored markdown |
| createdAt | text | ISO timestamp |
| updatedAt | text | ISO timestamp |

**Access pattern**: `store.getMissionContent(missionId, contentType)` and
`store.upsertMissionContent(missionId, contentType, markdownContent)`. Both are
scoped to the authenticated user via the mission's `userId`.

### missions (table, already exists)

| Column | Type | Purpose |
|--------|------|---------|
| id | integer (PK, autoIncrement) | Row ID |
| userId | integer (FK → users.id) | Owner |
| status | text | `"onboarding"`, `"active"`, or `"archived"` |

**State gating**: Mission content editing via chat is only allowed for `"active"`
missions. The system prompt or tool handler gates this check.
