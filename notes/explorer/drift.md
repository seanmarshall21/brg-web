# SPEC-011 — Knowledge held twice will drift

**Status:** proposed · Explorer · 2026-08-18 · requested by Sean: *"Please find a solution to these drifts."*

Eight instances in two days, at four different scales. Each was fixed correctly and none of the
fixes generalised, because each time the fix ended the search.

## The rule

> **Any knowledge held in two places will drift, at whatever scale it is held** — a file, a data
> structure, a function, a two-line method, a number in a document.

I fixed the first three as *data* duplication and felt finished each time. It is not a data
problem. `attachBox` was **two lines of behaviour** in two methods, and it drifted exactly as the
card list did.

## The fix, in preference order — and only the first is a solution

| | Mechanism | What it gives you |
|---|---|---|
| **1** | **Delete the copy** | Drift becomes **impossible** |
| 2 | **Derive it** — one source, regenerated, build refuses stale output | Drift becomes *detectable at build time* |
| 3 | **Stamp it** — provenance + a check that fails | Drift becomes *detectable later* |
| 4 | **Name it** — a comment saying where the twin is | Drift becomes *findable in 20 minutes instead of 3 hours* |

**Only 1 removes the failure. 2–4 are mitigations and should be described as such** — a guard is
not a fix, and the pre-push handoff warn does not stop `website/kit/lab.html` diverging, it tells
you afterwards.

**Prefer dissolving the constraint to guarding it.** When Conti proposed generating `lab-core.js`
from `lab.html`, the better answer was one shared file — two copies plus a mechanism is worse than
no copies and no mechanism.

## Revision, 2026-08-18 — tiers 3 and 4 are weaker than I rated them

**An output-only guard can be defeated by a pipe.** Conti's handoff warn **fired correctly** on
the push that shipped the stale `lab-cards.js`. He never saw it: his push command ends
`| tail -1`, which keeps the last line and discards everything above it.

**I do the same thing.** Every push I have made in this project ends `| tail -1`. That discards
six lines of `pre-push` output — including, on several pushes, the handoff lines telling me my
own files had diverged. The guard worked, reported, and was thrown away, twice, by two people
who had each just written a rule about checks that cannot fail.

> **A guard whose only effect is output is optional in practice.** A non-zero exit cannot be
> discarded by a pipe; a printed warning can, and "read more carefully" is not a fix for it.

So the preference order needs a qualifier rather than a rewrite:

| Tier | | Real strength |
|---|---|---|
| 1 | Delete | drift impossible |
| 2 | Derive | build refuses — **non-zero exit, cannot be piped away** |
| 3 | Stamp + check | **only as strong as the check's exit code.** Report-only = optional |
| 4 | Name | documentation; never a control |

**This does not overturn *refuse when you might destroy something, report when you can only
inform*** — Conti's reading is right. That rule covers a check whose failure costs a reader
nothing. This one put a wrong page in front of Sean for several rounds, and **a partial fix reads
as a failed fix**, so his next report would have been *"the colour thing is still broken"* about a
file that was already correct. The cost was not zero, so the guard should not have been
report-only.

`check-drift.py --strict` now blocks in `pre-push`, with `FC_ALLOW_DRIFT=1` for a genuine
mid-edit tree.

## A test must be able to tell its intended failure from a crash

Conti's first version of the hook referenced an undefined `$py`. Under `set -u` that aborted, so
a clean tree exited 1 — and his **make it fail on purpose** test passed **for the wrong reason**.
Right test, wrong cause, and it only surfaced because the clean run printed no `drift` line at all.

> **A test that cannot distinguish its intended failure from a crash is not a test.** Assert on
> *why* it failed — the message, the named pair — not merely that it did.

This is the same family as SPEC-010's blind instruments, one level in: there, the tool could not
see; here, the *test* of the tool could not see which failure it had caused.

## Chosen boundaries and imposed ones

Three pairs survived at tier 3–4 because they cross a boundary we cannot delete. That was too
neat. **Only two of the three are imposed** — Netlify's deploy, and a licensed theme outside the
repo. The third is **territory**: `website/kit/` is Conti's and `notes/explorer/studies/` is mine,
and the copy exists purely to move a file across that line.

> **That boundary is one we chose.** It is the only one of the three where the honest statement is
> *"we could delete this and haven't."*

Worth stating so a later reader does not file it beside the deploy as unavoidable: **if the
territory map ever puts one seat on both sides of that line, the pair should be deleted rather
than re-gated.**

## The trigger — the half that would actually have prevented this

The rule above is useless as something to remember. It needs a moment where it fires:

> **Finding one drift is the trigger to sweep for its siblings — before fixing it.**

