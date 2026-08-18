# SPEC-006 — Contact: the section plan

**Status:** proposed · Explorer · 2026-08-13 · **no comp exists** ·
spec source: [`website/BUILD-SPEC.md` §2.7](../../website/BUILD-SPEC.md) — *"not yet designed.
In the nav but no comp… Flagging as an open item."*
**Verified against:** `6d55e52` — was `f8113db` — claims about the codebase were checked at this tree; re-check before acting on a `file:line` or a state claim.

Contact is the other page from the 7-page IA, and unlike Press it was **never designed** — it
was listed in the nav and nothing else. So this spec can't be "here's the comp, here are the
sections". It's: here is the one decision that actually has to be made, here is the cheapest
defensible page consistent with the 18 sections we already have, and here is what it costs.

**Headline finding: Contact is cheaper than Press.** Three sections, **zero new archetypes** —
every one is a re-skin or a variant of something already live. The reason it hasn't been built
isn't difficulty, it's that nobody has decided what the page is *for*.

---

## 1. The decision that gates everything: is Contact a form page or a routing page?

Everything else follows from this, so it goes first.

### Why a form is not the free option it looks like

The site is a WordPress/Oxygen page with a **CDN fragment inlined into it** — the plugin fetches
`embed.html` from Netlify and prints it inside `.brgw-shell` on the WP page. A `<form>` in our
fragment therefore renders on `blacktoprestaurantgroup.com` but is authored in a file served
from `blacktoprg.netlify.app`. That has consequences worth stating plainly:

- **Netlify Forms is not the shortcut it appears to be.** The fragment does live in the publish
  dir, so Netlify's build-time parser may well *detect* the form. But the rendered form is on
  the WordPress origin, so submitting it means a cross-origin POST to Netlify — which browsers
  permit for form submits, and which then **navigates the visitor off
  `blacktoprestaurantgroup.com` onto a Netlify success page.** That's not a styling problem,
  it's the visitor leaving the site mid-conversion. *(I have not tested this end to end — the
  origin split is certain, the exact submit behaviour I'm reasoning about rather than
  measuring. Worth a live test before anyone commits to it.)*
- **We have no server-side anything.** No form handler, no mail transport, no spam filtering, no
  storage. Adding them means credentials and a plugin install, which the MANIFESTO's credential
  boundary puts firmly on Sean, not on a chat.
- **The honest form path is a WP form plugin** (Gravity/WPForms/Fluent) whose shortcode is
  placed in the Oxygen page *between* two BRG shortcodes: our fragment supplies the chrome
  above and below, the plugin supplies the form. That works, and it's a genuine option — but
  note the **styling seam**: a sibling WP block is outside `.brgw-shell`, so it inherits the
  theme's styles, not `brgw.css`. The form will not look like our page without CSS work that
  crosses into territory nobody currently owns.

### Why a routing page is the better v1 anyway

Set the plumbing aside — a general contact form is probably the *wrong* thing for this business.
BRG is a 12-location restaurant group. The people who arrive on a corporate contact page are
sorting themselves into a handful of very different errands:

- press / media → §2.2, and Press has its own band (SPEC-005 §2.3)
- partnerships & community giveback → **already has a live mailto** on `community-partner`
- careers → **already has an entire page**
- catering / large orders → belongs to the restaurant brands, not the group
- "there was a problem at my Board & Brew last night" → guest recovery, brand-level, time-critical

A single form funnels all of those into one inbox where the urgent one is indistinguishable from
the vendor spam. **A routing page sends each errand to the right place on the first click** and
costs no infrastructure at all.

> **Recommendation: build Contact as a routing page (§2). Treat the form as a later addition
> that slots in as a fourth section if Sean wants it, via the WP-plugin path.**

---

## 1b. RULED 2026-08-18 — paused, placeholder, and the recommendation

**Sean:** *"Let's just pause on the contact form for now and put a placeholder in there. We'll
make that decision later... check with the client about what they want to use."* Plus:
*"What do you recommend? Ideally something that's free or one that we build ourselves."*

**So Contact ships now.** Its three sections are built and in `sections.json`; the form is a
placeholder in the page, not a blocker on it. The plugin choice goes to the client.

### The recommendation: Fluent Forms (free tier), not a self-built form

**Building it ourselves is the option that looks cheapest and isn't**, and the reason is not the
form — it's everything around it:

