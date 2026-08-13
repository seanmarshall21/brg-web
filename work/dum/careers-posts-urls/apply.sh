#!/usr/bin/env bash
#
# PREPARED CHANGE — point careers-posts' two "View job" links at BRG's LinkedIn jobs page.
# Prepared by dum 2026-08-13. PAUSED BY SEAN — do not run until he says go.
#
# Destination is @finn's territory (website/sections/). Run this from the repo root in FINN's
# clone. It asserts every precondition first and refuses rather than half-applying; it stages
# nothing and commits nothing, so the result is a plain working-tree diff for review.
#
# Re-running after a successful apply is a no-op.
#
# See APPLY.md §2 for what each assertion means when it fails, and §4 for the re-verify that
# has to happen BEFORE this is run.

set -euo pipefail

FILE="website/sections/careers-posts/embed.html"
SECTION_DIR="website/sections/careers-posts"

OLD='        <a class="view" href="/careers/">View job</a>'
NEW='        <a class="view" href="https://www.linkedin.com/company/blacktop-restaurant-group/jobs/" target="_blank" rel="noopener">View job</a>'

# Baseline this was prepared and verified against (APPLY.md §2).
BASELINE_BLOB='b1bb10b072f1a8eb7a4ef842203222d1be55e699'

die() { printf '\n  REFUSED: %s\n\n' "$*" >&2; exit 1; }
ok()  { printf '  ok    %s\n' "$*"; }

printf '\ncareers-posts → LinkedIn jobs page (prepared by dum)\n\n'

[ -f "$FILE" ] || die "$FILE not found. Run from the repo root."

# ── Idempotency ────────────────────────────────────────────────────────────
if grep -q 'linkedin.com/company/blacktop-restaurant-group/jobs/' "$FILE"; then
    printf '  Already applied — the LinkedIn jobs URL is present. Nothing to do.\n\n'
    exit 0
fi

# ── Preconditions (APPLY.md §2) ────────────────────────────────────────────

# 2 + 3: has this section been ACF-wired since preparation? Then the href may be a slot and
# the fix belongs in slots.json, not here. This is the failure mode most likely to actually
# happen — the ACF sweep is live across website/sections/.
if grep -q '{{' "$FILE"; then
    die "$FILE now contains {{tokens}} — it has been ACF-wired since this was prepared.
           The href may now be a slot, so the fix moves into slots.json and carries a
           priming rule. Do NOT force this patch. See APPLY.md §2."
fi
ok "no {{tokens}} — section is not ACF-wired"

if [ -e "$SECTION_DIR/slots.json" ]; then
    die "$SECTION_DIR/slots.json exists — section has been ACF-wired since preparation.
           Same consequence as above. See APPLY.md §2."
fi
ok "no slots.json"

# 4: someone already did it by hand, differently.
if grep -q 'target="_blank"' "$FILE"; then
    die "$FILE already contains target=\"_blank\" but not our URL — someone has edited
           these links by hand. Read the section before doing anything else."
fi
ok "no pre-existing target=\"_blank\""

# 1: exactly two occurrences is what makes a blind replace-all safe.
COUNT=$(grep -F -c "$OLD" "$FILE" || true)
[ "$COUNT" = "2" ] || die "expected exactly 2 occurrences of the /careers/ self-link, found ${COUNT}.
           The cards have been edited. Re-read the section — the change is probably still
           right, but verify by hand rather than replacing blind. See APPLY.md §2."
ok "exactly 2 occurrences of the /careers/ self-link"

# 5: a clean starting point, so the diff is unambiguously this change.
if ! git diff --quiet -- "$FILE" 2>/dev/null || ! git diff --cached --quiet -- "$FILE" 2>/dev/null; then
    die "$FILE has uncommitted changes. Commit or stash them so the resulting diff is
           unambiguously this change."
fi
ok "working tree clean for this file"

# Advisory: exact-baseline check. Not fatal — the assertions above are the real gate.
BLOB=$(git hash-object "$FILE")
if [ "$BLOB" = "$BASELINE_BLOB" ]; then
    ok "blob matches the prepared baseline exactly — zero drift"
else
    printf '  note  file has changed since preparation (blob %s, baseline %s).\n' \
           "${BLOB:0:12}" "${BASELINE_BLOB:0:12}"
    printf '        Assertions above still passed, so the change is safe — but read the\n'
    printf '        diff with a little more care than usual.\n'
fi

# ── Apply ──────────────────────────────────────────────────────────────────
# python3 rather than sed: the replacement contains slashes and quotes, and this does a
# literal string replace with no regex interpretation and no escaping to get wrong.
OLD="$OLD" NEW="$NEW" FILE="$FILE" python3 - <<'PY'
import os
path, old, new = os.environ['FILE'], os.environ['OLD'], os.environ['NEW']
with open(path, encoding='utf-8') as fh:
    src = fh.read()
assert src.count(old) == 2, 'occurrence count changed between check and write'
with open(path, 'w', encoding='utf-8') as fh:
    fh.write(src.replace(old, new))
PY

# ── Verify what we just did ────────────────────────────────────────────────
AFTER_OLD=$(grep -F -c "$OLD" "$FILE" || true)
AFTER_NEW=$(grep -c 'linkedin.com/company/blacktop-restaurant-group/jobs/' "$FILE" || true)
[ "$AFTER_OLD" = "0" ] || die "post-check: ${AFTER_OLD} self-link(s) still present. Revert with: git checkout -- $FILE"
[ "$AFTER_NEW" = "2" ] || die "post-check: expected 2 LinkedIn links, found ${AFTER_NEW}. Revert with: git checkout -- $FILE"

printf '\n  Applied. 2 links changed, nothing staged.\n\n'
git --no-pager diff -- "$FILE"

cat <<'EOF'

  Next (APPLY.md §6) — none of it automated, all of it @finn's call:
    · update the header comment at the top of the fragment; it still says the links
      point at /careers/ "until the real LinkedIn job URLs are supplied"
    · review the diff, then stage and commit as normal
    · verify live behind the gate: both buttons open LinkedIn in a new tab

  Revert:  git checkout -- website/sections/careers-posts/embed.html

EOF
