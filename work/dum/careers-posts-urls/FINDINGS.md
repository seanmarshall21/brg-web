# careers-posts — the LinkedIn URL, and what the live postings actually say

**Built by:** dum · 2026-08-13 · `work/dum/careers-posts-urls/`
**For:** @finn (owns the fragment) · @sean (owns the content call) · cc @expo (asked for this)
**Board task:** `careers-posts-urls` (owner sean, gate sean)

Expo asked for one fact — *"BRG's LinkedIn company slug, so `careers-posts`' two `View job`
buttons can point at the company jobs page instead of at `/careers/` — the page they're already
on"* — and noted it's **the only part of that task that doesn't wait on a decision**
(`notes/roundtable.md`, 2026-08-13). This is that fact, plus three things I found while
verifying it that change the shape of the rest of the task.

Nothing here is promoted. `website/sections/` is Finn's; §4 is the patch, to apply or reject.

---

## 1. The answer

| | |
|---|---|
| **Company slug** | `blacktop-restaurant-group` |
| **Company page** | `https://www.linkedin.com/company/blacktop-restaurant-group` |
| **Jobs page — the one to link** | `https://www.linkedin.com/company/blacktop-restaurant-group/jobs/` |

**Verified by fetching both URLs, not by reading a search snippet.** Both resolve to the real
page without a login. The company page returns: *Blacktop Restaurant Group* · Encinitas, CA ·
Restaurants · 51–200 employees · tagline *"San Diego's culture-first restaurant group | Board &
Brew + Odie's Pizza Co. | Make Your Day Great! ⚡"* · founded 2013 by Clayton Wheeler and Craig
Applegate. That's BRG, not a same-name company.

The `/jobs/` subpage renders its openings to logged-out visitors, which is the property the link
actually depends on — a link that dead-ends at a login wall would be no better than the
`/careers/` self-link it replaces.

---

## 2. The finding that changes the task: the postings are **live**, not stale

The fragment's own header comment and the board both treat these cards as marketing renderings
that "will go stale." As of today they have not. The jobs page lists three open roles:

| Live on LinkedIn today | In the fragment? |
|---|---|
| People & Culture Manager — San Diego, CA | ✅ card 1 |
| Payroll & HRIS Manager — San Diego, CA | ✅ card 2 |
| **People & Culture Director** — San Diego, CA *(temporary)* | ❌ **missing** |

Two consequences, and they point in opposite directions:

**The cards are more accurate than anyone assumed.** Both roles named in the markup are still
open. Nobody needs to rewrite the card copy — the risk everyone has been managing is not yet a
live defect.

**But the maintenance debt is already accruing, and this is the proof.** A third opening exists
that the page does not show. That is exactly the failure mode of a hand-maintained feed, and it
has *already happened once* — silently, with nobody noticing, which is the point. It is the
concrete argument for Expo's recommendation: link the **company jobs page**, which is correct
for all three roles and stays correct when a fourth opens or the first closes, rather than
per-post URLs that pin the page to a moment.

---

## 3. What I could **not** verify — and why each negative is useful

**Per-post job URLs: not reliably retrievable.** Only one BRG job id surfaced
(`4359022919`, People & Culture Director — the role *not* in the fragment). The two roles that
*are* in the fragment did not yield stable ids. Rather than a gap in this research, treat it as
a third independent argument against per-post links: if a URL is this hard to obtain while the
posting is open, it will not be re-obtained when the posting is replaced. **Recommend the
company jobs URL and drop per-post links as an "optimisation" entirely** — Expo called them an
optimisation on top; I'd call them a maintenance trap.

**`834 followers`: cannot be verified — the follower count is behind a login wall.** I could not
confirm or refute it from a logged-out fetch. This is a small fact that argues for Expo's
"delete both stamps" call more strongly than an opinion could: **a number that requires an
authenticated session to check is a number nobody on this project will ever check.** It will
drift, and its drift is invisible from outside. Same logic applies to `2mo` / `5mo`.

**Headcount — a negative that closes off a tempting shortcut.** Expo's SPEC-007 §2 proposes
*team headcount across SD & OC* as the second `community-stats` figure. **LinkedIn cannot supply
it.** The company page shows the band **51–200 employees**, which is not a number; a third-party
aggregator claimed 44, which contradicts the band and is unsourced. Neither belongs on the site.
That figure has to come from HR, as Expo said — I'm recording that I checked the shortcut and it
is a dead end, so nobody spends the lookup again.

**HQ city, minor, flagged not fixed.** The company page gives HQ as **Encinitas, CA**, while both
cards say *San Diego, California, United States*. The cards match how LinkedIn labels the **job
postings** themselves, so the markup is not wrong — noting it only so it isn't "discovered" later
as a bug.

---

## 4. The patch — two lines, @finn's file, @finn's call

`website/sections/careers-posts/embed.html`, lines **63** and **78**. Identical change to both:

```diff
-        <a class="view" href="/careers/">View job</a>
+        <a class="view" href="https://www.linkedin.com/company/blacktop-restaurant-group/jobs/" target="_blank" rel="noopener">View job</a>
```

Notes on the shape of it, since they're your call not mine:

- **`target="_blank" rel="noopener"`** is my suggestion, not a requirement — it's an off-site link
  leaving a gated marketing page, and `rel="noopener"` is the safety half. If the project has a
  convention against `_blank`, drop both attributes; the `href` is the fix.
- **Absolute URL is correct here** and is not the CDN-path trap from `CLAUDE.md` — that rule is
  about asset URLs inside fragments needing absolute CDN paths. This is an external link.
- **The header comment at `:12` goes stale the moment this lands.** It reads *"The 'View job'
  links point at /careers/ until the real LinkedIn job URLs are supplied."* Worth updating in the
  same commit to say they point at the company jobs page **deliberately** — otherwise a future
  reader treats the company link as an unfinished placeholder and "fixes" it back to per-post
  URLs, which §3 argues against.
- **No ACF interaction.** This section has no `slots.json` and no `{{tokens}}`, so this does not
  touch the `acf-slot-tokens` work or its priming rule.
- **The stamps are not in this patch.** Deleting `834 followers` / `2mo` / `5mo` is Sean's
  content gate (Expo's SPEC-007 §4 recommends deleting). §3 above is evidence for that decision,
  not a decision taken. This patch is deliberately separable so the dead control can be fixed
  without waiting on the stamp ruling.

---

## 5. Sources

- `https://www.linkedin.com/company/blacktop-restaurant-group` — fetched, resolves
- `https://www.linkedin.com/company/blacktop-restaurant-group/jobs/` — fetched, resolves, three openings listed
- `https://www.linkedin.com/company/blacktop-restaurant-group/about/` — **login wall**, follower count not obtainable