| | we build it | a form plugin |
|---|---|---|
| The form | easy, a day | done |
| Spam | **ours forever** — a public POST endpoint is scraped within days | built in |
| Deliverability | `wp_mail()` on shared hosting **silently lands in spam** | SMTP integration |
| **Storage** | none unless we build it | **every submission in the database** |
| GDPR / retention | ours | built in |

**The decisive column is storage, not sending.** No solution makes email delivery reliable — but
a plugin that **stores every submission** means a lost email is a recoverable enquiry rather than
a lost customer. A self-built form that emails and stores nothing fails **invisibly**: nobody
learns that the contact form has been dropping enquiries for a month, because the failure looks
exactly like nobody having written.

For a restaurant group where the contact page carries partnership and press enquiries, that is
the whole risk, and it is not a risk we should own for a form that will see a handful of
submissions a week.

**Why Fluent Forms specifically:** a genuinely capable free tier (not a trial), lighter than the
alternatives, and no admin upsell nagging. **Contact Form 7** is the other honest free answer —
ubiquitous and un-monetised, but it stores nothing without an add-on, which loses the one column
that matters. **WPForms Lite** is free but pushes upgrades hard in wp-admin, which the client sees.
**Gravity** is paid and worth it if they already hold a licence — **worth asking, because agencies
often do**, and an existing licence changes the answer.

**One thing that does not change whichever is picked** (§1): the form renders **outside**
`.brgw-shell`, so it inherits the theme's styling rather than `brgw.css`. Making it match the page
is real CSS work that currently has no owner.

## 2. The page, top → bottom

| # | id | Group | Archetype it reuses | New code |
|---|---|---|---|---|
| 1 | `contact-hero` | `hero` | #1 `hero-page` — shared CSS in `brgw.css` | none |
| 2 | `contact-routes` | `grid` | `home-values` — hairline card grid, teal `.lbl` + paragraph | ~none (cards become links) |
| 3 | `contact-restaurants` | `cta` | #3 `cta-band` / `careers-positions` | none |

`stacks.contact` = `["contact-hero", "contact-routes", "contact-restaurants"]`.

### 2.1 `contact-hero`

Identical in shape to `community-hero` — heading, `.brgw-uline`, sub, two doodles. ~11 lines.

- **H1:** `Let's talk.` — short, matches the Careers hero's sign-off (*"…**let's talk.**"*) and
  the brand's register. Alternative: `Say hello.`
- **Sub:** `Whatever you need — a story, a partnership, a job, or just to tell us how we did —
  here's who to ask.` This sub does real work: it tells the visitor the page is a switchboard,
  so the card grid below reads as an answer rather than a runaround.
- **Underline colour: reuse, don't invent.** The five live pages run yellow / teal / pink /
  teal / orange, and SPEC-005 §5 has Press needing a violet we don't have. Adding a *seventh*
  colour for Contact would make the marker set a palette rather than a system — and the markers
  are **hand-drawn artwork** (`assets/media/lines/`), not a generated asset, so every new colour
  is a new export from Sean. **Recommend pink**, which Team already uses and which is furthest
  from Press's violet in the nav order. Sean's gate.
- Like Press, **no `line-contact-*.svg` exists**; the current CSS `.brgw-uline` covers it.

### 2.2 `contact-routes` — the page's actual content

**Reuses `home-values` almost exactly**: a hairline-ruled card grid where each card is a teal
`.lbl` plus a short paragraph. The only change is that the label becomes a link. Same grid
technique as `community-stats` (borders on the cells, no outer border), which is already proven
at 4 cells in a 2-col layout.

**Recommended four routes.** Four, not five — it fits the 1 / 2 / 2×2 grid cleanly, and a
switchboard with too many buttons is the thing it was meant to prevent:

| Label | One-liner | Goes to |
|---|---|---|
| **General** | Anything that doesn't fit the boxes below. | `mailto:hello@blacktoprg.com` — **live and proven today** |
| **Press & media** | Press kit, high-res imagery, interviews, or a comment on a story. | `mailto:press@…` or `/press/#inquiries` (SPEC-005 §2.3) |
| **Partnerships & giveback** | Nonprofits, schools, and local organizations. | the existing `mailto:hello@blacktoprg.com?subject=Community%20partnership` — **already live** on `community-partner` |
| **Careers** | Open roles across Board & Brew and Odie's. | `/careers/` — **already live** |

Two of the four already exist and are verified working. That's the reuse argument in content
form, not just in CSS.

