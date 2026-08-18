# SPEC-007 — The content gaps holding up launch

**Status:** proposed · Explorer · 2026-08-13 · covers tasks `community-stats`,
`real-photography`, `careers-posts-urls` — [`notes/tasks.json`](../tasks.json) ·
`launch` is currently `blocked` on all three
**Verified against:** `f8113db` — claims about the codebase were checked at this tree; re-check before acting on a `file:line` or a state claim.

Three gaps, one shared cause. Each of them is a **fact the site asserts that nobody is
maintaining**: a number nobody measures, a photograph of nobody who works here, a follower count
nobody updates. They've survived since the first build because none of them fails anything —
not a check, not a build, not a review.

So this spec is in two halves. §1 is a **doctrine** — the rule I want applied to all three and
to everything after them, because otherwise we fix these and grow three more. §§2–4 apply it.

**The single most useful thing in here:** §2 argues the community stats should stop blocking
launch, and shows the concrete change that makes that safe. Right now `launch` waits on a number
BRG may never produce.

---

## 1. The doctrine: two rules

### Rule 1 — A placeholder must fail loudly in the build and invisibly on the page

Today `XX` does the exact opposite. It is **invisible to every automated check we own** and
**glaring to every human who loads `/community/`**. That inversion is precisely why it has
survived: nothing objects, and the only thing that would object is a visitor we haven't let in
yet. The gate is doing the job a build check should be doing.

Concretely, three parts:

1. **Never ship a literal placeholder glyph.** `XX` is the worst available option — it reads as
   a bug to a visitor and as content to every tool.
2. **A section with missing content degrades to a smaller *complete* section, or it is absent.**
   Never a complete section with holes in it. §2.2 shows what that means in CSS for the stat
   grid, and it isn't what you'd guess.
3. **Make the gap fail the build.** `kit/build-acf.py --check` already exists and
   `acf-check-on-push` is queued to wire it into `pre-push`. Propose a companion: a sentinel
   comment convention — `<!-- TODO:CONTENT … -->` — that any fragment carries while it's
   incomplete, which `--check` reports and which forces `status: "draft"` in `sections.json`.
   That's `kit/` and `sections.json`, so **Conti's**; I'm asking, not building.

   Worth pairing with Finn's 2026-08-13 note that `--check` is *necessary but not sufficient* —
   it proves slot↔token, not slot↔plugin, and it stayed quiet while the live render was wrong.
   A content sentinel has the same limit and should be documented with the same caveat.

### Rule 2 — No fragment ships a fact it can't keep true

Anything that decays without an edit — a relative date, a follower count, a "13 years in
business", an award year — must be **computed at render time**, **absolute rather than
relative**, or **deleted**. We have no render-time computation in a static CDN fragment, so in
practice it is always *absolute* or *deleted*.

This rule bites immediately and asymmetrically, which is a good sign it's the right rule:

- `careers-posts`' `"834 followers · 2mo"` → **violates it twice.** §4.
- `home-community`'s `"Since 2013"` → **absolute. Fine, keep.**
- A proposed *"13 years serving San Diego"* stat → **would violate it.** This is why §2.3
  rejects a years-in-business figure that looks otherwise attractive.

---

## 2. The community stats — three of four read `XX`

Live behind the gate today ([`community-stats/embed.html`](../../website/sections/community-stats/embed.html)):

| # | Figure | Label | State |
|---|---|---|---|
| 1 | `12` | locations embedded in SD & OC communities | **figure ruled 12** (Sean, 2026-08-13). The label is the open half — [SPEC-008 §1](editable-copy-audit.md): `home-community` counts 12 as *Board & Brew only*, so at 12 the group-sounding label is the thing to fix |
| 2 | `XX` | local organizations supported annually | placeholder |
| 3 | `XX` | meals/dollars donated | placeholder |
| 4 | `XX` | giveback events per year | placeholder |

### 2.1 Why this has been stuck — and the reframe

The strategy question isn't "how do we chase these numbers". It's **why haven't they arrived in
four months**, and the answer is visible in the labels: *these are not things a 12-location
restaurant group measures.* Nobody at BRG has "meals/dollars donated" sitting in a system. So
the ask produces either a guess or silence, and it has produced silence.

> **The move is not to chase the numbers. It's to change the questions to ones BRG can answer
> from records it already keeps.**

