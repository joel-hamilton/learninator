# Feature Specification: Atomic Mission Content Upsert

**Feature Branch**: `022-atomic-content-upsert`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Fix upsertMissionContent race condition with atomic upsert"

## User Scenarios & Testing

### User Story 1 - Prevent duplicate content rows on concurrent access (Priority: P1)

When a mission is activated, multiple background processes may attempt to upsert mission content (mission overview, notes, resources, glossary) concurrently. Currently, the system checks for an existing row before inserting, and a concurrent insert between the check and the insert creates a duplicate row.

**Why this priority**: Data integrity is foundational. Duplicate rows in the mission_content table cause unpredictable behavior in mission tabs and content views, potentially showing duplicate tabs, conflicting content, or errors when retrieving content by type.

**Independent Test**: Can be verified by a test that sends concurrent upsert requests for the same (missionId, contentType) pair. With the fix, only one row exists after all requests complete regardless of ordering. Previously, duplicate rows would appear.

**Acceptance Scenarios**:

1. **Given** a mission exists with no mission_content rows, **When** two concurrent `upsertMissionContent` calls target the same (missionId, contentType) pair, **Then** only one row exists in the mission_content table for that pair.
2. **Given** a mission_content row exists for a given (missionId, contentType) pair, **When** `upsertMissionContent` is called with the same pair but different content, **Then** the existing row is updated and no new row is created.
3. **Given** a mission_content row exists for a given (missionId, contentType) pair, **When** `upsertMissionContent` is called with the same pair and same content, **Then** the existing row is updated (idempotent).

---

### User Story 2 - Schema constraint enforces data integrity at database level (Priority: P1)

No application-level locking or coordination is needed to prevent duplicate mission_content rows. The database schema enforces a unique constraint on (missionId, contentType), making the invariant a physical guarantee rather than a convention.

**Why this priority**: A schema constraint is the definitive prevention mechanism. Even if another code path inserts into mission_content directly (bypassing the store method), the unique constraint still prevents duplicates. This is defense in depth.

**Independent Test**: Can be tested by attempting to INSERT a duplicate (missionId, contentType) pair directly via SQL and verifying the database rejects it with a constraint violation error.

**Acceptance Scenarios**:

1. **Given** a mission_content row exists with (missionId=1, contentType="mission"), **When** a raw SQL INSERT attempts to insert (missionId=1, contentType="mission"), **Then** the database returns a constraint violation error.
2. **Given** the unique constraint exists, **When** existing tests for `upsertMissionContent` run, **Then** they continue to pass without modification (behavior-preserving change).

---

### Edge Cases

- What happens when `upsertMissionContent` is called with a missionId that does not exist in the missions table? (Existing foreign key constraint should handle this, and the behavior should remain unchanged.)
- What happens during the migration on a database that already has duplicate rows? (The migration may fail when applying the unique index. A cleanup strategy must be defined.)
- What happens when content exceeds expected length? (Existing column type handles this; no change needed.)

## Requirements

### Functional Requirements

- **FR-001**: The system MUST enforce a unique constraint on the (missionId, contentType) pair in the mission_content table at the database level.
- **FR-002**: The store method `upsertMissionContent` MUST use an atomic upsert operation (INSERT OR REPLACE, or INSERT with conflict handling) instead of the current select-then-insert pattern.
- **FR-003**: The atomic upsert MUST behave the same as the current method for single-call scenarios: it inserts a new row when none exists and updates the existing row when one does.
- **FR-004**: The migration MUST handle existing databases gracefully — any pre-existing duplicate rows must be resolved (e.g., deduplicated keeping the latest row) before the unique index is applied, OR the migration must fail explicitly so an operator can intervene.
- **FR-005**: The existing public interface of `DrizzleMissionStore.upsertMissionContent` MUST remain unchanged (same method signature, same return type).
- **FR-006**: All existing tests MUST pass without modification after the change.

### Key Entities

- **mission_content**: A table storing singular documents per mission — one row each for mission overview, notes, resources, and glossary. Each row is uniquely identified by the combination of missionId and contentType. The table already has an auto-increment primary key `id`; the new unique constraint on (missionId, contentType) ensures no two rows share the same mission and content type.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Concurrent calls to `upsertMissionContent` with the same (missionId, contentType) always result in exactly one row — verified by a test that fires N concurrent requests and asserts a single row.
- **SC-002**: The existing test suite passes with no modifications — verifying the change is behavior-preserving for sequential access patterns.
- **SC-003**: A direct SQL INSERT of a duplicate (missionId, contentType) pair is rejected by the database with a constraint violation error — confirming the schema-level enforcement works independently of application code.

## Assumptions

- The existing `mission_content` table may already contain duplicate rows in certain databases (e.g., development or staging environments where the race condition was triggered). The migration strategy must either deduplicate or explicitly fail to avoid data loss.
- The `upsertMissionContent` method is the only code path that writes to the mission_content table. Adding a unique constraint is safe because no legitimate workflow requires duplicate (missionId, contentType) rows.
- The foreign key from mission_content.missionId to missions.id is already in place and will remain unchanged.
- The supported content types are the four existing enum values: "mission", "notes", "resources", "glossary". No new content types are being added as part of this change.
