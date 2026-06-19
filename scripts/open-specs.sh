#!/usr/bin/env bash
# Open tmux panes for each spec listed in a file, each in its own git worktree.
# Usage: ./scripts/open-specs.sh <specs-file>
#
# specs-file format: one spec directory name per line, e.g.:
#   001-agentic-workflow-visibility
#   002-server-observability
#
# Blank lines and #-comments are ignored.

set -euo pipefail

SPECS_FILE="${1:?Usage: $0 <specs-file>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Collect specs (filter out blanks and comments) — bash 3.2 compat, no mapfile
SPECS=()
while IFS= read -r line; do
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -n "$line" ] && SPECS+=("$line")
done < <(grep -v '^\s*#' "$SPECS_FILE")
if [ ${#SPECS[@]} -eq 0 ]; then
  echo "No specs found in $SPECS_FILE"
  exit 1
fi

echo "=== Opening ${#SPECS[@]} specs ==="

# Ensure we're in a tmux session
if [ -z "${TMUX:-}" ]; then
  echo "Not in a tmux session. Attach or create one first."
  exit 1
fi

# Create a new window for the specs and capture its first pane ID
WINDOW_NAME="specs"
FIRST_PANE=$(tmux new-window -P -F '#{pane_id}' -n "$WINDOW_NAME" -c "$REPO_ROOT")

# --- Pass 1: create worktrees and panes ---
PANE_IDS=("$FIRST_PANE")
for i in "${!SPECS[@]}"; do
  SPEC="${SPECS[$i]}"
  WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$SPEC"
  BRANCH="ai/$SPEC"

  # Checkout worktree if it doesn't exist
  if [ ! -d "$WORKTREE_PATH" ]; then
    echo "  Creating worktree for $SPEC..."
    git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH" 2>/dev/null || {
      echo "    Branch $BRANCH doesn't exist yet, creating from main..."
      git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_PATH" main
    }
  else
    echo "  Worktree already exists: $SPEC"
  fi

  # First spec already has a pane (the window's initial pane)
  if [ "$i" -gt 0 ]; then
    if [ $((i % 2)) -eq 1 ]; then
      PANE_ID=$(tmux split-window -P -F '#{pane_id}' -h -t "$WINDOW_NAME" -c "$WORKTREE_PATH")
    else
      PANE_ID=$(tmux split-window -P -F '#{pane_id}' -v -t "$WINDOW_NAME" -c "$WORKTREE_PATH")
    fi
    PANE_IDS+=("$PANE_ID")
    tmux select-layout -t "$WINDOW_NAME" tiled
  fi
done

# Wait for all shells to initialize
sleep 1

# --- Pass 2: inject keystrokes into each pane ---
for i in "${!SPECS[@]}"; do
  SPEC="${SPECS[$i]}"
  WORKTREE_PATH="$REPO_ROOT/.claude/worktrees/$SPEC"
  tmux send-keys -t "${PANE_IDS[$i]}" "cd '$WORKTREE_PATH' && clear && claude-deep \"/speckit-plan\"" Enter
done

# Return to first pane
tmux select-pane -t "$FIRST_PANE"

echo "=== Done. ${#SPECS[@]} specs open in window '$WINDOW_NAME' ==="
