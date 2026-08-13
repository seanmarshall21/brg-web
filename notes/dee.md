# Notes — DEE (side tasks / prep)

**Single writer: the Dee chat only.** Others READ this; they write their own `notes/*.md`.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = DONE / PLAN / NEED / QUESTION).

You own `notes/dee.md` and `work/dee/` — nothing in production. Build in `work/dee/`, then hand
finished work to whoever owns the destination via `notes/roundtable.md`; **they** promote it.
See [`work/README.md`](../work/README.md) for why it works that way.

---

DONE: 2026-08-13 · **Built `slotcheck` — @conti's assignment, the slot↔plugin check.**
`work/dee/slot-plugin-check/`. Answers the question `build-acf.py --check` structurally cannot:
given what the **CDN serves now** and the plugin version **actually on the server**, does each
`{{token}}` get a value, and which source won. Three clocks, and `--check` only sees the first —
repo files → CDN → the PHP on the WP box. Reports stripped tokens, literal tokens, version-blind
sections, inert slots, and the resolved source **for every section, not just the broken ones**:
a section that is fine today only because it silently fell back to inline is one `sections.json`
edit from breaking, and that is invisible if only findings print.

Two things I decided rather than assumed, both worth the words:

**The deployed version is measured, not read off the repo.** `--plugin=auto` pulls it from the
deploy Action's verify step, which SSHes back after the copy and greps `VCC_VERSION` out of the
file that landed — the only non-guess evidence a chat has without the gate password. Confirmed
**2.6.0**, run `31686161607`. If `gh` is missing it falls back to the repo value and says loudly
that it is guessing. Reading `VCC_VERSION` from the repo would have reproduced the exact mistake
the tool exists to catch: repo was 2.5.0 while live was 2.4.0 for all of 2026-08-12.

**It mirrors Conti's PHP, so it can rot silently — which is this tool's own subject matter, so
guarding it wasn't optional.** `--selftest` asserts the six behaviours the simulation leans on
directly against `vc-clients-embed.php`: the slots.json path, the `_`-prefix skip, the
empty-not-absent fallback guard, the hyphen-less strip regex, `vcc_fetch`'s non-200 handling, and
the flat-key `str_replace`. Six of six green. Run it after any plugin change.

DONE: 2026-08-13 · **Proved the detector detects before believing a word of it.** When I started,
**zero** sections had a `{{token}}` — so a checker that did nothing would also have printed "all
clean", and I'd have had no way to tell the difference. Seven synthetic sections in `fixtures/`,
one per failure mode, 3 clean / 4 with findings, each firing exactly its own finding. The
sharpest is the regression reproduced from the version number alone: identical files, `--plugin`
2.6.0 → clean, 2.5.0 → both tokens deleted.

FOUND: 2026-08-13 · **Two silent traps, neither live, both one typo away.** (1) The strip regex
`/\{\{[a-z0-9_]+\}\}/i` **has no hyphen in the class**, so `{{cta_label}}` with no slot is
*deleted* while `{{cta-label}}` with no slot **renders literally on the live page**. Same typo
class, opposite symptom. (2) The fallback at `:182` is `if ( ! $slots && … )` — **emptiness, not
absence** — so a `slots.json` holding only `_`-prefixed doc keys parses fine, hands over nothing,
and the plugin silently uses the inline block instead. The file that looks like the source isn't.

NEED: 2026-08-13 · **One gated page load, and it needs Sean's password, not mine.**
`community-partner` is 3/3 filled and clean, but step 3 deleted the inline block, so `slots.json`
is now its only source. `vcc_fetch` caches nothing on failure (good) but writes its week-long
`_stale` copy **only on success** (`:85`) — so until the *plugin itself* has fetched that file
once, a transient blip strips all three tokens and the band renders with an empty button and an
empty line. **A curl from this chat does not warm WP's transient**; only a real render does. So
"the CDN serves it" — all I can prove — is not "`_stale` is populated". Load `/community/` once
behind the gate and the CTA is the discriminator @finn already identified. Full writeup in
`work/dee/slot-plugin-check/FINDINGS.md`.

QUESTION: 2026-08-13 · **Raised the `compose.mjs` overlap with @finn instead of quietly forking.**
@conti said don't fork it; I haven't, and I can't import it either — it's a script whose `main()`
runs on import, and changing that means editing Finn's file. The jobs do differ (his renders a
page byte-faithfully and carries the escaping; mine answers a structural question and never needs
it), but ~20 lines of source-resolution are now mirrored twice, and two mirrors of one PHP
function drifting silently is precisely this tool's subject. Asked Finn to pick: export the
primitives from `compose.mjs` and I import them (my preference — his file is older and more
used), or the reverse, or accept it and rely on `--selftest` on both sides.

DONE: 2026-08-13 · **Dee's seat is live.** Clone verified from git config, not from the path:
`fc.chat=dee`, `core.hooksPath=.githooks`, `fc.enforce=warn`, `--git-common-dir` = `.git` (a real
clone, not a worktree). On local disk — `~/Documents` resolves to itself, no `CloudStorage`
redirect. Read `CLAUDE.md`, `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md`,
`notes/tasks.json`, `work/README.md`, `HANDOFF.md`. `work/dee/` is empty apart from `.gitkeep`,
and no board task is owned by `dee`, so I'm idle and waiting on an assignment.

DONE: 2026-08-13 · **Tested the territory guard rather than trusting the config.** Staged a new
file at `kit/.dee-guard-test` (conti's), ran `.githooks/pre-commit` directly, and it named the
file, the owner and the matching rule (`kit/`), then exited 0 with `(warn mode — commit
proceeding)`. Unstaged and deleted it; nothing committed, tree clean. So the guard is wired and
it is genuinely advisory right now — `territory-block-mode` is the task that closes that, and it
wants all clones flipped together.

NEED: 2026-08-13 · **The chat session driving this clone runs from a `git worktree` of it, not
from the clone itself.** Session cwd is
`~/Documents/Claude/_Code/brg-web-dee/brg-dee-helper-setup-5678b3`, on branch
`claude/brg-dee-helper-setup-5678b3`, whose `--git-common-dir` is
`~/Documents/GitHub/brg-web-dee/.git`. Benign in itself — it's *my own* clone, so the shared
`fc.chat=dee` is telling the truth, which is exactly the case `CLAUDE.md` warns can lie. Two
things follow and they're the reason this is logged rather than shrugged off: the two trees share
one git dir, so a commit made in either is visible to both; and the worktree sits on a side branch
while the clone sits on `main`. **I work in the clone (`~/Documents/GitHub/brg-web-dee`, on
`main`) and push `HEAD:main` from there** — the worktree is left alone. Saying it out loud per
`CLAUDE.md` so nobody later reads a commit from this seat and wonders which tree it came from.
