# Data Model: Server Observability

**Feature**: Server Observability | **Date**: 2026-06-18

## Overview

No database changes. All observability data is ephemeral and in-memory. Two structures define the data shape.

## Entities

### RequestTiming (ephemeral, per-request)

Captures timing for a single HTTP request lifecycle. Stored only on the Hono context during request processing, never persisted.

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` (8 chars) | Unique identifier from `crypto.randomUUID().slice(0, 8)` |
| `method` | `string` | HTTP method (GET, POST, etc.) |
| `path` | `string` | Request path (e.g., `/missions/42/chat`) |
| `routePattern` | `string` | Hono route pattern (e.g., `/missions/:missionId/chat`) |
| `startTime` | `bigint` | `process.hrtime.bigint()` at request arrival |
| `phases` | `{ [phase: string]: PhaseTiming }` | Map of phase name to timing data |

**PhaseTiming**:
| Field | Type | Description |
|-------|------|-------------|
| `startMs` | `number` | Elapsed ms from request start when phase began |
| `durationMs` | `number` | Phase duration in ms |
| `meta` | `Record<string, unknown>` | Optional metadata (e.g., middleware name) |

**Lifecycle**: Created by debug middleware on request arrival. Phases are appended as the request progresses. Logged to stdout when the response is fully written. Discarded after logging.

### EndpointProfile (in-memory, cumulative)

Accumulated statistics for one route pattern across all requests since server start.

| Field | Type | Description |
|-------|------|-------------|
| `routePattern` | `string` | Key — e.g., `GET:/missions/:missionId` |
| `count` | `number` | Total requests to this endpoint |
| `totalMs` | `number` | Sum of all response durations |
| `minMs` | `number` | Fastest response |
| `maxMs` | `number` | Slowest response |
| `recentSlow` | `SlowRequest[]` | Last N slowest requests (ring buffer, max 10) |

**SlowRequest**:
| Field | Type | Description |
|-------|------|-------------|
| `url` | `string` | Exact request URL |
| `durationMs` | `number` | Total request duration |
| `timestamp` | `number` | `Date.now()` when request completed |

**Lifecycle**: Created on first request to a route. Updated on each subsequent request. Evicted when the profile store exceeds 500 entries (least-frequent entries removed). Destroyed on server shutdown (with optional final summary printed to stdout).

### ProfileStore (container)

| Field | Type | Description |
|-------|------|-------------|
| `entries` | `Map<string, EndpointProfile>` | Route pattern → stats |
| `maxEntries` | `number` | Hard cap at 500 |
| `enabled` | `boolean` | True when PROFILE env is truthy |

## State Transitions

### RequestTiming lifecycle

```
[Request arrives]
  → create RequestTiming { requestId, startTime, phases: {} }
  → add phase "request-received" { startMs: 0, durationMs: 0 }
  → [middleware chain executes]
    → add phase for each middleware (if DEBUG enabled and middleware > 10ms)
  → [handler executes]
    → add phase "handler" { startMs, durationMs }
  → [response body written]
    → add phase "response-sent" { startMs, durationMs }
  → log complete timing record
  → discard
```

### EndpointProfile lifecycle

```
Request completes with duration Xms
  → lookup/insert EndpointProfile for routePattern
  → count++, totalMs += X, update min/max
  → if X is in top 10 slowest, insert into recentSlow ring buffer
  → if entries.size > 500, evict entry with lowest count
```

## Validation Rules

- `durationMs` must be >= 0 for all phases
- `routePattern` must be non-empty
- `count` must be >= `recentSlow.length`
- Profile store eviction must preserve entries with `count > 1` over entries with `count === 1`
