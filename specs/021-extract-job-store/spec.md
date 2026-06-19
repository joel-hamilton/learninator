# Feature Specification: Extract JobStore Interface

**Feature Branch**: `021-extract-job-store`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Extract a JobStore interface from LessonGenerator's internal Map<string, InternalJob> in src/lessons/generator.ts. Currently LessonGenerator owns both lesson generation orchestration (calling AI, building prompts, running conversationLoop) and in-memory job state tracking (Map for dedup, status polling, error storage). The job state is the part that needs to vary: single-user dev wants in-memory, multi-user deploy wants persistence. Create a JobStore interface with 4 methods: getJob(key), setJob(key, job), deleteJob(key), and possibly a cleanup method. Provide InMemoryJobStore (the current Map behavior). LessonGenerator accepts JobStore in its deps. No Drizzle/SQL adapter needed yet — just the seam and the in-memory adapter. The 60-second setTimeout cleanup in runGenerationJob stays with the implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer extracts job state into replaceable interface (Priority: P1)

A developer working on the codebase wants to separate lesson generation orchestration from job state management. Currently, `LessonGenerator` has a single responsibility leakage: it both coordinates AI conversations to produce lessons and manages an internal `Map<string, InternalJob>` for deduplication, status polling, and error storage. By extracting a `JobStore` interface, the developer can cleanly separate concerns. The in-memory `Map` behavior is preserved as `InMemoryJobStore`, and `LessonGenerator` accepts the interface via its constructor deps.

**Why this priority**: This is the core change. Everything else depends on having the interface and adapter defined and wired in.

**Independent Test**: Can be tested by creating a `LessonGenerator` with an `InMemoryJobStore`, calling `generateNext()` / `generateSubLesson()` / etc., and verifying `getJobStatus()` returns the same results as the current inline `Map` behavior. All existing tests must pass without modification.

**Acceptance Scenarios**:

1. **Given** a `LessonGenerator` constructed with an `InMemoryJobStore`, **When** `generateNext()` is called for a mission, **Then** the returned job key resolves to a running status via `getJobStatus()`.
2. **Given** a job in the store with status `"done"`, **When** `getJobStatus()` is called with its key, **Then** the terminal status is returned and the job is deleted from the store.
3. **Given** a job in the store with status `"error"`, **When** `getJobStatus()` is called with its key, **Then** the error status is returned and the job is deleted from the store.
4. **Given** no job exists for a key, **When** `getJobStatus()` is called with that key, **Then** `{ status: "not_found" }` is returned.
5. **Given** the same generation method is called twice with identical parameters, **When** the dedup check runs on the second call, **Then** no duplicate job is created (the same key is returned both times).

---

### User Story 2 - Multi-user deploy uses persistent JobStore (Priority: P2)

An operator deploying the application for multiple concurrent users wants generation jobs to survive server restarts and be visible across processes. They swap `InMemoryJobStore` for a persistent implementation backed by SQLite (not yet built — this story defines the seam, not the implementation). The `LessonGenerator` continues to work identically because it only depends on the `JobStore` interface.

**Why this priority**: The interface is designed to enable this use case, but the persistent adapter is out of scope for this feature. This story validates that the interface is sufficient for a persistent adapter without requiring one to be built.

**Independent Test**: Can be tested by implementing a minimal fake that stores jobs in an array and verifying `LessonGenerator` behavior is identical with any `JobStore` implementation. This proves the interface is a complete abstraction boundary.

**Acceptance Scenarios**:

1. **Given** a `LessonGenerator` with any `JobStore` implementation that correctly implements the interface, **When** generation methods are called, **Then** poll/status behavior matches the in-memory implementation.
2. **Given** a `JobStore` that persists data externally, **When** the server restarts mid-generation, **Then** (future) the operator can recover job state via the persistent store.

---

### Edge Cases

- What happens when `getJob()` returns `undefined` for a key? The `getJobStatus()` method should return `{ status: "not_found" }` — same as current behavior.
- What happens if `setJob()` is called with the same key twice before `deleteJob()`? The second call should overwrite the first (same as `Map.set` behavior).
- What happens if `deleteJob()` is called for a key that does not exist? The operation should be a no-op (same as `Map.delete` for a missing key).
- How does the 60-second setTimeout interact with `deleteJob()`? The deferred cleanup must not throw if the job was already deleted by `getJobStatus()`. `Map.delete` on a missing key is a no-op, so this is safe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define a `JobStore` interface with at least four methods: `getJob(key)`, `setJob(key, job)`, `deleteJob(key)`, and a cleanup/utility method if needed.
- **FR-002**: The system MUST provide an `InMemoryJobStore` class that implements `JobStore` using an internal `Map<string, InternalJob>`, preserving the current deduplication, status polling, and error storage behavior.
- **FR-003**: `LessonGenerator` MUST accept a `JobStore` instance through its constructor/deps (replacing the directly-owned `Map<string, InternalJob>`).
- **FR-004**: The `InternalJob` type MUST be exported (or moved to a shared location) so that `JobStore` implementations can reference it.
- **FR-005**: The `buildJobKey()` function and `JobStatus` type MUST remain accessible to consumers of `LessonGenerator` (they are already exported — this must not regress).
- **FR-006**: The 60-second `setTimeout` cleanup in `runGenerationJob()` MUST remain in `LessonGenerator`; it is a lifecycle concern, not a storage concern.
- **FR-007**: All existing tests (unit and integration) MUST continue to pass without modification after the extraction.

### Key Entities *(include if feature involves data)*

- **JobStore**: An interface that abstracts read/write/delete operations on generation job records. Implementations can be in-memory or persistent.
- **InternalJob**: The data record for a single generation job, containing status, progress messages, result metadata, and error information.
- **InMemoryJobStore**: A concrete `JobStore` implementation backed by a `Map<string, InternalJob>`. Provides the same semantics as the current inline `Map`.
- **LessonGenerator**: The lesson generation orchestrator. After extraction, it references `JobStore` through its interface and delegates all job storage operations to the injected instance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `LessonGenerator` class no longer directly owns a `Map<string, InternalJob>`. All job state access goes through the `JobStore` interface.
- **SC-002**: A developer can instantiate `LessonGenerator` with a custom `JobStore` implementation by passing it through the deps parameter — no internal refactoring required.
- **SC-003**: All existing tests pass with zero modifications. The `createLessonGenerator()` factory updates transparently.
- **SC-004**: The `buildJobKey()` function and `JobStatus` type remain exported and unchanged in signature.
- **SC-005**: An `InMemoryJobStore` can be instantiated and used independently of `LessonGenerator` (e.g., for testing other components that need job state).

## Assumptions

- The `JobStore` interface lives alongside `LessonGenerator` in `src/lessons/` (either in `generator.ts` or a new sibling file like `job-store.ts`).
- Only one `JobStore` implementation (`InMemoryJobStore`) is created in this feature. Persistent (SQL-backed) adapters are explicitly deferred.
- The `InternalJob` type becomes exported but its shape does not change — it keeps the same fields as today (`status`, `messages`, `result`, `error`).
- The `LessonGenerator` constructor signature may change to accept `JobStore` via its `GeneratorDeps` (adding a `jobStore` field), but the `createLessonGenerator()` factory function handles this transparently.
- The `getJobStatus()` method's behavior of deleting the job on terminal status consumption is preserved — this is an `LessonGenerator` concern, not a `JobStore` concern. The `JobStore` interface provides a raw `deleteJob(key)` that `LessonGenerator` calls at the appropriate time.
- No new third-party dependencies are introduced.
