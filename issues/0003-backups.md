---
status: backlog
priority: low
created: 2026-06-12
---

# Database backup strategy

**What**: Regular backups of the SQLite database file.

**Why**: User learning data (missions, progress, learning records) is valuable. Currently there's no automated backup.

**Acceptance criteria**:
- [ ] Periodic backup script (cron on host or container)
- [ ] Backup rotation (keep last N backups)
- [ ] Document restore procedure in README

**Notes**: SQLite is a single file, so backup is just `cp data/learninator.db backup/learninator-$(date).db`. Can be a simple script on the host machine. Litestream considered but overkill for this scale.
