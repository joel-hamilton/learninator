# Contract: TopicExplorer

No changes required by this refactor. The `TopicExplorer` is already wired to browse routes.

## Factory

```typescript
createTopicExplorer(deps: TopicExplorerDeps): TopicExplorer
```

## Dependencies

```
TopicExplorerDeps {
  ai: AiClient   // Required — AI client for topic generation
  logger: Logger // Required — error logging
}
```

## Methods

### explore(path, iteration) → TopicOptions

Gets topic options at the current exploration level.
- path.length === 0: broad categories (8 max)
- path.length > 0: sub-topics within chosen path (6 max)
- On AI error: returns fallback options (FALLBACK_OPTIONS or FALLBACK_NARROW_OPTIONS)
- Returns `{ options: string[], isLastQuestion: boolean }`

### select(path, selection, iteration, isCustom?) → TopicResult

Advances exploration by one level after user selects a topic.
- isCustom: always returns more options (never forces mission creation)
- iteration >= 3 (non-custom): forces mission creation via safety valve
- AI response with `is_specific_enough: true`: creates mission
- AI error: THROWS (caller must handle)
- Returns `{ type: "options", ... }` or `{ type: "create_mission", topic, path }`

### refresh(path, iteration) → TopicOptions

Gets different options at the current level without changing path/iteration.
- path.length === 0: re-generates broad categories
- path.length > 0: re-generates at same level with different alternatives
- On AI error: THROWS (caller must handle)
- Returns `{ options: string[], isLastQuestion: boolean }`

## Route Integration

The browse routes in `src/routes/browse.ts` create TopicExplorer via a thin helper:

```typescript
function getExplorer(c: Ctx): TopicExplorer {
  return createTopicExplorer({ ai: c.get("ai"), logger: c.get("logger") });
}
```

This could be moved to context injection if TopicExplorer gains additional consumers.
