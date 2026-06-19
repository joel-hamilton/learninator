# Feature Specification: Deduplicate Tool Display Labels

**Feature Branch**: `024-deduplicate-tool-labels`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "De-duplicate tool display labels across three locations. Currently the same mapping of tool_name to human-readable label exists in three places: TOOL_DISPLAY_NAMES in src/ai/tools.ts (17 keys), TOOL_LABELS in src/ai/workflow-state.ts (16 keys), and a private toolLabel() switch statement in src/lessons/generator.ts (10 cases). Make TOOL_DISPLAY_NAMES the single source of truth. Merge missing entries from the other two. Update callers to reference the source of truth. Delete TOOL_LABELS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI tool execution shows consistent labels across the UI (Priority: P1)

When the AI executes a tool during a conversation, the label displayed in the UI for that tool should be the same whether the label is rendered by the conversation loop, the workflow state manager, or the lesson generator. Users should not see different phrasing for the same operation depending on which part of the system is displaying it.

**Why this priority**: P1 because the divergence causes real user-facing inconsistency -- different labels for the same tool confuse users and erode trust in the system.

**Independent Test**: Can be tested entirely in unit tests by verifying that all three calling sites produce the same label for every tool name.

**Acceptance Scenarios**:

1. **Given** any tool name registered in TOOL_DISPLAY_NAMES, **When** toolDisplayLabel() in workflow-state.ts is called, **Then** it returns the same label as TOOL_DISPLAY_NAMES for that name.
2. **Given** any tool name registered in TOOL_DISPLAY_NAMES, **When** toolLabel() in generator.ts is called without dynamic input, **Then** it returns the same label as TOOL_DISPLAY_NAMES for that name.
3. **Given** any tool name not registered in TOOL_DISPLAY_NAMES, **When** either toolDisplayLabel() or toolLabel() is called, **Then** each function returns its own sensible fallback string.

---

### User Story 2 - The codebase has a single source of truth for tool labels (Priority: P1)

Developers modifying tool labels should only need to edit one location -- TOOL_DISPLAY_NAMES in tools.ts. The workflow-state.ts module and generator.ts module should both read from this record.

**Why this priority**: P1 because the whole point of this feature is to eliminate the maintenance burden of keeping three separate mappings in sync.

**Independent Test**: Can be verified by searching for all `TOOL_DISPLAY_NAMES`, `TOOL_LABELS`, and `toolLabel` references in the codebase -- after the change, TOOL_LABELS should be gone and toolLabel() should delegate to TOOL_DISPLAY_NAMES.

**Acceptance Scenarios**:

1. **Given** the codebase after the change, **When** searching for the TOOL_LABELS identifier, **Then** it is not found in workflow-state.ts (the record and its declaration are deleted).
2. **Given** the codebase after the change, **When** searching for TOOL_DISPLAY_NAMES, **Then** it contains all entries from both the old TOOL_LABELS record and the generator toolLabel() switch that were not already present.
3. **Given** the codebase after the change, **When** modifying a tool label, **Then** only TOOL_DISPLAY_NAMES in tools.ts needs to be updated.

### Edge Cases

- What happens when a tool name is present in TOOL_DISPLAY_NAMES but was not in the old TOOL_LABELS or generator toolLabel() switch? Answer: It continues to work because all callers now read from TOOL_DISPLAY_NAMES.
- What happens when a tool name exists in the old TOOL_LABELS but not in TOOL_DISPLAY_NAMES? Answer: Those entries should be merged into TOOL_DISPLAY_NAMES during this change.
- How does generator.ts handle tool names that need dynamic input interpolation (e.g., "Reviewing lesson 3..." vs a static label)? Answer: toolLabel() in generator.ts uses TOOL_DISPLAY_NAMES as the base label and applies its own input-aware formatting on top.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: TOOL_DISPLAY_NAMES in src/ai/tools.ts MUST be extended to include all entries from the old TOOL_LABELS in workflow-state.ts that are not already present (specifically: search_web, read_reference_doc, read_learning_record).
- **FR-002**: TOOL_LABELS in src/ai/workflow-state.ts MUST be deleted.
- **FR-003**: toolDisplayLabel() in src/ai/workflow-state.ts MUST read from TOOL_DISPLAY_NAMES (imported from tools.ts) instead of the deleted TOOL_LABELS.
- **FR-004**: toolLabel() in src/lessons/generator.ts MUST use TOOL_DISPLAY_NAMES as its base label source, falling back to its own switch cases only for tool names that need dynamic input interpolation (e.g., injecting lesson number or title into the label).
- **FR-005**: The fallback string for unknown tool names MUST be preserved at each call site ("Working (tool name)..." for toolDisplayLabel and toolLabel).
- **FR-006**: No existing user-facing labels MAY change as a result of this refactoring (with the exception of deliberate merging of synonyms where the old labels used different phrasing for the same tool).
- **FR-007**: All existing tests MUST pass after the refactoring.

### Key Entities *(include if feature involves data)*

- **Tool Name**: A string identifier for an AI tool (e.g., "create_lesson", "read_mission_content").
- **Tool Display Label**: A human-readable string shown to users when a tool is executing.
- **TOOL_DISPLAY_NAMES**: The centralized source-of-truth record in tools.ts mapping tool names to display labels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the change, exactly one Record (TOOL_DISPLAY_NAMES) defines the tool-name-to-label mapping -- down from three separate definitions.
- **SC-002**: All 100% of existing tests pass without modification (the change is purely a refactoring with no behavioral change).
- **SC-003**: The tools.ts module exports a single TOOL_DISPLAY_NAMES record containing 20 entries (17 existing + 3 merged from TOOL_LABELS: search_web, read_reference_doc, read_learning_record).
- **SC-004**: generator.ts toolLabel() produces identical output for all 10 of its existing switch cases as it did before the change.

## Assumptions

- The label text for each tool name is the same regardless of which part of the UI displays it -- there is no legitimate reason for the same tool to have different labels in different contexts.
- generator.ts toolLabel() needs to handle input-aware labels (e.g., "Reviewing lesson 3..." with the lesson number interpolated) by combining TOOL_DISPLAY_NAMES as a base with its own dynamic formatting.
- All three locations currently have the same fallback pattern ("Working (tool name)...") for unknown tool names, so this behavior is preserved.
- The TOOL_LABELS entries `search_web` and `read_reference_doc` represent tools that exist in the teacher tool definitions but were missing from TOOL_DISPLAY_NAMES through oversight -- they should be added to the source of truth.
