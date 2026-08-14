#!/usr/bin/env bash
#
# PREPARED CHANGE 2 of 2 — delete careers-posts' "834 followers" and "2mo"/"5mo" stamps.
#
# SEAN RULED YES, 2026-08-14 01:31 in the Atlas channel, answering Expo:
#   "OK to delete the '834 followers' and '2mo' stamps from the careers cards?" -> "Yes"
#
# Deliberately SEPARATE from apply.sh (the jobs-link change), which is still awaiting Sean's
# go-ahead. Either can be applied without the other, in either order.
#
# Destination is @finn's territory (website/sections/). Run from the repo root in FINN's clone.
# Asserts every precondition first and refuses rather than half-applying; stages nothing and
# commits nothing. Re-running after a successful apply is a no-op.

set -euo pipefail

FILE="website/sections/careers-posts/embed.html"
SECTION_DIR="website/sections/careers-posts"

# The two stamps. Each appears exactly once.
OLD_2MO='<span class="meta">834 followers &middot; 2mo</span>'
OLD_5MO='<span class="meta">834 followers &middot; 5mo</span>'

# The header bullet that documents them — it becomes false the moment they are gone.
OLD_NOTE='     Two things to know before this goes in front of anyone:
      · "834 followers" and the "2mo"/"5mo" stamps are copied from the comp. They are STATIC
        and will go stale. Either keep them current by hand, drop them (the <time> and
        .meta spans can be deleted with no layout consequence), or wire them to real data.
      · The "View job" links'
NEW_NOTE='     One thing to know before this goes in front of anyone:
      · The follower count and the relative age stamps were DELETED on 2026-08-14 (Sean'"'"'s
        call). They were copied from the comp and could never be kept true: the follower
        count is only visible behind a LinkedIn login, and an ageing "2mo" on a job post
        signals the role is stale — the opposite of what this section is for. Do not
        reinstate them. See work/dum/careers-posts-urls/FINDINGS.md.
      · The "View job" links'

die() { printf '\n  REFUSED: %s\n\n' "$*" >&2; exit 1; }
ok()  { printf '  ok    %s\n' "$*"; }

printf '\ncareers-posts → delete the follower/age stamps (prepared by dum, ruled by Sean)\n\n'

[ -f "$FILE" ] || die "$FILE not found. Run from the repo root."

# ── Idempotency ────────────────────────────────────────────────────────────
if ! grep -q '834 followers &middot;' "$FILE"; then
    printf '  Already applied — no stamps found. Nothing to do.\n\n'
    exit 0
fi

# ── Preconditions ──────────────────────────────────────────────────────────
# If the section has been ACF-wired since preparation, the stamp text may now be a slot and
# the deletion belongs in slots.json instead, with a priming rule attached.
if grep -q '{{' "$FILE"; then
    die "$FILE now contains {{tokens}} — it has been ACF-wired since this was prepared.
           The stamp text may be a slot now, so the change moves into slots.json.
           Do NOT force this patch."
fi
ok "no {{tokens}} — section is not ACF-wired"

[ ! -e "$SECTION_DIR/slots.json" ] || die "$SECTION_DIR/slots.json exists — section has been
           ACF-wired since preparation. Same consequence as above."
ok "no slots.json"

for pair in "2mo:$OLD_2MO" "5mo:$OLD_5MO"; do
    label="${pair%%:*}"; needle="${pair#*:}"
    n=$(grep -F -c "$needle" "$FILE" || true)
    [ "$n" = "1" ] || die "expected exactly 1 '${label}' stamp, found ${n}. The cards have been
           edited — read the section and do this by hand rather than replacing blind."
    ok "exactly 1 ${label} stamp"
done

grep -qF 'Two things to know before this goes in front of anyone:' "$FILE" \
    || die "the header comment has been rewritten since preparation — apply the markup change
           by hand and update the comment yourself, so the file never documents stamps it
           no longer has."
ok "header comment intact"

if ! git diff --quiet -- "$FILE" 2>/dev/null || ! git diff --cached --quiet -- "$FILE" 2>/dev/null; then
    die "$FILE has uncommitted changes. Commit or stash them so the resulting diff is
           unambiguously this change."
fi
ok "working tree clean for this file"

# ── Apply ──────────────────────────────────────────────────────────────────
# Literal string replacement, no regex interpretation — the strings contain &, ·, quotes.
OLD_2MO="$OLD_2MO" OLD_5MO="$OLD_5MO" OLD_NOTE="$OLD_NOTE" NEW_NOTE="$NEW_NOTE" FILE="$FILE" \
python3 - <<'PY'
import os
p = os.environ['FILE']
src = open(p, encoding='utf-8').read()
for key in ('OLD_2MO', 'OLD_5MO'):
    s = os.environ[key]
    assert src.count(s) == 1, f'{key} count changed between check and write'
    src = src.replace(s, '')
note_old, note_new = os.environ['OLD_NOTE'], os.environ['NEW_NOTE']
assert src.count(note_old) == 1, 'header comment count changed between check and write'
src = src.replace(note_old, note_new)
open(p, 'w', encoding='utf-8').write(src)
PY

# ── Verify ─────────────────────────────────────────────────────────────────
[ "$(grep -c '834 followers' "$FILE" || true)" = "0" ] \
    || die "post-check: '834 followers' still present. Revert: git checkout -- $FILE"
[ "$(grep -c 'class="meta"' "$FILE" || true)" = "0" ] \
    || die "post-check: a .meta span survived. Revert: git checkout -- $FILE"
grep -q 'were DELETED on 2026-08-14' "$FILE" \
    || die "post-check: header comment not updated. Revert: git checkout -- $FILE"
ok "stamps gone, header comment updated"

printf '\n  Applied. Nothing staged.\n\n'
git --no-pager diff -- "$FILE"

cat <<'EOF'

  Note: the .meta CSS rule is left in place on purpose — it is 2 lines, harmless, and
  removing it is a separate tidy that would widen this diff past what Sean ruled on.

  Revert:  git checkout -- website/sections/careers-posts/embed.html

EOF
