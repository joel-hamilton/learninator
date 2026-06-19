# Research: 021-deepen-ai-error

**Decision**: No research needed — all technical details are fully specified.

**Rationale**: The feature is a mechanical refactoring with no unknowns. The existing
codebase already has a clear pattern for how `AIError` is constructed and how
`formatAIError` formats it. The six call sites are identified, the test patterns
exist, and the migration is a pure inline-and-delete.

**Alternatives considered**:
- Extracting `AIError` to a shared package: over-engineering for a single class.
- Dropping the `fallback` parameter from `toUserMessage`: rejected because the spec
  explicitly reserves it for API consistency with the old `formatAIError` contract.