Conti's question caught three at once: *"What does `lab-full.html` read that `lab.html` also
defines?"* The answer was always three things. Neither of us asked it after the first fix, because
a correct fix feels like an ending.

**Generalised:** when you find that X and Y disagree, ask **what else X and Y both know** before
you make them agree. The instance is evidence of a boundary, and boundaries carry more than one
thing across them.

## A gate must not fire on the steady state

`check-drift.py --strict` blocked **my** push for a divergence only **Conti** can resolve —
`website/kit/` is his. And the three `copy` pairs diverging is not a fault at all: **it is the
handoff's steady state**, between the author building and the promoter promoting.

> **A gate that fires on the normal condition is not strict, it is noise** — and an escape hatch
> typed reflexively on every push is worse than no gate, because the line above it stops being read.

Same argument that kept `build-acf.py --check` permissive on a partially-missing section tree.
The fix is `--owner`: **everything is reported, only your own pairs can block you.** A divergence
you cannot fix stays visible rather than being filtered out of sight — you should know the
deployed copy is stale even when promoting it isn't yours to do.

Conti wired `--owner "$(git config fc.chat)"` into `pre-push` **before I supported the flag**,
relying on membership-based arg parsing to ignore it until then. Worth recording as a technique:
**a forward-compatible flag lets two owners land a two-sided change in either order**, with no
window where one half is waiting on the other and no second commit for either to forget.

### And then I built exactly the failure I had just written down

`--owner` was right and its rendering was not. `pre-push` does:

```sh
elif out=$(python3 "$DRIFT" --strict --owner "$(git config fc.chat)" 2>&1); then
  say "drift" "OK"        # <- $out discarded
```

So with two `conti`-owned pairs stale, the checker correctly exits 0 — *not mine to fix* — and
the hook prints **`OK`**, throwing away a report that names both. **"Nothing is stale" and
"something is stale but not yours" are indistinguishable to the caller.**

That is how I told Sean section E was live when it had never been promoted. I read `drift OK`
and believed it — **one day after writing that an output-only guard can be defeated by a pipe.**
This is the same defect one turn further in: not discarded by a pipe, discarded by a branch.

> **A guard must not render "clean" and "not your problem" the same way.** Filtering *what blocks
> you* is correct; filtering *what you are told* is not. Exit code answers "may I proceed" — it
> must never be the only carrier of "is anything wrong".

Fix is one line in the hook — print `$out` when it mentions `DIVERGED`, whatever the exit code —
and it is Conti's file. My side already prints the count; it was simply never shown.

## The register

`notes/explorer/studies/drift-register.json` + `check-drift.py`. Every pair where one fact is
knowingly held twice, with its mode (`derive` / `copy` / `transcribe`), its owner, and its guard.

**The register is the deliverable; the checker is the easy part.** Every drift this project has
had was *unregistered at the time it drifted* — so the value is in the act of writing a pair down,
which forces the sweep question, not in the script that compares them.

**Stated limit, because a green run must not read as "no duplication":** it checks **registered**
pairs only. It cannot find duplication nobody wrote down. That is not a flaw to be fixed by a
cleverer script — it is the reason the trigger question above is the primary defence and the
register is secondary.

**It earned its place on first run**, which is the argument for it: writing the register out
immediately surfaced a **live, user-visible bug neither Conti nor I had noticed** — `lab-cards.js`
deployed still carried `style="color:…"` where the source had `--strokec`, so the colour fix was
**half-promoted** and A5/A6 were still tinting their text on the live site. One command, one fact
nobody knew.

## Applied to the eight

| Instance | Scale | Fix applied | Tier |
|---|---|---|---|
| Deployed lab vs source | file | one-directional handoff + warn | 3 |
| Card list in two files | data | **deleted** → `lab-cards.js` | **1** |
| Artwork in two files | data | **deleted** → `lab-lines.js` | **1** |
| `sv(k)` signature | interface | **deleted** with the artwork | **1** |
| `attachBox` knowledge | method | **deleted** → one function | **1** |
| Centrelines vs artwork | derived | `--check` on `src_sha` | 2 |
| Baked paths in `lab.html` | derived | provenance stamp | 3 |
| Salient values | transcribed | cite the source; **unguardable** | 4 |

Five of eight reached tier 1. The three that did not are the three where the two copies live on
opposite sides of a boundary we do not control — a deploy, a re-export, a licensed theme outside
the repo. **That is the real predictor: duplication that survives is duplication that crosses a
boundary you cannot delete.**

## Asks

| Ask | Owner |
|---|---|
| Promote `lab-cards.js` — it is diverged **now**, and A5/A6 tint on the live site because of it | **conti** |
| Consider `check-drift.py --strict` in `pre-push`, replacing the per-pair handoff warns with the register | conti |
| Register any pair I own before it drifts, not after | expo |