Two of the three are already close to answerable. One is not, and shouldn't be answered at all.

### 2.2 What the grid actually does when a number is missing — measured

Before choosing figures, the layout constrains how many there can be. The grid is `1fr`, then
`1fr 1fr` at ≥700px, with rules drawn per cell: `border-right` except `:nth-child(2n)`,
`border-bottom` except `:nth-last-child(-n+2)`. Modelling that:

| Cells | Resulting rules | Verdict |
|---|---|---|
| **2** | `cell1[R–] cell2[– –]` — one clean vertical divider | ✅ reads as deliberate |
| **3** | `cell1[RB] cell2[– –] cell3[R–]` — cell 2 loses its bottom rule, and **cell 3 sits alone in the left column with a vertical rule pointing at empty space** | ❌ visibly broken |
| **4** | `cell1[RB] cell2[–B] cell3[R–] cell4[– –]` — symmetric | ✅ current |

**This changes the ask.** Three is not a graceful middle — it's the worst of the three, and it
breaks *structurally*, not just aesthetically. So:

> **Sean needs either one more number, or three more. Never two.**

That reframing is worth more than another reminder, because "get me one number" is a request
someone can actually complete this week.

### 2.3 Recommended figures

**#2 — local organizations supported annually → keep, use a floor.**
Answerable: it's a count off the sponsorship list for one year. If the exact figure is soft, use
**`20+`**. Recommend the `+` form for anything *counted* rather than *measured* — it's honest,
defensible, and it can only ever become more true, never less. (Rule 2: a floor doesn't decay.)

**#3 — meals/dollars donated → replace the metric, don't fill it.**
This is the dangerous one and it should not ship in any form. A dollar figure for charitable
giving is a **public claim about a private company's philanthropy**. If it's soft, it's the
exact number that gets quoted back at you — by a journalist, a nonprofit partner, or a
candidate. "Meals/dollars" is doing something revealing, too: it's two incompatible units joined
by a slash because neither one alone was available.

Three substitutes BRG can actually evidence, in the order I'd rank them:

1. **Team members employed across SD & OC** — *my recommendation.* HR has this figure exactly,
   today, with no research. It's genuinely a community-impact number for a restaurant group
   (payroll into two counties is the most concrete thing BRG does for its communities). It is
   unarguable. And it's on-brand for a company whose entire pitch — the Team page, the Careers
   page, `home-different`'s whole argument — is *great people*.
2. **Years partnered with Urban Surf 4 Kids** — ties to the `community-give` slider that already
   names them, and it's specific rather than aggregate. But it grows by one each year: Rule 2
   says absolute-or-deleted, so it would have to render as a start year, not a duration.
3. **Years in business (`13`, since 2013)** — attractive and wrong. It's a duration, it
   self-increments, and nothing in a static fragment updates it. **Rejected by Rule 2.**

**#4 — giveback events per year → keep, use a floor** (`25+`). Same reasoning as #2: countable
off a calendar, low risk, doesn't decay.

**Proposed final four** — the *shape* is the recommendation; the values are illustrative and
Sean supplies them:

| # | Figure | Label | Where it comes from |
|---|---|---|---|
| 1 | `12` | locations embedded in SD & OC communities | **figure RULED 12** by Sean 2026-08-13 (*"Put it at 12 right now"*, relayed via Finn). The **label** is still open — [SPEC-008 §1](editable-copy-audit.md): at 12 it reads as the group while `home-community` says 12 is Board & Brew. Not the free one I took it for |
| 2 | `20+` | local organizations supported each year | count the sponsorship list |
| 3 | `400+` | team members across San Diego & Orange County | HR headcount — **exists today** |
| 4 | `25+` | giveback events per year | count the event calendar |

Minor copy note: `annually` → `each year` in #2, to match the register of the rest of the page.

### 2.4 If the numbers never arrive

**Ship two cells and launch.** Per §2.2 a 2-cell grid is clean and reads as deliberate; per §2.3
figure #3 (headcount) needs no research at all, so **the location count + headcount is available
today** — the count is ruled at 12, only its label is open ([SPEC-008 §1](editable-copy-audit.md)) — with
zero external dependency.

> **Recommendation: `community-stats` stops being a launch blocker.** It becomes a section that
> ships at 2 cells and grows to 4 when the counts land. `launch` in `tasks.json` should drop it
> from its blocking list.

That is the whole point of doing this work now. One of the three things holding launch is
holding it for a number that may not exist, and it doesn't have to.

---

## 3. The photography — `home-community` (2 plates) and `home-different` (3 plates)

Both ship stand-ins (`bg/skater.webp`, `bg/surfer.webp`, `imgs/brg-img-home-xl.webp`).
`tasks.json` puts the danger precisely: *"They read as composed, so this isn't visibly broken —
which is exactly why it will be forgotten."*

I'd go further, and it changes the priority: **on `home-different` the stand-ins aren't neutral,
they're contradicting the copy.** That section argues BRG is a *different kind of employer* —
burnout, turnover, "the best guest experiences start with the best team experiences", "great
careers". Illustrated with a stock skater and a surfer, it says *lifestyle brand*. A visitor
takes the picture, not the paragraph.

### 3.1 Constraints the CSS imposes (read these before shooting or selecting)

These aren't preferences, they're in the fragments:

- **Greyscale, mostly.** All three `home-different` plates are `filter:grayscale(1)
  contrast(1.05)`. In `home-community` **only the small `.block` is greyscaled** — the large
  `.plate` has no filter, so **it is the only full-colour photograph in either section** and
  carries all the warmth. Everything else: colour grading is wasted, **tonal separation is the
  only thing that survives**. A flat, low-contrast image turns to mush, especially on the black
  ground.
- **Aggressive centre crops.** `object-fit:cover` into fixed aspect boxes. Deliver **loose**, not
  tight — the subject must survive a centre crop at both ~4:3 and portrait.
- **Every plate has its own parallax rate**, with opposite signs so they separate as you scroll.
  A subject near an edge **drifts out of the visible box**. Keep subjects centred.
- **The doodle cluster overlaps `home-community`'s media at bottom-right** (up to 15vw) — nothing
  important in that corner.
- **Resolution.** The media column is ~695px CSS at the 1500px max-width grid. Largest plate
  (`.plate`, 86%) ≈ 600px CSS → **~1200px at 2×**. Ask for **≥1600px on the long edge** for the
  big plates and **≥800px** for the small ones — enough headroom to re-crop later.

### 3.2 `home-community` — "Born in San Diego. Built for community."

Copy: connection over food · since 2013 · *"operators who eat at our own restaurants, know our
guests by name"* · success measured in people walking out smiling.

- **`.plate` (large, bottom-left, ~598×477, IN COLOUR).** Carries the section's whole argument,
  and it's the only colour image — so it must be **people mid-interaction inside a Board &
  Brew**: a staff member and a guest, caught, not posed. Not a hero food shot, not an empty
  dining room at golden hour. Recognisably San Diego if it can be (daylight, an open doorway, a
  bike outside). Its colours sit next to yellow, teal and black, so warm neutrals read best.
- **`.block` (small, top-right on a yellow ground, ~320×256, greyscale).** A **detail and
  counterpoint**. At this size on a yellow ground it needs graphic simplicity — one legible
  object at large scale. A hand passing a cup across a counter; a sign fragment; a board against
  a wall. **Not a face** — on mobile this is a thumbnail.

### 3.3 `home-different` — "A different kind of restaurant company."

Copy names the team three times. **All three plates should be crew, at work, candid** — not
guests, not food, not lifestyle. This is the section where the stand-ins are actively wrong.

- **`.y` (largest, yellow ground, ~425×329, greyscale).** The energy shot: a kitchen line
  mid-service, or a pre-shift huddle. Wide, several people, motion.
- **`.k` (black ground, overlapping, ~356×340, `z-index:2`, greyscale).** One person, portrait
  orientation, focused on their work. **It sits on black** — a dark subject disappears; this one
  needs a bright subject or a bright background behind them.
- **`.w` (smallest, white ground, ~178×159, greyscale).** Tiny. **One simple shape only** —
  hands working, an apron, a name tag, a ticket rail. A face here is a smudge.

### 3.4 If real photography never arrives

Unlike the stats, these are not visibly broken — so the failure mode is *silence*, and the
answer can't be "leave it".

1. **Swap the stand-ins on `home-different` regardless.** Skater and surfer contradict the copy
   (§3). Even the least-wrong images already in the repo (`imgs/brg-img-home-*`,
   `imgs/ber-hero-static`) beat images that argue against the paragraph beside them.
2. **A mediocre real photo of the actual crew beats a good stock one.** The section's entire
   claim is authenticity; a phone photo from a real service, greyscaled and contrast-boosted,
   satisfies it. Stock cannot, at any quality.
3. **Mark them.** Any stand-in carries the §1.3 `<!-- TODO:CONTENT -->` sentinel so it can't be
   mistaken for final — which is exactly what happened here.
4. **These should not block launch either.** They're wrong, not broken. Fix the contradiction
   (1), mark them (3), launch, replace when the shoot happens.

---

## 4. `careers-posts` — the LinkedIn URLs and the stamps

`tasks.json` treats these as one item. **They're two different problems** and only one of them
is about missing data.

### 4.1 The `View job` links are a live dead control, not pending data

Both point at `/careers/` — **the page they're already on.** That isn't a placeholder awaiting a
URL; it's a button that visibly does nothing, on the section whose entire job is to convert.

**Recommend pointing both at BRG's LinkedIn company jobs page** —
`https://www.linkedin.com/company/<slug>/jobs/` — one URL, correct today, correct after any
individual posting expires, and **zero maintenance**. Per-post URLs are an optimisation to add
later, not a prerequisite. This is fixable this week and doesn't wait on anyone.

*(Needs the real company slug from Sean — one lookup.)*

### 4.2 The stamps — delete both

`"834 followers · 2mo"`, copied from the comp. Rule 2 kills both, separately:

- **The follower count** is a LinkedIn UI artifact being cosplayed on a marketing site. It tells
  a candidate nothing, BRG doesn't control the number, and it can only ever drift wrong.
  **Delete.**
- **The relative age stamp** (`2mo` / `5mo`) is the purest form of a fact with a timer on it —
  and it fails *worse than neutral*: an ageing stamp on a job post signals **the role is stale**,
  which is the exact opposite of what the section is for. There is no value of `2mo` that helps.
  **Delete.**

The fragment's own comment already notes the `.meta` span deletes with no layout consequence, so
this is free. Nothing replaces them: the cards still read unmistakably as LinkedIn posts via the
avatar, the `#hiring` tag colour, the nested job card and the blue outline button. The name
stands alone.

### 4.3 The deeper problem, and a decision to close

The section is **static cards imitating a live feed**. That imitation is what generates all of
this — it inherits LinkedIn's freshness expectations without inheriting LinkedIn's freshness.
Three exits; BUILD-SPEC §4.1 left this open, and it's worth actually closing:

- **(a) Keep the LinkedIn *look*, drop the LinkedIn *metadata*.** ← **recommended.** Ships this
  week, kills both staleness sources, keeps the design intent, no new dependency.
- **(b) Stop imitating** — restyle as BRG's own "Open roles" cards. More work, and no advantage
  over (a) while the roles are hand-maintained either way.
- **(c) Go live via the LinkedIn API.** **Recommend ruling this out explicitly**, so it stops
  being reconsidered every few weeks. BUILD-SPEC §4.1c already calls it the most fragile option,
  and the architecture is decisive: it needs an app, a token and a server-side fetch, and our
  sections are **static HTML on a CDN with no server side**. The only place that could run is
  the WP plugin — Conti's file, a credentialled integration, and a per-request external
  dependency on the critical render path of a page that currently has none.

---

## 5. Summary of what I'm asking for

| Ask | Owner | Blocking launch? |
|---|---|---|
| Approve the doctrine (§1) as a standing rule | conti | no |
| `<!-- TODO:CONTENT -->` sentinel in `--check` + `status:"draft"` | conti (`kit/`, `sections.json`) | no |
| Team headcount figure (§2.3 #3) — **exists today, no research** | sean | **unblocks stats** |
| Org count + event count, as `N+` floors | sean | no — §2.4 degrades to 2 cells |
| **Drop `community-stats` from `launch`'s blockers** (§2.4) | conti / sean | **yes — removes one** |
| Photography brief (§3.2–3.3) → a shoot, or real crew photos of any quality | sean | no — §3.4 |
| Swap `home-different`'s contradicting stand-ins now | finn (fragment) | no |
| BRG's LinkedIn company slug (§4.1) | sean | no |
| Approve deleting the follower count + age stamps (§4.2) | sean (content gate) | no |
| Rule out the LinkedIn API (§4.3c) for good | conti | no |

**Net effect if all of this lands: `launch` is blocked on team headshots and quotes, and nothing
else in this spec.**
