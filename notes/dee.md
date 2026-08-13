# Notes — DEE (side tasks / prep)

**Single writer: the Dee chat only.** Others READ this; they write their own `notes/*.md`.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = DONE / PLAN / NEED / QUESTION).

You own `notes/dee.md` and `work/dee/` — nothing in production. Build in `work/dee/`, then hand
finished work to whoever owns the destination via `notes/roundtable.md`; **they** promote it.
See [`work/README.md`](../work/README.md) for why it works that way.

---

DONE: 2026-08-13 · **`--selftest` caught a live mirror drift within the hour, which is the
whole argument for it.** Importing @finn's grammar and *checking it against the plugin* rather
than trusting it fired immediately: @conti shipped **v2.6.1** (`04a03a8`) widening the strip class
to `[a-z0-9_-]` so a hyphen typo is seen and stripped rather than displayed. Plugin and
`build-acf.py:108` moved; **`compose.mjs` did not**. Three of four layers agreed, and the
disagreeing one was the reference mirror. **2.6.1 is deployed** (run `31688155274`), so this was
live behaviour, not a repo-only gap.

**The consequence is that the token grammar is now version-dependent, which a single constant
cannot express** — the same typo has opposite symptoms either side of the line: `{{cta-label}}`
undeclared *renders literally* at ≤2.6.0 and is *silently deleted* at ≥2.6.1. Handled by deriving
the grammar from the version and having `--selftest` check that derivation **behaviourally**
against the class lifted out of the plugin's own `preg_replace`, on probes chosen to straddle the
boundary. Finn has since split the export into `TOKEN_STRIPPABLE` (what the strip can match) and
`TOKEN_SLOT_NAME` (what a slot may legally be named) — same set until 2.6.1, different questions
always — and I now import both explicitly. The pre-2.6.1 strip class stays defined **locally**:
it coincides with `TOKEN_SLOT_NAME` as a set but means something different, and borrowing it
would be the exact conflation the split was made to prevent. It describes a retired version, so
it is frozen and cannot drift.

**Finn asked for my selftest to assert *his* primitives too** — "I'd rather your test fail on my
drift than have me find out by message next time" — so it does, as hard failures rather than
informational: `TOKEN_STRIPPABLE` against the PHP's class, `TOKEN_SLOT_NAME` against the ACF
field-name rule it actually promises, and **`TOKEN_ANY` asserted to remain LOOSER than the strip
class**, because the instant they agree, tokens the plugin can't see become tokens this tool
can't see either and the whole "renders literally" class goes dark. Ten checks, all green.

**Promoted the bad-slot-name finding from WARN to a failing verdict**, on Finn's prompt and with
a reason I'd defend independently: every other guard passes it. The token fills (str_replace is
literal), and `build-acf.py --check` goes **green** because `used` matches hyphens too, so both
set differences are empty. What breaks is downstream and silent — `brg_<id>_cta-label` isn't a
legal ACF field name, so the field won't save and the slot is uneditable in wp-admin. That's the
INERT symptom by another route, so it takes INERT's severity.

FIXED: 2026-08-13 · **My own FINDINGS prose had gone stale again, in four hours, on the exact
sentence I'd written to warn about staleness.** The "two traps" section used the hyphen as its
example of *renders literally*, and 2.6.1 inverted precisely that case. Rewrote it around the
mechanism (inside the strip class → deleted; outside → survives) with the version-dependence in a
table, and left a marker saying why rather than quietly editing. Third instance today of the same
shape — the `_stale` claim, the quoted `ok-wired` output, now this. **The pattern is that the
durable artifact keeps asserting the old fact long after the fact moved, and the only real
defence is making the claim re-derivable**: the fixtures survived all three because they are run,
not read. Finn made the same point from his side — he'd swapped a regex and two warning strings
with nothing asserting he hadn't broken the mirror in the other direction.

DONE: 2026-08-13 · **Closed the `compose.mjs` duplication — `slotcheck` now imports @finn's
`slotsFor` instead of mirroring it.** He took option 1 and exported the primitives (`6aa0722`),
so the ~20 lines I'd flagged are gone rather than merely documented. Split: Finn owns *what a
section's slots are*; I own *at what plugin version, from which source, and is that a problem*.
The version gate rides on his `mode` (`'local'` prefers slots.json, anything else is inline-only
= a pre-2.6.0 plugin) rather than forking his branch, and `read` is injected so the same
resolution runs against CDN / repo / fixtures. Crucially **`source` is now derived from what
`slotsFor` actually returned**, by comparing it to the candidates — not decided a second time, so
this file cannot disagree with the resolution it is describing.

**The fixtures earned their keep on exactly the change they were built for.** Every verdict is
identical across the import — 3 clean / 4 findings, and the 2.5.0 regression still reproduces.
Without them, "I refactored the resolution and it still looks fine" would have been an opinion.

**And the exchange paid for itself: Finn's mirror was already wrong**, in the way the tool
predicts. `slotsFor()` returned `{}` on a parse-success-but-empty-after-`_`-filtering file
instead of falling through, diverging from `if ( ! $slots && … )` at `:182`. The tool built to
catch silent divergence caught one in the reference implementation on day one.

FIXED: 2026-08-13 · **My own docs had gone stale, which is the failure I keep warning about.**
FINDINGS.md quoted a 2.5.0 run of `ok-wired` that no longer reproduced — I'd given that fixture
an inline fallback *after* writing the doc, so the quoted output was true once and wasn't any
more. Re-ran and quoted the real text. It is a **better** demo than the one I lost: at 2.5.0
`ok-wired` fills **2/2 from the inline block while silently ignoring slots.json** — it looks
healthy and is one `sections.json` deletion (step 3 of the standard wiring order) from blank.
That is the dangerous shape, and it is the argument for reporting the resolved source on every
section rather than only the broken ones. Kept the strip-everything shape too, on a fixture with
no inline block. **Same lesson family as the `_stale` correction: quoted tool output is a copy,
and copies go stale silently — re-run before shipping the doc.**

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

CORRECTED: 2026-08-13 · **The NEED below is withdrawn — I was wrong, and @conti had already done
the thing I was asking for.** I claimed a curl can't warm WordPress's transient. A curl of the
**CDN** can't; a curl of the **WordPress page** is a real server-side render, so the plugin runs,
`vcc_fetch()` fires and the success path writes `_stale`. The client is irrelevant to
server-rendered PHP. I conflated the two origins.

I verified the inference rather than just accepting the correction, because it's the load-bearing
part. **It holds.** The one way it could fail is the primary transient outliving `_stale`, and
that's impossible here: **`VCC_TTL` = 120s (`:36`) vs a one-week `_stale` (`:85`)**. So all three
render paths imply `_stale` is populated — a fresh fetch writes both; a primary-transient hit is
≤120s old and was created by a call that also wrote `_stale`; and the failure path can only
return `_stale` by reading it. Conti's two renders are therefore proof, and **both sections are
covered for a week**. Nothing is waiting on Sean.

The **mechanism** and the **standing-shape** half of the finding survive and are the useful part:
zero of 18 sections carry an inline block, so every future wiring has no net until its first
successful render. Conti owns that as a rule now. Fixed the wrong claim in three places — most
importantly `slotcheck`'s own `WARN` text, which had it baked in and would have gone on repeating
it to whoever ran the tool next. Lesson worth keeping: **an error inside a tool's output outlives
an error in a note**, so that's the copy to correct first.

~~NEED~~: 2026-08-13 · **One gated page load, and it needs Sean's password, not mine.**
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
