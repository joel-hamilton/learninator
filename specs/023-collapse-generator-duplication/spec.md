# Feature Specification: Collapse Generator Duplication

**Feature Branch**: `023-collapse-generator-duplication`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Collapse LessonGenerator's four duplicate generation methods"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer adds a new lesson generation type (Priority: P1)

A developer needs to introduce a fifth kind of lesson generation (e.g., a "prerequisite" generation that fills knowledge gaps before the current lesson). Currently they must copy-paste an entire ~50-line method and surgically change the prompt, job key type, and result-finding logic. This is error-prone: a copy-paste mistake in the job key prefix or result-finding callback could silently pollute existing lesson data.

**Why this priority**: The entire purpose of this refactoring is to make adding new generation kinds cheap and safe. If a developer cannot add a fifth kind with a single config object, the refactoring has failed.

**Independent Test**: Can be tested by verifying that adding a new generation kind requires only one new config object (no structural duplication) and all existing generation kinds still produce identical output.

**Acceptance Scenarios**:

1. **Given** the LessonGenerator class, **When** a developer wants to add a new lesson generation type, **Then** they only need to define one `GenerationConfig` object (with `buildJobKey`, `buildSystemPrompt`, `buildUserMessage`, and `findResult` callbacks) and call the shared `runGeneration` template method.
2. **Given** an existing `GenerationConfig` for any generation type, **When** the system is loaded, **Then** the config produces the same job key, system prompt, user message, and result-finding behavior as the original dedicated method.

---

### User Story 2 - Developer understands the generation flow (Priority: P1)

A new developer joins the project and reads `LessonGenerator` to understand how lesson generation works. Currently they must read through four nearly-identical methods to extract the common pattern. After the refactoring, they read one `runGeneration` template method and four config objects, each showing only what makes that generation type unique.

**Why this priority**: Reducing cognitive load is the primary motivation for this refactoring. Structural duplication obscures intent and makes code harder to audit.

**Independent Test**: Can be tested by comparing total lines of the four config objects (plus the template method) against the original four methods. The configs plus template must be significantly shorter than the original duplicated code.

**Acceptance Scenarios**:

1. **Given** the refactored `LessonGenerator`, **When** a developer reads the four public methods, **Then** each method body is a single call to `runGeneration` with its config — no duplicated scaffolding.
2. **Given** the refactored `LessonGenerator`, **When** a developer inspects any individual generation type, **Then** the prompt text, job key type, user message, and result-finding logic are co-located in one config object (not scattered across multiple method sections).

---

### User Story 3 - Tests verify identical behavior after refactoring (Priority: P2)

After the refactoring, existing tests for lesson generation must continue to pass without modification. The behavioral contract of `generateNext`, `generateSubLesson`, `generateRegenerate`, and `generateBridging` is unchanged — only the internal implementation changes.

**Why this priority**: A refactoring that breaks tests is not a safe refactoring. The existing test suite is the safety net that ensures the behavioral contract is preserved.

**Independent Test**: Run the existing test suite with `npm test`. All existing tests must pass without any test file modifications.

**Acceptance Scenarios**:

1. **Given** the refactored `LessonGenerator`, **When** the existing test suite is run, **Then** all passing tests continue to pass without modification.
2. **Given** the refactored `LessonGenerator`, **When** the same inputs are provided to `generateNext`, `generateSubLesson`, `generateRegenerate`, and `generateBridging`, **Then** each method produces the same job keys, invokes the same AI calls with the same prompts, and returns the same results as before.

---

### Edge Cases

- What happens if a `GenerationConfig` callback throws an error? The template method must propagate errors consistently, just as each original method did.
- What happens if `buildJobKey` returns a key that collides with another generation type? The same collision behavior as before (the job key embeds the type prefix, so collisions across types are impossible by design).
- What happens if a new callback is added to `GenerationConfig` in the future? Existing configs must remain valid (new callbacks should be optional or have defaults).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `LessonGenerator` class MUST define a `GenerationConfig` interface or type with four callbacks: `buildJobKey()`, `buildSystemPrompt()`, `buildUserMessage()`, and `findResult()`.
- **FR-002**: The `LessonGenerator` class MUST have a private `runGeneration(config: GenerationConfig)` template method that encapsulates the shared 5-step lifecycle: build job key, check for duplicate job, construct system prompt, construct user message, and call `runGenerationJob` with the result-finding callback.
- **FR-003**: The `generateNext()` method MUST delegate to `runGeneration` with its specific config, producing the same job key prefix, system prompt, user message, and result-finding behavior as before.
- **FR-004**: The `generateSubLesson()` method MUST delegate to `runGeneration` with its specific config, producing the same job key prefix, system prompt, user message, and result-finding behavior as before.
- **FR-005**: The `generateRegenerate()` method MUST delegate to `runGeneration` with its specific config, producing the same job key prefix, system prompt, user message, and result-finding behavior as before.
- **FR-006**: The `generateBridging()` method MUST delegate to `runGeneration` with its specific config, producing the same job key prefix, system prompt, user message, and result-finding behavior as before.
- **FR-007**: The `runGeneration` template method MUST preserve the existing error handling pattern: set job status to "error", log via `logger.error`, and schedule 60-second cleanup via `setTimeout`.
- **FR-008**: The refactoring MUST NOT change the public API of `LessonGenerator` — all four public methods (`generateNext`, `generateSubLesson`, `generateRegenerate`, `generateBridging`) MUST accept the same parameters and return the same types as before.

### Key Entities *(include if feature involves data)*

- **GenerationConfig**: A configuration object type that defines the differential behavior for one lesson generation kind. Contains callbacks for building the job key, constructing the system prompt, building the user message, and finding the result after AI execution.
- **LessonGenerator**: The class that orchestrates lesson generation jobs. After refactoring, it contains one template method (`runGeneration`) and four thin public methods that each pass their config to the template.
- **Job key**: A string identifier (`{type}-{missionId}-{number}-{subNumber}`) that uniquely identifies a generation job and enables deduplication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Total lines of code in `src/lessons/generator.ts` related to the four generation methods and their shared lifecycle is reduced by at least 100 lines (from approximately 220 lines of structural duplication to approximately 100 lines for configs plus template).
- **SC-002**: Each of the four public method bodies is at most 5 lines long (a single call to `runGeneration` with its config).
- **SC-003**: The existing test suite passes with zero modifications to test files.
- **SC-004**: A developer can describe the lifecycle of any lesson generation type by reading one template method and one config object — no need to cross-reference four near-identical methods.

## Assumptions

- The existing `runGenerationJob` private method is already well-factored (wraps async execution, job lifecycle, error handling, and 60-second cleanup) and does not need changes.
- The four generation methods' current behavior (job key format, prompt content, result-finding strategy) is correct and should be preserved exactly.
- The `buildJobKey` helper function at module level can remain unchanged or be absorbed into the config pattern.
- No changes to test files are needed or desired — the refactoring is purely structural.
- The existing `src/lessons/generator.ts` file is the only file that needs modification.
