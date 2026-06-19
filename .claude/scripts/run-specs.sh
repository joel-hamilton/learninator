#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
ROOT="$(git rev-parse --show-toplevel)"
WT_DIR="$ROOT/.claude/worktrees"
LOG_DIR="/tmp/learninator.logs"

mkdir -p "$WT_DIR" "$LOG_DIR"

while read -r FEATURE; do
  [[ -z "$FEATURE" || "$FEATURE" =~ ^# ]] && continue

  BRANCH="ai/${FEATURE}"
  WORKTREE="$WT_DIR/$FEATURE"
  LOG="$LOG_DIR/$FEATURE.log"

  echo "=== Starting $FEATURE on branch $BRANCH ==="

  # Clean up any previous worktree at this path.
  if git worktree list --porcelain | grep -qFx "worktree $WORKTREE"; then
    echo "  Removing previous worktree at $WORKTREE"
    git worktree remove --force "$WORKTREE"
  elif [ -d "$WORKTREE" ]; then
    echo "  Removing stale directory at $WORKTREE"
    rm -rf "$WORKTREE"
  fi

  # Create isolated worktree. If the branch already exists, check it out.
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git worktree add "$WORKTREE" "$BRANCH"
  else
    git worktree add -b "$BRANCH" "$WORKTREE" "$BASE_BRANCH"
  fi

  (
    cd "$WORKTREE"

    claude -p "
Implement the Spec Kit feature: $FEATURE.

Run /speckit-implement and follow the tasks in order.

Rules:
- Implement only this feature/spec.
- After meaningful chunks, run the relevant tests/typechecks/linters.
- Do not deploy.
- Do not push to remote.
- Do not edit secrets, .env files, or global config.
- If you need a decision, stop and write BLOCKED-$FEATURE.md.
- At the end, run the full relevant test suite.
- Commit the finished work to this branch with a clear conventional commit message.
" \
      --permission-mode auto \
      --output-format stream-json \
      --verbose 2>&1 | tee "$LOG"
  )

  echo "=== Finished $FEATURE. Log: $LOG ==="
done <"$ROOT/specs-to-run.txt"
