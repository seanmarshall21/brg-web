# careers-posts — the LinkedIn URL, and what the live postings actually say

**Built by:** dum · 2026-08-13 · `work/dum/careers-posts-urls/`
**For:** @finn (owns the fragment) · @sean (owns the content call) · cc @expo (asked for this)
**Board task:** `careers-posts-urls` — **HELD, Sean's gate**

> **Status: PAUSED BY SEAN, PREPARED.** *"Let's pause on the jobs links. Just prepare it so that
> we can do that when we are ready."* Nothing has been applied; `careers-posts` is live and
> unchanged. **The prepared change is [`APPLY.md`](APPLY.md) + [`apply.sh`](apply.sh).** This file
> is the evidence behind it.

> **The link, if that's all you came for:**
> `https://www.linkedin.com/company/blacktop-restaurant-group/jobs/`
> (slug `blacktop-restaurant-group`; verification in §2)

Expo asked for one fact — *"BRG's LinkedIn company slug, so `careers-posts`' two `View job`
buttons can point at the company jobs page instead of at `/careers/` — the page they're already
on."* This is that fact, and three things found while verifying it that change the task.

---

## 1. The finding that matters: the feed has **already failed once**, silently

The fragment's own header comment and the board both treat these cards as renderings that *"will
go stale."* That framing is wrong in both directions, and the correction is the argument for the
whole change.

**The postings are live.** Both roles named in the markup are still open on LinkedIn today:

| Live on LinkedIn | In the fragment? |
|---|---|
| People & Culture Manager — San Diego, CA | ✅ card 1 |
| Payroll & HRIS Manager — San Diego, CA | ✅ card 2 |
| **People & Culture Director** — San Diego, CA *(temporary)* | ❌ **missing** |

**But a third opening exists that the page does not show.** That is not a prediction that a
hand-maintained feed will drift — it is drift that has **already happened**, unnoticed, on the
section whose entire job is to convert. Nobody spotted it because nothing on this project
compares the page to LinkedIn; I only saw it because I fetched the jobs page to verify a URL.

**Why this decides the shape of the fix.** A per-post link pins the page to a moment and inherits
exactly this failure. The **company jobs page** shows all three roles today, shows the fourth
when it opens, and stops showing the first when it closes — with no commit. It is correct by
construction rather than by maintenance.

Two second-order consequences worth stating:

- **The card copy is more accurate than assumed**, so nobody needs to rewrite it. The risk
  everyone has been managing is not yet a live defect.
- **The dead control is the live defect** — both buttons navigate to `/careers/`, the page the
  visitor is already on. That is the half with a defect behind it, and it is why `APPLY.md` keeps
  the link separable from the stamp question.

## 2. The answer, and how it was verified

| | |
|---|---|
| **Company slug** | `blacktop-restaurant-group` |
| **Company page** | `https://www.linkedin.com/company/blacktop-restaurant-group` |
| **Jobs page — the one to link** | `https://www.linkedin.com/company/blacktop-restaurant-group/jobs/` |

**Verified by fetching both URLs, not by reading a search snippet.** Public pages only — no
credentials, no login, nothing private. The company page returns: *Blacktop Restaurant Group* ·
Encinitas, CA · Restaurants · 51–200 employees · tagline *"San Diego's culture-first restaurant
group | Board & Brew + Odie's Pizza Co. | Make Your Day Great! ⚡"* · founded 2013 by Clayton
Wheeler and Craig Applegate. That's BRG, not a same-name company.

**The load-bearing check: `/jobs/` renders its openings to a logged-out visitor.** That's the
property the fix actually depends on — a link dead-ending at a login wall would be no better than
the `/careers/` self-link it replaces. This is the one thing that must be re-confirmed at apply
time; see `APPLY.md` §4.

## 3. What could **not** be verified — and why each negative is useful

**Per-post job URLs: not reliably retrievable. Rule them out for good.** Only one BRG job id
surfaced (`4359022919` — People & Culture Director, the role *not* in the fragment). The two
roles that **are** in the fragment yielded no stable ids. That's not a gap in this research, it's
a third independent argument: **if a URL is this hard to obtain while the posting is open, it
will not be re-obtained when the posting is replaced.** Expo called per-post links "an
optimisation on top"; on this evidence they're a maintenance trap. *(@conti has taken this as
settled engineering guidance.)*

**`834 followers`: cannot be verified — the count is behind a login wall.** I could not confirm
or refute it from a logged-out fetch. This argues Expo's "delete both stamps" recommendation more
strongly than an opinion could: **a number that requires an authenticated session to check is a
number nobody on this project will ever check.** It will drift, and its drift is invisible from
outside. Same reasoning applies to `2mo` / `5mo`.

**Headcount — a dead end, recorded so nobody walks it twice.** Expo's SPEC-007 §2 proposes *team
headcount across SD & OC* as the second `community-stats` figure. **LinkedIn cannot supply it.**
The company page shows the band **51–200 employees**, which is not a number; a third-party
aggregator claimed 44, which contradicts the band and is unsourced. Neither belongs on the site.
That figure has to come from HR, exactly as Expo said.

**HQ city — flagged, not fixed.** The company page gives HQ as **Encinitas, CA**, while both
cards say *San Diego, California, United States*. The cards match how LinkedIn labels the **job
postings** themselves, so the markup is not wrong — noted only so it isn't "discovered" later as
a bug.

## 4. The change itself

Moved to **[`APPLY.md`](APPLY.md)**, with a tested [`apply.sh`](apply.sh) beside it: anchored on
surrounding text rather than line numbers, `target="_blank" rel="noopener"` decided rather than
flagged, preconditions that refuse on an ACF-wired file, and the re-verify step that has to
happen before it runs. Kept deliberately separate from the stamp deletion — different decisions,
and Sean paused both without ruling on either.

## 5. Sources

- `https://www.linkedin.com/company/blacktop-restaurant-group` — fetched, resolves
- `https://www.linkedin.com/company/blacktop-restaurant-group/jobs/` — fetched, resolves, three openings listed
- `https://www.linkedin.com/company/blacktop-restaurant-group/about/` — **login wall**, follower count not obtainable
