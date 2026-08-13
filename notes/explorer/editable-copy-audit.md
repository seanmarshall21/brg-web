# SPEC-008 — What else assumed the copy was ours

**Status:** proposed · Explorer · 2026-08-13 · follows the `.ln` clipping fix
(`brgw.css:162`, approved by Conti the same day)

Conti named the category when he approved that fix: **making something editable doesn't just add
a feature — it promotes every latent assumption about that content into a live risk.** The `.ln`
mask was one instance (Blanco's `é` is 1.132em against a 1.034em mask, harmless while I'd
measured all the copy, not harmless once Sean can type). This is the answer to the obvious next
question: *what else assumed the copy was ours?*

I audited the 16 `slots.json` files and the 18 fragments. **Three findings, and the first one is
already wrong on the live site** — it isn't a future maintenance risk, it's a present
inconsistency that going editable will now make harder to see, not easier.

**Nobody did anything wrong here.** Finn's `doc` on `bnb_body_2` already says *"Carries the live
location count, so it needs editing whenever that changes."* — the trap was spotted locally, in
the one field where it was visible. What's missing is a **cross-section** view, and no file in
the project has a place to hold one.

---

## 0. The structural point, first

Before ACF, the location count was three greppable strings in git. Any chat could find all three
in one command, and drift between them was a diff away.

**It is now three rows in a WordPress database.** The repo defaults record only what the copy
*was* on the day it was wired. Nobody greps a database, `build-acf.py --check` compares repo to
repo, and Dee's `slotcheck` reads the CDN — so it can prove a token gets *a* value, never that
the value agrees with the value in another section.

> Going editable didn't create the duplication. It **removed the only tool that was catching
> it**, and it did so silently.

That's the general shape, and it's why the recommendation in §4 is *delete the duplicates*
rather than *keep them in sync*.

---

## 1. The location count lives in three editable places — and they already disagree

| Where | Editable? | What it says |
|---|---|---|
| `community-stats` · `stat_1_fig` + label | **yes** | **`12`** — "locations embedded in SD & OC communities" |
| `home-community` · `body_2` | **yes** | "Today, BRG operates **12 Board & Brew** locations across San Diego and Orange County, **plus Odie's Pizza Co.** in Oceanside" |
| `our-restaurants-brands` · `bnb_body_2` | **yes** | "**12 locations** across San Diego and Orange County — each one a neighborhood staple." |

**The disagreement is live today.** `home-community` is explicit that 12 counts **Board & Brew
only**, and that Odie's is *additional*. `our-restaurants-brands`' 12 is inside the Board & Brew
block, so it agrees. But `community-stats` presents that same 12 as **BRG's** community
footprint — and by the site's own arithmetic BRG operates **13**.

So the one figure on that page we've been treating as *already true* — the one I called "real"
in [SPEC-007 §2](content-gaps.md), and I was wrong to — is either understated by one or
mislabelled. Two clean fixes, and it's a content call, not a code one:

- **`13`** / "locations across SD & OC communities", counting the group; or
- **`12`** / "**Board & Brew** locations embedded in SD & OC communities", counting the brand.

I'd take the first: it's a stat about **BRG**, on BRG's community page, and undercounting your
own footprint on the page arguing you're embedded in the community is a strange place to be
modest. Either way it needs saying out loud, because it's the number Sean is least likely to
check — it's the one that was never `XX`.

**And the maintenance cost is now real:** opening a 13th Board & Brew is **three separate edits,
on three sections, across three pages**, with nothing in wp-admin connecting them.

## 2. The brand's own name disagrees with itself

`our-restaurants-brands` · `odies_name` has the canonical default **`Odie's Pizza`**. The prose
in two other editable slots calls it **`Odie's Pizza Co.`** — `home-community` · `body_2`
("plus Odie's Pizza Co. in Oceanside") and `our-restaurants-brands` · `odies_body_1`
("Odie's Pizza Co. brings sourdough pies…"), which is *the same file as the name field*.

A brand-name field is the most canonical thing on the page. If it's the short form and every
sentence uses the long form, one of them is wrong, and only Sean knows which. Trivial to fix,
and worth fixing before anyone builds Press — press cards carry outlet and brand names, and a
site that can't spell its own brand consistently is the kind of detail a journalist notices.

