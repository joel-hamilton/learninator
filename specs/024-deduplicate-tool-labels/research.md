# Research: Deduplicate Tool Display Labels

**Phase**: 0 (Outline & Research)

## Decision Record

### Approach: In-place refactoring, no abstractions added

- **Decision**: Modify the three files directly in-place. TOOL_DISPLAY_NAMES becomes the single source of truth. No new classes, modules, or abstraction layers are needed.
- **Rationale**: YAGNI principle. The change is purely mechanical -- merge entries, change import targets, delete dead code. Creating a shared utility or service module would add unnecessary indirection for what is essentially a Record lookup with one special case (input interpolation).
- **Alternatives considered**:
  - New `tool-labels.ts` module: Over-engineering. TOOL_DISPLAY_NAMES already exists in tools.ts and is already exported from the barrel. Moving it would be churn for no benefit.
  - Centralized label function with input interpolation: The generator's input-aware labels (e.g., "Reviewing lesson 3...") are a concern of the lesson generator, not a generic tool label concern. Keeping the interpolation in generator.ts respects separation of concerns.

### Label text parity

- **Decision**: Each tool name gets exactly one canonical label in TOOL_DISPLAY_NAMES. The generator uses that canonical label as its base and formats its own interpolated variant.
- **Rationale**: Prevents further divergence. When the old TOOL_LABELS and toolLabel() switch used different prose for the same tool name (e.g., "Looking at previous lessons" vs "Checking feedback history"), the TOOL_DISPLAY_NAMES version is authoritative.
- **Concrete mapping decisions**:
  - `list_lessons`: "Listing lessons" (TOOL_DISPLAY_NAMES) -- generator says "Looking at previous lessons", TOOL_LABELS says same. Use TOOL_DISPLAY_NAMES as canonical. Generator overrides with its own input-aware formatting.
  - `read_lesson`: "Reading lesson" (TOOL_DISPLAY_NAMES) -- generator overrides with "Reviewing lesson {number}..." when input has a number.
  - `list_reference_docs`: "Listing references" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `list_learning_records`: "Listing records" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `create_lesson`: "Creating lesson" (TOOL_DISPLAY_NAMES) -- generator overrides with "Writing lesson: {title}..." when input has a title.
  - `create_sub_lesson`: "Creating sub-lesson" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `create_reference_doc`: "Creating reference" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `read_mission_content`: "Reading content" (TOOL_DISPLAY_NAMES) -- generator says "Reading mission notes..."
  - `list_feedback_history`: "Listing feedback" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `regenerate_lesson`: "Regenerating lesson" (TOOL_DISPLAY_NAMES) -- generator overrides.
  - `search_web`: new entry, label "Searching the web..." (from TOOL_LABELS)
  - `read_reference_doc`: new entry, label "Reading a reference document..." (from TOOL_LABELS)
  - `read_learning_record`: new entry, label "Reading a learning record..." (from TOOL_LABELS)

## Unresolved questions

None. All design decisions are documented above.
