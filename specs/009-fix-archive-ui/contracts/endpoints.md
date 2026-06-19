# Contracts: Fix Archive UI

**Feature**: 009-fix-archive-ui
**Date**: 2026-06-18

## Modified Endpoints

### POST /missions/:missionId/archive

Archives an active or onboarding mission.

**Request**: `POST /missions/123/archive`
- Auth: Required (session cookie)
- Body: None

**Success Response (200)**: HTML with out-of-band swaps

```html
<!-- Element 1: Replaces the clicked card (empty = remove) -->

<!-- Element 2: Out-of-band swap to update archived section -->
<div id="archived-section" hx-swap-oob="innerHTML:#archived-section">
  <details class="archived-section">
    <summary>
      <span class="chevron">▼</span>
      <span class="section-label">Archived (1)</span>
    </summary>
    <div class="mission-list stagger">
      <div class="mission-card mission-card--archived" ...>
        <!-- archived card HTML -->
      </div>
    </div>
  </details>
</div>
```

**Error Responses**:
- `404 Not Found` — Mission doesn't exist or doesn't belong to user (text/plain)
- `400 Bad Request` — Mission already archived (text/plain)

**HTMX Behavior**: On 4xx, HTMX does not swap content, so the card remains visible.

---

### POST /missions/:missionId/restore

Restores an archived mission back to active.

**Request**: `POST /missions/123/restore`
- Auth: Required (session cookie)
- Body: None

**Success Response (200)**: HTML with out-of-band swaps

```html
<!-- Element 1: Replaces the clicked card (empty = remove) -->

<!-- Element 2: OOB swap to update active section -->
<div id="active-section" hx-swap-oob="innerHTML:#active-section">
  <div class="section-label">Missions</div>
  <div class="mission-list stagger">
    <!-- all active cards including restored one -->
  </div>
</div>

<!-- Element 3: OOB swap to update archived section (may be empty) -->
<div id="archived-section" hx-swap-oob="innerHTML:#archived-section">
  <!-- updated archived section, or empty if this was the last one -->
</div>
```

**Error Responses**:
- `404 Not Found` — Mission doesn't exist or doesn't belong to user
- `400 Bad Request` — Mission not currently archived

---

### POST /missions/:missionId/delete

Permanently deletes an archived mission.

**Request**: `POST /missions/123/delete`
- Auth: Required (session cookie)
- Body: None

**Success Response (200)**: HTML with out-of-band swaps

```html
<!-- Element 1: Replaces the clicked card (empty = remove) -->

<!-- Element 2: OOB swap to update archived section -->
<div id="archived-section" hx-swap-oob="innerHTML:#archived-section">
  <!-- updated archived section without the deleted card, or empty if last -->
</div>
```

**Error Responses**:
- `404 Not Found` — Mission doesn't exist or doesn't belong to user
- `400 Bad Request` — Mission must be archived before delete

---

## DOM Contract (Home Page Structure)

The home page renders these persistent containers:

```html
<div class="container">
  <!-- welcome, add-new -->

  <div id="active-section">
    <div class="section-label">Missions</div>
    <div class="mission-list stagger">
      <!-- active mission cards -->
    </div>
  </div>

  <div id="archived-section">
    <!-- Empty if no archived missions -->
    <!-- Otherwise: -->
    <details class="archived-section">
      <summary>
        <span class="chevron">▼</span>
        <span class="section-label">Archived (N)</span>
      </summary>
      <div class="mission-list stagger">
        <!-- archived mission cards -->
      </div>
    </details>
  </div>
</div>
```

**Constraints**:
- `#active-section` and `#archived-section` must always be present (even when empty) so OOB swaps always find their target.
- OOB swap uses `innerHTML` (not `outerHTML`) to preserve the container IDs.
- The `<details>` element is always rendered (wrapping the archived list) so the expand/collapse toggle is always consistent.
