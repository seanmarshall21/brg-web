#!/usr/bin/env bash
# Point this clone at the BRG hooks and tell them which chat lives here.
#
#   ./.githooks/install.sh <chat> [warn|block]
#
#   ./.githooks/install.sh conti warn     # the Controller clone, warning mode
#   ./.githooks/install.sh finn  block    # Finn's clone, enforcing
#
# Run once per clone. `fc.chat` is repo-LOCAL config, so it travels with the
# clone and never leaks to another one — which is exactly the property that
# makes clone-per-chat safe: identity is a fact about the checkout, not
# something a chat has to remember about itself.

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
git config fc.chat "$chat"
git config fc.enforce "$mode"

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
echo
echo "  push with:  git push origin HEAD:main"
