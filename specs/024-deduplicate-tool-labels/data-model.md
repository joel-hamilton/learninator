# Data Model: Deduplicate Tool Display Labels

**Phase**: 1 (Design & Contracts)

## Entities

No new data entities. The refactoring operates entirely on existing in-memory TypeScript data structures.

### Existing structure (unchanged semantics)

| Name | Type | Location | Description |
|------|------|----------|-------------|
| TOOL_DISPLAY_NAMES | `Record<string, string>` | `src/ai/tools.ts` | Single source of truth mapping tool_name to human-readable label. Expanded from 17 to 20 entries. |
| toolDisplayLabel() | `(name: string, _input?) => string` | `src/ai/workflow-state.ts` | Public function that reads from TOOL_DISPLAY_NAMES. Signature unchanged. |
| toolLabel() | `(name: string, input?) => string` | `src/lessons/generator.ts` | Private method that reads from TOOL_DISPLAY_NAMES as base, with input-aware overrides. |

## State transitions

N/A -- no state machine or lifecycle changes.

## Validation rules

N/A -- no new validation.
