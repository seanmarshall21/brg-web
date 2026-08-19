#!/usr/bin/env bash
# Point this clone at the BRG hooks and tell them which chat lives here.
#
#   ./.githooks/install.sh <chat> [warn|block]
#
#   ./.githooks/install.sh conti warn     # the Controller clone, warning mode
#   ./.githooks/install.sh finn  block    # Finn's clone, enforcing
#
# Run once per CHECKOUT — a clone or a worktree. Identity is a fact about the
# checkout, not something a chat has to remember about itself.
#
# WORKTREES. Atlas's PROJECT-SETUP.md makes the Desktop worktree the right shape
# and names clone-per-chat as the wrong one: five clones of one repo pile up and
# get mistaken for separate projects. But worktrees share one git config, so a
# plain `git config fc.chat` in a worktree would rewrite the identity of the main
# clone and every other worktree at once — every seat becoming whoever configured
# last, silently, with the territory hook then policing the wrong map.
#
# The fix is `git config --worktree`, which needs extensions.worktreeConfig on the
# repo. This script enables it and writes worktree-scoped config when it detects a
# worktree, so a seat gets its own identity without touching anyone else's. Proven
# before relying on it: setting fc.chat in a worktree left the main clone's value
# untouched.

set -euo pipefail

chat="${1:-}"
mode="${2:-warn}"

if [ -z "$chat" ]; then
  echo "usage: ./.githooks/install.sh <chat> [warn|block]" >&2
  echo "       chat = the owner id used in .githooks/territory.tsv (e.g. conti, finn)" >&2
  exit 2
fi

case "$mode" in
  warn|block) ;;
  *) echo "error: mode must be 'warn' or 'block' (got '$mode')" >&2; exit 2 ;;
esac

root=$(git rev-parse --show-toplevel)
cd "$root"

if [ ! -f .githooks/territory.tsv ]; then
  echo "error: .githooks/territory.tsv not found — wrong repo?" >&2
  exit 1
fi

chmod +x .githooks/pre-commit .githooks/pre-push .githooks/install.sh

git config core.hooksPath .githooks
git config pull.rebase true

# Is this checkout a worktree? --git-common-dir differs from --absolute-git-dir
# only in a worktree. Never infer it from the folder name: the name is whatever
# Desktop generated and a renamed folder would lie.
# --path-format=absolute on BOTH sides. Without it --git-common-dir returns a
# RELATIVE ".git" in a normal clone while --absolute-git-dir returns a full path, so a
# plain string compare calls the main clone a worktree — and it would then write
# worktree-scoped identity into the one checkout that must hold the shared value.
# Caught by running the comparison on both checkouts instead of only the worktree,
# which is the case the change was written for and therefore the one I would have
# tested if I had tested only one.
abs_git=$(git rev-parse --path-format=absolute --absolute-git-dir 2>/dev/null || git rev-parse --absolute-git-dir)
common_git=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || (cd "$(git rev-parse --show-toplevel)" && cd "$(git rev-parse --git-common-dir)" && pwd))
if [ "$abs_git" != "$common_git" ]; then
  scope="--worktree"
  # Enabling this rewrites the main config's `extensions` key, so it is safe to
  # run repeatedly but must exist BEFORE any --worktree write, or git errors.
  git config extensions.worktreeConfig true
  echo "  worktree detected — identity is scoped to this checkout only"
else
  scope=""
fi

git config $scope fc.chat "$chat"
git config $scope fc.enforce "$mode"

# Warn if this clone is somewhere that will corrupt .git. Cloud sync daemons
# rewrite files under .git out from under git; the damage shows up later as an
# unrecoverable repo, not as an error at the moment of syncing.
case "$root" in
  *Dropbox*|*CloudStorage*|*"Google Drive"*|*OneDrive*|*iCloud*)
    echo
    echo "  ⚠️  This clone is inside a cloud-synced folder:"
    echo "      $root"
    echo "      Move it to local disk. Sync daemons corrupt .git."
    echo
    ;;
esac

echo "hooks installed"
printf '  %-16s %s\n' "chat"          "$(git config fc.chat)"
printf '  %-16s %s\n' "enforce"       "$(git config fc.enforce)"
printf '  %-16s %s\n' "core.hooksPath" "$(git config core.hooksPath)"
printf '  %-16s %s\n' "pull.rebase"   "$(git config pull.rebase)"
printf '  %-16s %s\n' "root"          "$root"
printf '  %-16s %s\n' "scope"         "${scope:---local} (worktree-scoped identity is per-checkout)"
echo
echo "  push with:  git push origin HEAD:main"