*(Also in `our-restaurants-brands` · `odies_body_2`: "more locations are on the way." That's a
forward-looking claim with no expiry — SPEC-007's Rule 2 family. It doesn't decay on a clock, it
decays on Sean's plans, so it wants a review date rather than a rule.)*

## 3. `home-community` is half-editable, which is its own hazard

The fragment's three body paragraphs are **not** equally exposed:

```
embed.html:55   <p>…Since 2013, we've been growing a family of restaurant brands…</p>   ← LITERAL
embed.html:56   <p>{{body_1}}</p>                                                       ← editable
embed.html:57   <p>{{body_2}}</p>                                                       ← editable
```

An editor in wp-admin sees two of the three paragraphs and has **no indication the first one
exists**. Rewrite the founding story in `body_1` and the invisible paragraph above it can
contradict you, with nothing on the options page to explain why.

I'm not arguing paragraph 1 should be slotted — it carries `<strong>` markup and "Since 2013" is
a durable absolute, so leaving it in git is defensible. **The gap is that nothing tells the
editor it's there.** One line in the `body_1` `doc` closes it.

---

## 4. What I'd do

**Don't sync three copies of the location count. Delete two.**

A fact with one home can't drift. `community-stats` is a stat section — a number is what it's
*for* — so let it be the only place a location count appears, and rewrite the other two so they
carry the claim without the arithmetic:

- `home-community` · `body_2` → "Today, BRG operates **a growing family of Board & Brew
  locations** across San Diego and Orange County, plus Odie's Pizza Co. in Oceanside — and we're
  just getting started."
- `our-restaurants-brands` · `bnb_body_2` → "**Neighborhood staples across San Diego and Orange
  County** — each one a local fixture."

That's one edit when the 13th opens instead of three, and there's no version of the site where
two numbers contradict each other. Slightly softer copy is the price, and on a page that already
says "we're just getting started" it reads as intent rather than vagueness.

**Where a fact genuinely must appear twice, cross-reference it in the `doc`.** `doc` strings
surface in wp-admin as field instructions, so this puts the warning *where the editing happens*
rather than in a file nobody opens. Finn already writes these; the change is making them
**bidirectional** — each copy names the others. Costs nothing and needs no code.

**A shared-facts `--check` — I proposed one, and Conti has ruled it out. He's right.** It could
only compare `slots.json` **defaults**, i.e. *"the copy we recorded on wiring day agrees with
itself"*. It cannot see the live WordPress values — the limit Dee hit with `slotcheck` and Finn
flagged on `build-acf.py --check`. His argument for killing it rather than labelling it: **green
would read as "the numbers agree", which is the strongest claim it structurally cannot make** —
and a green that gets misread is the exact failure this whole spec is about. Better no check than
one whose pass is a lie. **Ruled out as a decision, not deferred**, so nobody revives it later as
an unfinished idea.

---

## 5. Asks, and where each one landed

Conti ruled on 2026-08-13, in the same turn he verified §1 against the files rather than taking
my word for it.

| Ask | Owner | Outcome |
|---|---|---|
| Rule on the location count: `13` (group) or `12` + "Board & Brew" (brand) | **sean** | **open** — verified by Conti; our own copy contains the correction |
| `Odie's Pizza` or `Odie's Pizza Co.` — pick one | **sean** | **open** |
| Collapse the count to one home (§4 rewrites) | finn (`slots.json` defaults) | **approved as architecture** by Conti — *one fact, one home*, the same rule as one-owner-per-file applied to facts. **But the rewrite is copy, so the wording is Sean's gate**, not Conti's |
| Bidirectional `doc` cross-references for facts that must repeat | finn | ✅ **approved and sent to Finn** — editor guidance, invisible to visitors, so integration not design |
| One line in `home-community` · `body_1` `doc` naming the literal paragraph above | finn | ✅ same approval (§3) |
| Shared-facts `--check`, labelled defaults-only | conti (`kit/`) | ❌ **ruled out, not deferred** — see above. My proposal, his correction, and he has the better of it |

None of it blocks launch. The two open items are Sean's gate and are two decisions, not two
projects.

**Correction, 2026-08-13:** the first version of this spec put the location count in
`home-community` · **`body_1`**. It's **`body_2`** — Conti caught it verifying §1. `body_1` is
*"We're not a corporation chasing locations…"*, a different paragraph entirely, so the §4 rewrite
applied to `body_1` would have overwritten the wrong copy and left the count untouched. Fixed at
every occurrence above. The §3 ask deliberately still names `body_1`, because that's the slot
sitting directly beneath the literal paragraph an editor can't see.
