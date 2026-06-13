# Issues

Issues are tracked as files in this directory. Each issue is a single markdown file.

## Status workflow

```
backlog → in_progress → done
                  ↘ blocked (with note about blocker)
```

## Issue template

```markdown
---
status: backlog
priority: low | medium | high
created: YYYY-MM-DD
---

# [Title]

**What**: [One sentence description]

**Why**: [Why this matters to the user or the project]

**Acceptance criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

**Notes**: [Any constraints, ideas, dependencies]
```

## Priority guide

- **high**: Blocking core functionality or security
- **medium**: Important feature, do soon
- **low**: Nice to have, N+1
