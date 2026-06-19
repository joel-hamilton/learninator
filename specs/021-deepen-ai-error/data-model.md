# Data Model: 021-deepen-ai-error

## Overview

No new data entities are introduced. The only change is the addition of a single
method to the existing `AIError` class.

## Entities

### AIError

**Location**: `src/ai/errors.ts`

**Kind**: Error class (extends `Error`)

#### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `message` | `string` | (required) | Human-readable error description. Inherited from `Error`. |
| `status` | `number \| undefined` | `undefined` | Optional HTTP status code from the AI service. |
| `recoverable` | `boolean` | `false` | Whether the error is transient and worth retrying. |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `toUserMessage` | `(fallback?: string) => string` | Returns the user-facing error string. Appends the recovery hint only when `recoverable` is `true`. The `fallback` parameter is accepted for API consistency but is **unused** by the method — callers perform the `instanceof` guard themselves and supply the fallback at the call site. |

#### Method Behavior

- `recoverable === true`: returns `this.message + " It may help to wait a moment and retry."`
- `recoverable === false` or `undefined`: returns `this.message` unchanged
- Always returns a string; never throws

#### Construction

Constructor signature: `new AIError(message: string, status?: number, recoverable?: boolean)`

## Relationships

- **No new relationships.** AIError is used in catch blocks across route handlers.
- The former caller `formatAIError()` in `src/shared/errors.ts` is deleted.
- The six route files that import `formatAIError` switch to inline `instanceof` checks.

## State Transitions

None. AIError is immutable after construction (fields are `readonly`). The new
method is a pure computation on existing state.

## Validation

All validation is compile-time (TypeScript types). The `toUserMessage` method has
no external input to validate — it only reads `this.message` and `this.recoverable`.
