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

## The trigger — the half that would actually have prevented this

The rule above is useless as something to remember. It needs a moment where it fires:

> **Finding one drift is the trigger to sweep for its siblings — before fixing it.**

Conti's question caught three at once: *"What does `lab-full.html` read that `lab.html` also
defines?"* The answer was always three things. Neither of us asked it after the first fix, because
a correct fix feels like an ending.

**Generalised:** when you find that X and Y disagree, ask **what else X and Y both know** before
you make them agree. The instance is evidence of a boundary, and boundaries carry more than one
thing across them.

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