**Deliberately excluded, with reasons:**
- **Catering / large orders** — only if BRG actually takes them, and they'd belong to the brand
  sites. Open question for Sean.
- **Guest complaints** — a corporate address is the *wrong* destination for a bad meal in
  Oceanside; it's slow and it's the wrong team. If it's wanted, it should point at the brand's
  own channel, not at BRG.
- **Phone number** — BUILD-SPEC §3 lists `phone` under the Options page. If BRG has a real,
  answered corporate line, add it as a fifth card or in the hero sub. If it rings an office
  nobody answers, leave it off; an unanswered number is worse than no number.

### 2.3 `contact-restaurants`

A closing band: `Looking for a restaurant?` → **Our Restaurants**. Re-skin of the
`careers-positions` / `community-partner` band, zero new code.

This exists because the routing logic above has a hole: the single most likely reason a stranger
lands on a restaurant group's Contact page is that they want a restaurant's address or hours, and
none of the four cards serve them. This band catches them.

**Recommend against a map embed** (BUILD-SPEC §2.7's "maybe address/map/hours"): it's a
third-party script inside an inlined CDN fragment — cookies, consent, and a second JS engine,
which the MANIFESTO's one-engine rule pushes back on — and the 12 locations already live on
`our-restaurants`. A link is the right size for this.

---

## 3. ~~What this fixes that's already broken~~ — RESOLVED, and not by this page

**Struck 2026-08-13, same day, after re-verifying the pointer rather than the claim.** I argued
here that shipping Contact would defuse a live hazard: `community-partner`'s slot default was
`"cta_href": { "default": "/contact/" }` in `sections.json`, harmless only because the fragment
had no `{{tokens}}` to read it, and due to activate the instant `acf-slot-tokens` landed — Conti
measured that render on 2026-08-13 and got `Get in touch` → `/contact/`. A 404 with a timer.

**It's gone.** The inline block was deleted from `sections.json` and
`community-partner/slots.json` now defaults `cta_href` to
`mailto:hello@blacktoprg.com?subject=Community%20partnership` — the second of the two fixes I
offered. So the hazard is closed and **this section no longer argues for anything.**

Two things worth keeping rather than just deleting:

**It was fixed incidentally, not deliberately.** Neither `501afbe` (Finn wiring the tokens) nor
the commit that removed the inline block mentions `/contact/` or a dead link. It evaporated as a
side effect of the standing rule that **slot defaults must be real production copy, never
aspirational** — the fragment shipped the mailto, so the default became the mailto. That rule is
in `sections.json`'s own `_note` and came out of [SPEC-001 §5](stacking-sections.md); it is
doing more work than its one line suggests. **The hazard returns the moment anyone writes a
default describing where a link *should* go rather than where it *does*.**

**And it weakens my own recommendation, so I'd rather say so than quietly drop the line.**
"Shipping Contact fixes an existing broken link" was one of three arguments for building Contact
before Press (§5). It's void. The other two stand and are the stronger pair anyway: Contact needs
**no content BRG has to go and produce**, and it closes the nav gap the 7-page IA always had.

---

## 4. What Conti has to do

Same list as SPEC-005 §4: `pages.json` (`{ "slug": "contact", "title": "Contact" }`),
3 × `sections.json` entries + `stacks.contact`, `kit/registry.json` + `python3 kit/build.py` in
the same commit. Nav is a WP menu item (Sean) — **and with Press that takes the nav from 5 to 7
items**, which is the comp's full IA and is worth checking against the `left`/`right` split and
the More-overflow drawer before both go live.

---

## 5. Content this page needs

Short list, and none of it is hard — which is the point:

1. **Confirm the four routes** (§2.2) and whether catering/phone are real.
2. **`press@blacktoprg.com`** — or route press through `/press/` and drop the address.
3. **Hero copy** — the two lines in §2.1, Sean's gate.
4. **The form decision** (§1). If it's yes, it's a WP plugin install and a styling conversation,
   not a fragment.

No photography. No numbers. No headshots. **Contact is the only unbuilt thing on this project
that isn't blocked on content BRG has to go and produce** — which is a decent argument for
building it first, ahead of Press, purely to close the nav gap the 7-page IA always had.
*(This used to read "…and kill the latent 404 in §3." That hazard was closed on 2026-08-13 —
see §3. The case for Contact-first is one argument lighter than when I wrote it.)*
