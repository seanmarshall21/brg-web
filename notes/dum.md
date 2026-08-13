# Notes — DUM (side tasks / prep)

**Single writer: the Dum chat only.** Others READ this; they write their own `notes/*.md`.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = DONE / PLAN / NEED / QUESTION).

You own `notes/dum.md` and `work/dum/` — nothing in production. Build in `work/dum/`, then hand
finished work to whoever owns the destination via `notes/roundtable.md`; **they** promote it.
See [`work/README.md`](../work/README.md) for why it works that way.

DONE: 2026-08-13 · **First delivery — the LinkedIn company URL for `careers-posts`, plus three
things that came out of verifying it.** `work/dum/careers-posts-urls/FINDINGS.md`. Expo flagged
this as the only part of `careers-posts-urls` not waiting on a decision, and offered it to
whoever got there first. Slug is **`blacktop-restaurant-group`**; the link to use is
`https://www.linkedin.com/company/blacktop-restaurant-group/jobs/`. **Verified by fetching both
URLs, not by reading a search snippet** — and specifically that `/jobs/` renders openings to a
logged-out visitor, since a link that dead-ends at a login wall is no better than the
`/careers/` self-link it replaces.

Three findings I did not expect, in order of how much they change the task:

**(1) The postings are live, not stale — but the maintenance debt is real and already visible.**
Both roles named in the fragment (People & Culture Manager, Payroll & HRIS Manager) are still
open on LinkedIn today, so the card copy is more accurate than the fragment's own header comment
assumes. But a **third** opening — People & Culture Director — is live and absent from the page.
That is the hand-maintained-feed failure mode having already occurred once, silently. It's the
strongest available argument for linking the company jobs page rather than per-post URLs, and it
is evidence rather than prediction.

**(2) Per-post URLs are a trap, not an optimisation.** Expo called them "an optimisation on top,
not a prerequisite." I'd go further: I could not reliably retrieve stable job ids for the two
roles that are in the fragment, while the postings are *open*. If a URL is that hard to get now,
it will not be re-got when the posting is replaced. Recommend ruling them out for good.

**(3) Two negatives worth as much as the positive.** `834 followers` **cannot be verified — the
count is behind a login wall.** That argues Expo's "delete both stamps" call better than an
opinion can: a number nobody can check without an authenticated session is a number nobody will
check. And **LinkedIn cannot supply the headcount** Expo's SPEC-007 §2 wants for
`community-stats` — the page gives a band (*51–200 employees*), not a number, and the one
aggregator figure I saw (44) contradicts the band and is unsourced. Recorded so nobody spends
that lookup again; it has to come from HR, exactly as Expo said.

Patch is two identical lines (`embed.html:63` and `:78`), written out in §4 of FINDINGS with the
`target`/`rel` question flagged as Finn's call rather than assumed. Confirmed the section has
**zero `{{tokens}}` and no `slots.json`**, so this cannot collide with `acf-slot-tokens` or its
priming rule. Deliberately kept separable from the stamp deletion, which is Sean's gate — the
dead control can be fixed without waiting on that ruling.

DONE: 2026-08-13 · **Tested the territory guard in both directions rather than trusting the
config.** Staged `kit/.dum-guard-test` (conti's): the hook named the file, named conti as owner,
quoted the matching rule (`kit/`), and exited 0 with `(warn mode — commit proceeding)`. Then
staged a file under `work/dum/` and the hook passed silently. Both probes unstaged and deleted;
tree clean, nothing committed. So the guard is wired **and** it discriminates — a hook that
warned on everything, or on nothing, would look identical from one test. `territory-block-mode`
is the task that makes it bite, and it wants all clones flipped together — that's now **five**
clones (conti, finn, expo, dee, dum), not four.

DONE: 2026-08-13 · **Dum's seat is live.** Verified from git config, not from the path:
`fc.chat=dum`, `core.hooksPath=.githooks`, `fc.enforce=warn`, `pull.rebase=true`, and
`--git-common-dir` = `.git`, i.e. a real clone rather than a worktree. On local disk —
`~/Documents` resolves to itself with no `CloudStorage` redirect. Pulled to `e139c79`. Read
`CLAUDE.md`, `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md`, `notes/tasks.json`,
`work/README.md` and `notes/dee.md`.

NEED: 2026-08-13 · **The chat session driving this clone starts in a `git worktree` of it, not in
the clone — same as Dee, and I've made the same call.** Session cwd is
`~/Documents/Claude/_Code/brg-web-dum/brg-dum-helper-setup-6a85ab`, on branch
`claude/brg-dum-helper-setup-6a85ab`, whose `--git-common-dir` is
`~/Documents/GitHub/brg-web-dum/.git`. This is the case `CLAUDE.md` warns can lie — a worktree
shares one git config, so `fc.chat` may describe a different chat than the one you are. **Here it
doesn't lie:** the worktree belongs to my own clone, so `fc.chat=dum` is true in both trees. I
still **work in the clone (`~/Documents/GitHub/brg-web-dum`, on `main`) and push `HEAD:main` from
there**, leaving the worktree alone — matching Dee, so two helper seats don't produce commits
from two differently-shaped trees. Saying it out loud per `CLAUDE.md` so nobody later reads a
commit from this seat and wonders which tree it came from.
