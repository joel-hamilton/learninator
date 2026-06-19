#!/usr/bin/env bash
set -euo pipefail

SPEC_FILE="${1:-specs-to-run.txt}"
BASE_BRANCH="${BASE_BRANCH:-main}"
RUN_ID="$$"

ROOT="$(git rev-parse --show-toplevel)"
WT_DIR="$ROOT/.claude/worktrees"
LOG_DIR="/tmp/learninator.logs"
RUNNER_DIR="$LOG_DIR/runners"

SESSION_NAME="speckit"
WINDOW_NAME="speckit-$RUN_ID"

mkdir -p "$WT_DIR" "$LOG_DIR" "$RUNNER_DIR"

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

if [[ -z "${TMUX:-}" ]]; then
  echo "Not currently inside tmux. Starting tmux session: $SESSION_NAME"
  exec tmux new-session -s "$SESSION_NAME" "cd $(printf '%q' "$ROOT") && bash $(printf '%q' "$SCRIPT_PATH") $(printf '%q' "$SPEC_FILE")"
fi

if [[ ! -f "$ROOT/$SPEC_FILE" && ! -f "$SPEC_FILE" ]]; then
  echo "Could not find spec file: $SPEC_FILE"
  exit 1
fi

if [[ -f "$ROOT/$SPEC_FILE" ]]; then
  SPEC_FILE="$ROOT/$SPEC_FILE"
fi

FEATURES=()
while IFS= read -r line; do
  FEATURES+=("$line")
done < <(
  sed 's/#.*//' "$SPEC_FILE" |
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
    grep -v '^$'
)

if [[ ${#FEATURES[@]} -eq 0 ]]; then
  echo "No specs found in $SPEC_FILE"
  exit 1
fi

echo "Creating tmux window: $WINDOW_NAME"

tmux new-window -n "$WINDOW_NAME" -c "$ROOT"
tmux set-window-option -t "$WINDOW_NAME" remain-on-exit on >/dev/null

for i in "${!FEATURES[@]}"; do
  FEATURE="${FEATURES[$i]}"
  SAFE_FEATURE="$(printf '%s' "$FEATURE" | tr -c 'A-Za-z0-9._-' '_')"

  BRANCH="ai/$FEATURE"
  WORKTREE="$WT_DIR/$SAFE_FEATURE"
  LOG="$LOG_DIR/$SAFE_FEATURE.log"
  RUNNER="$RUNNER_DIR/run-$SAFE_FEATURE.sh"

  cat > "$RUNNER" <<EOF
#!/usr/bin/env bash
set -euo pipefail

FEATURE=\$(printf '%q' "$FEATURE")
BRANCH=\$(printf '%q' "$BRANCH")
WORKTREE=\$(printf '%q' "$WORKTREE")
BASE_BRANCH=\$(printf '%q' "$BASE_BRANCH")
ROOT=\$(printf '%q' "$ROOT")
LOG=\$(printf '%q' "$LOG")

mkdir -p "\$(dirname "\$LOG")"

exec > >(tee -a "\$LOG") 2>&1

echo "================================================================"
echo "Feature:   \$FEATURE"
echo "Branch:    \$BRANCH"
echo "Worktree:  \$WORKTREE"
echo "Log:       \$LOG"
echo "Started:   \$(date)"
echo "================================================================"

cd "\$ROOT"

# Clean up any previous worktree at this path.
if git worktree list --porcelain 2>/dev/null | grep -qFx "worktree \$WORKTREE"; then
  echo "Removing previous worktree at \$WORKTREE"
  git worktree remove --force "\$WORKTREE"
elif [ -d "\$WORKTREE" ]; then
  echo "Removing stale directory at \$WORKTREE"
  rm -rf "\$WORKTREE"
fi

# Create isolated worktree.
if git show-ref --verify --quiet "refs/heads/\$BRANCH"; then
  echo "Branch exists. Deleting and recreating from \$BASE_BRANCH."
  git branch -D "\$BRANCH"
fi
git fetch --all --prune || true
git worktree add -b "\$BRANCH" "\$WORKTREE" "\$BASE_BRANCH"

cd "\$WORKTREE"

echo
echo "Current directory: \$(pwd)"
echo "Git branch:"
git branch --show-current
echo

PROMPT=\$(cat <<PROMPT_EOF
Implement the Spec Kit feature: \$FEATURE.

Run /speckit-implement and follow the tasks in order.

Rules:
- Implement only this feature/spec.
- After meaningful chunks, run the relevant tests/typechecks/linters.
- Do not deploy.
- Do not push to remote.
- Do not edit secrets, .env files, or global config.
- If you need a decision, stop and write BLOCKED-\$FEATURE.md.
- At the end, run the full relevant test suite.
- Commit the finished work to this branch with a clear conventional commit message.
PROMPT_EOF
)

echo "Launching Claude..."
echo

set +e

claude "\$PROMPT"

CLAUDE_STATUS=\$?

set -e

echo
echo "================================================================"
echo "Claude exited with status: \$CLAUDE_STATUS"
echo "Finished: \$(date)"
echo "Log: \$LOG"
echo "================================================================"
echo
echo "Leaving pane open. You are now in an interactive shell."
echo

exec bash -i
EOF

  chmod +x "$RUNNER"

  if [[ "$i" -eq 0 ]]; then
    PANE_ID="$(tmux display-message -p -t "$WINDOW_NAME" '#{pane_id}')"
    tmux select-pane -t "$PANE_ID" -T "$FEATURE"
    tmux send-keys -t "$PANE_ID" "bash $(printf '%q' "$RUNNER")" C-m
  else
    PANE_ID="$(
      tmux split-window \
        -P \
        -F '#{pane_id}' \
        -t "$WINDOW_NAME" \
        -c "$ROOT" \
        "bash $(printf '%q' "$RUNNER")"
    )"
    tmux select-pane -t "$PANE_ID" -T "$FEATURE"
  fi

  sleep 0.2
done

tmux select-layout -t "$WINDOW_NAME" tiled

echo "All panes launched in window: $WINDOW_NAME"
echo "Attach with: tmux attach-session -t $SESSION_NAME"
