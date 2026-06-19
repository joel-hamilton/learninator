# Data Model: Fix Archive UI

**Feature**: 009-fix-archive-ui
**Date**: 2026-06-18

## Entities

### Mission (existing — no changes)

The `missions` table already supports the `archived` status. No schema migration is needed.

| Attribute | Type | Notes |
|-----------|------|-------|
| id | integer (PK) | Auto-increment |
| userId | integer (FK → users) | Owner |
| title | text | Mission title |
| status | text | `"onboarding"` \| `"active"` \| `"archived"` |
| createdAt | text (ISO 8601) | |
| updatedAt | text (ISO 8601) | Updated on status change |

### Status State Machine

```
┌────────────┐     ┌──────────┐     ┌──────────┐
│ onboarding │ ──► │  active  │ ──► │ archived │
└────────────┘     └──────────┘     └──────────┘
                         ▲                │
                         │                │
                         │   restore      │  delete
                         └────────────────┘  (terminal)
```

### Archived Section (DOM entity — not persisted)

The archived section is a DOM container rendered on the home page. It is not a database concept.

| Attribute | Type | Notes |
|-----------|------|-------|
| visible | boolean | Whether any archived missions exist |
| count | number | Number of archived missions |
| expanded | boolean | Whether the `<details>` element is open (not persisted across page loads) |
| cards | HTML fragment[] | Rendered mission cards in archived state |

## Validation Rules

- Archive: mission must exist, belong to current user, and have status != "archived"
- Restore: mission must exist, belong to current user, and have status == "archived"
- Delete: mission must exist, belong to current user, and have status == "archived"

No new validation rules — these already exist in the route handlers.

## Relationships

- Mission belongs to User (FK `userId`)
- Mission has many Lessons, ChatMessages, ReferenceDocs (cascade deleted on mission delete)
- No new relationships introduced
