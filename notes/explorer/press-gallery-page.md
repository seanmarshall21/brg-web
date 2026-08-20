# SPEC-005 — Press & Gallery: the section plan

**Status:** proposed · Explorer · 2026-08-13 · **§6 blockers RESOLVED 2026-08-19 — see §8** · comp: `website/mocks/build-spec/page-7.png` ·
spec source: [`website/BUILD-SPEC.md` §2.6](../../website/BUILD-SPEC.md)
**Verified against:** `f8113db` — claims about the codebase were checked at this tree; re-check before acting on a `file:line` or a state claim.

The page from the original 7-page IA that was designed and never built. This is the section
plan Conti asked for: ids, order, which of the 18 archetypes each one reuses, what is
genuinely new, and what content it needs before it can ship.

**Headline finding: Press is cheap.** Four sections, and only *one and a half* of them are new
code. Two are re-skins of sections that already exist and are live, one is a variant of a live
shell with a new card inside it, and one reuses `team-members`' grid geometry. The expensive
part of this page is not the build — it's that **three of the four sections need content BRG
may not have**, and one needs an image asset that doesn't exist. See §6.

---

## 1. The page, top → bottom

The comp reads as five bands, but it builds as **four sections**. The smiley badge between the
hero and the articles is not a section — see §2.2.

| # | id | Band in the comp | Group | Archetype it reuses | New code |
|---|---|---|---|---|---|
| 1 | `press-hero` | Black hero, purple underline | `hero` | #1 `hero-page` — CSS already shared in `brgw.css` | ~none (but see §5, the colour) |
| 2 | `press-articles` | Graffiti-watermark ground, 2 article cards | `feed` | `careers-posts` shell | **the article card** |
| 3 | `press-inquiries` | Teal band, photographer cutout, REACH OUT | `cta` | #3 `cta-band` / `careers-positions` | ~none (re-skin) |
| 4 | `press-gallery` | "The food speaks for itself" + 3×3 grid | `grid` | `team-members` grid geometry | **the tile** (trivial) |

`stacks.press` = `["press-hero", "press-articles", "press-inquiries", "press-gallery"]`.

**Slug.** I'd use `press`, not `press-gallery` — the gallery is a section of the page, not a
co-equal, and the nav label ("Press & Gallery") is set in WP and doesn't have to match. Conti's
call; `website/pages.json` is his file.

---

## 2. Section by section

### 2.1 `press-hero`

Straight `hero-page`. Everything but two lines is already in `brgw.css` (`.brgw-hero`,
`.brgw-hero h1`, `.brgw-hero .sub`) — the per-page fragment is a heading, a `.brgw-uline`, a
sub, and a colour override, exactly like `community-hero` (11 lines, doodles included).

- **H1:** `In the press & behind the scenes` (comp).
- **Sub:** `High-res food shots, brand moments, and the stories being told about BRG and our
  brands.` (comp — this copy is real and needs no invention.)
- **Underline:** `.brgw-uline` with `color:` — **and this is the one blocker.** See §5.
- **Doodles:** the comp shows **none**. It is the only one of the six heroes without them. I've
  left it as drawn rather than inventing a pair — if that reads as unfinished rather than
  deliberate, one `icn-misc-*` in the family costs one line. Sean's call, flagged not decided.

### 2.2 `press-articles`

**The smiley badge folds in here.** In the comp it straddles the hero/articles seam. Every
badge in the 18 that does this is owned by the *lower* section as a `.seam` that bleeds
**upward** — `home-community` does exactly this with `div-icn-bolt.svg` — because a later shell
paints on top of an earlier one, so upward is the direction that works without a z-index
argument. So: `press-articles` owns a `.seam` using `icons/div-icn-smile.svg` (exists), same
`transform:translate(-50%,-50%)` pattern. It is **not** a fifth section.

**Shell: reuse `careers-posts` almost wholesale.** They are the same object — a narrow centred
column of bordered cards floating on the pale graffiti wash:

```
background:var(--white); ::before = brg-pattern-gry.webp, center/cover, opacity .5
.feed{display:grid;gap:clamp(...);max-width:760px;margin-inline:auto}
.post{border:1px solid rgba(0,0,0,.14);border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
```
Differences from `careers-posts`: the comp's cards are **wider** (≈880 of 1000 ≈ 88vw, so
`max-width:1080px` not 760), the border is heavier and darker (measured near-black `#231F20`,
~2px, vs the 1px 14%-black on careers), and the radius is larger (≈28px vs 12px).

**What's genuinely new: the card's interior.** Nothing in the 18 is a thumbnail-plus-title link
row. It's simple — a flex row, square thumb left, text right — but it's new markup, new CSS, and
it needs a content decision the comp doesn't make:

> **The comp's card contains one word: `ARTICLE`, centred in an otherwise empty half.** That is
> a placeholder, not a layout. A real press card that centres a lone headline in dead space will
> look wrong.

Recommended real card, in reading order: **thumbnail · outlet (eyebrow, teal `.lbl` — the
`home-values` treatment) · headline (Montserrat Bold, the comp's face — not Blanco) · date**,
left-aligned in the right-hand column, vertically centred as a block. Per BUILD-SPEC §2.6's
`press_article` model: `{thumbnail, title, outlet, url, date}` — I'd render all five.

- **The whole card is the `<a>`**, not a "read more" link — it's a 1080×~200 target and any
  smaller affordance wastes it.
- External, so `target="_blank" rel="noopener"`, and it needs a **visible** external cue (a
  small arrow at the card's right edge). Comp shows none; a card that silently opens a new tab
  is the kind of thing that reads as broken.
- **Two cards is the comp's placeholder count, not a constraint.** `.feed` is a 1-col grid; N
  cards stack. Below ~640px the row must become thumb-above-text or the thumbnail crushes.
- Thumbnail is `aspect-ratio:1`, `object-fit:cover`, `border-radius:16px` (measured off the
  comp), black ground beneath so a slow/missing image reads as the composition — the same trick
  `home-different` uses on its colour plates.

### 2.3 `press-inquiries`

**This is `careers-positions` mirrored, and the reuse is near-total.** Both are: a full-bleed
flat-colour band, a centred Blanco H2, an inverted black `.btn` (`background:var(--ink);
color:var(--white)` — already in the careers fragment), a tonal watermark, and a greyscale
photographic cutout bleeding off one edge. Differences:

| | `careers-positions` | `press-inquiries` |
|---|---|---|
| Ground | `--yellow` | teal — **measured `#00BEB5`, see §5** |
| Cutout | surfer, bleeds off the **right** | photographer, bleeds off the **left** |
| Sub copy | yes | **none in the comp** — heading + button only |
| Bottom rule | `border-bottom:10px solid var(--ink)` | none |

- **Copy:** H2 `Media inquiries`. The comp has no sub line. I'd add one — a bare heading and
  button gives a journalist nothing (who to ask, what for, response expectation). Suggested:
  `Press kit, high-res imagery, founder interviews, or a comment on a story — we'll get back to
  you.` Flagged as an addition to the comp, so Sean's gate.
- **CTA:** `Reach out` → `mailto:press@blacktoprg.com?subject=Media%20inquiry`.
  **`press@` must actually exist** — BUILD-SPEC §2.6 says `[contact_cta]` (mailto) but doesn't
  name the address, and the only mailto live today is `hello@blacktoprg.com` on
  `community-partner`. Falling back to `hello@` is fine and better than a dead `press@`.
  **If Contact ships (SPEC-006), this should point at `/contact/#press` instead** so there's one
  place that routes enquiries. Cross-page; decide the two together.

**The architectural flag — the doodles bleed *downward*.** In the comp the yellow bolt
(bottom-left) and the BRG cluster (bottom-right) both hang *below* the teal band into the white
gallery section. That is the direction the cross-section bleed rule doesn't do by default: a
later sibling paints on top, so anything `press-inquiries` hangs downward gets covered by
`press-gallery`. Two ways out, and I recommend the first:

1. **The bolt and the BRG cluster live in `press-gallery` and bleed *up*.** Rule intact, no
   z-index, no exception, and it's what `home-community` and `careers-positions` already do.
2. Keep them in `press-inquiries` and grant it the `team-apply` exception (that section's BRG
   cluster genuinely bleeds down into the shared footer, and it's documented as an exception in
   `notes/controller.md` for that reason).

The only argument for (2) is that they're conceptually part of the band. They aren't visually —
they overlap the seam either way, and (1) costs nothing.

### 2.4 `press-gallery`

- **Heading:** `The food speaks for itself`, with the yellow highlight on `speaks for itself` —
  that's the shared `.hl` class ([`brgw.css:28`](../../website/assets/brgw.css)), Blanco, so
  there's nothing to build. Note the comp's highlight is a flat rectangle, not the rotated
  marker block `home-community`/`home-different` use for `.mark`. `.hl` is the flat one. Correct
  as-is.
- **Grid:** 9 square tiles. Geometry is `team-members`' — nine cards, 1 / 2 / 3 columns — minus
  the name/title overlay, so lift its responsive columns and drop the rest. `max-width:1080px;
  margin-inline:auto` to match `community-stats` and `home-values`. Tiles are `aspect-ratio:1`,
  `object-fit:cover`, comp placeholder grey `#D1D3D4`.
- **No lightbox.** The comp shows no click affordance, `brgw.js` has no lightbox, and the
  MANIFESTO's "one engine, never a second init script" rule means adding one is a **shared
  component in `brgw.js`** and therefore Conti's call, not a section's. Ship v1 as a
  non-interactive grid. If a lightbox is wanted later it goes in the engine, once, for
  everyone — not into this fragment.
- **9 is the comp's count, and it should stay a multiple of 3** or the last row goes ragged at
  desktop. 6, 9, or 12.

---

## 3. What's genuinely new, totalled

Everything below is the entire net-new surface of this page:

1. **The article card interior** — flex row, square thumb, eyebrow/headline/date stack, card-as-
   link, external-link cue, mobile stack. ~40 lines of CSS, ~12 of markup per card.
2. **The gallery tile** — `aspect-ratio:1` + `object-fit:cover` in a 3-col grid. ~8 lines.
3. **A fifth marker colour** (§5) — one token, or a decision not to have one.

Everything else on this page already exists and is live.

---

## 4. What Conti has to do (his files, not mine, not Finn's)

- `website/pages.json` — add `{ "slug": "press", "title": "Press & Gallery", "status": "live" }`.
- `website/sections.json` — 4 new entries + `stacks.press`.
- `kit/registry.json` + `python3 kit/build.py` **in the same commit** — the plugin registers
  `[brg_<id>]` per `sections.json` entry, so 4 new shortcodes need the registry and the
  generated docs move with them. `--check` runs on push.
- Nav: "Press & Gallery" is a **WP menu item** (`wp_nav_menu`, location "BRG — Primary"), so
  it's a wp-admin action and Sean's, not a code change. It takes the nav from 5 items to 6 —
  worth checking the `left`/`right` split and the More-overflow drawer at 6 before it's live.

---

## 5. The colour problem — measured, and it's now three sources against our tokens

I sampled the comp rather than eyeballing it (`PIL`, dominant colour per region):

| Region | Comp | Our token | Match? |
|---|---|---|---|
| Hero underline | **`#5D0E8B`** | — **no purple token exists** | n/a |
| Media Inquiries band | **`#00BEB5`** | `--teal:#19C7C2` | ✗ |
| Top rule / `.hl` highlight | **`#FAE200`** | `--yellow:#FCE200` | ✗ |
| Card border / ink | `#231F20` | `--ink:#231F20` | ✓ |
| Gallery placeholder | `#D1D3D4` | n/a (placeholder) | — |

Two separate things fall out of that.

**(a) Press needs a fifth marker colour, and we don't have one.** Our four heroes run
yellow / teal / pink / teal / orange; Press is violet `#5D0E8B`. Options: add
`--violet:#5D0E8B` to the `.brgw` token block (Finn's file, `brgw.css`), or set `color:` inline
in the section and don't promote it to a token. **I'd add the token** — a hero underline colour
is exactly what the token block is for, and if Contact ships it'll want a sixth (SPEC-006 §3
argues Contact should *reuse* rather than invent, precisely to stop this).

**(b) My 2026-08-10 colour-drift QUESTION is still open, and this is a third independent
source agreeing against us.** I flagged then that Sean's `assets/lines/` SVGs disagree with our
tokens on all four colours, drifting the same way. The Press comp — a different file, a
different export — lands on `#00BEB5` and `#FAE200`, i.e. **with the SVGs (`#00BEB4`, `#FAE200`)
and against `brgw.css` (`#19C7C2`, `#FCE200`)**. Two independent design-source files agreeing
with each other is no longer drift I can call ambiguous. Recommend the tokens move to the
artwork values. It touches every page, so it's Conti's direction call — but it's now evidenced,
not asserted.

**(c) There is no `line-press-lg.svg` or `line-press-nav.svg`.** `assets/media/lines/` holds
exactly ten files, two per existing page. If SPEC-004's pen-stroke underline is adopted, Press
has no artwork to draw and needs Sean to export two more (and Contact two more again). Until
then Press uses the current CSS `.brgw-uline`, which is fine — it's what all five live pages
still use.

> **RESOLVED 2026-08-19 — no export needed, and the `currentColor` route does not work.**
> Sean: *"can we just use the SVGs we have and recolor them?"* Yes — but by **deriving a
> recoloured copy**, not by inheriting `color:`. See [§8.3](#83-the-press-marker--derive-a-recoloured-copy-not-currentcolor).
> The "Sean exports two more" cost in this paragraph is retired; so is Contact's.

---

## 6. Content this page needs before it ships

Ranked by how likely it is to be the thing that actually holds the page up.

1. **Real press articles — and the honest question of whether any exist.** The comp shows two
   cards reading `ARTICLE`. If BRG has never been written about, this section cannot ship, and
   that's the same failure mode as the `XX` stats: a placeholder that looks like content.
   **Applying the SPEC-007 §1 doctrine: this section degrades to zero by being absent, and the
   page still works.** Hero → inquiries → gallery is a complete, coherent page. So
   `press-articles` should be built and held out of `stacks.press` until there are **at least
   two real articles**, rather than shipped with placeholders. One article in a two-card layout
   looks like a mistake; zero looks like a decision.
   **RESOLVED 2026-08-19 — three real articles exist and all three resolve HTTP 200. The
   two-article threshold this item set is cleared, so `press-articles` ships. Full metadata,
   reading order and the two content caveats in [§8.1](#81-press-articles--three-real-cards-verified).**
2. **9 food photographs.** Real, and BRG's own. See [SPEC-007 §2](content-gaps.md) — the same
   greyscale/crop constraints do *not* apply here (the gallery is in colour and square), so
   this is the one photography ask that can use existing marketing shots as-is.
3. **The photographer cutout for §2.3 — it does not exist.** `assets/media/imgs/` has the surfer
   (`brg-srfr-img-crop/full/trim`) and nothing else cut out. The comp's photographer, with his
   hand-drawn motion strokes, is a new asset from Sean. **The band ships fine without it** —
   it's a centred heading and button; the cutout is decoration — so this degrades gracefully and
   shouldn't block.
   **RESOLVED 2026-08-19 — Sean supplied a stand-in and it is the right shape. It is a
   recognisable Anchorman still, so it is a PRE-LAUNCH placeholder that must be pulled before
   go-live. Terms and the file move in [§8.2](#82-the-media-inquiries-cutout--placeholder-with-an-expiry).**
4. **The `press@` address** (§2.3), or the decision to route through Contact instead.
5. **The Media Inquiries sub line** (§2.3) — an addition to the comp, so Sean's gate.

---

## 7. Build order, if approved

1. `press-hero` — 11 lines, blocked only on the underline colour (§5a), and it can ship with an
   inline colour while that's decided.
2. `press-inquiries` — re-skin of `careers-positions`; ships without the cutout.
3. `press-gallery` — grid geometry from `team-members`; blocked on 9 photographs.
4. `press-articles` — the only real build, and the one that's blocked on content that may not
   exist. **Last, deliberately.**

Sections 1–3 are a shippable page on their own. That ordering is the whole point: it means
Press isn't blocked on BRG having press.

---

## 8. Resolved — 2026-08-19

Sean answered the three §6 blockers on the board. This section records what he decided, what
I verified, and the two places where **the answer on the board is not quite the answer that
works**. Everything here was checked against the working tree and the live web on 2026-08-19.

### 8.1 `press-articles` — three real cards, verified

Sean supplied three URLs. I fetched all three: **HTTP 200, and every field §2.2's card model
wants is present in their Open Graph metadata.** So the section ships — the "at least two real
articles" threshold in §6.1 is cleared.

In reading order (**reverse-chronological**, newest first):

| # | Outlet | Date | Headline (`og:title`) |
|---|---|---|---|
| 1 | WhatNow | 2026-06-16 | Southern California-Born Sandwich Brand Opens New Waterfront Location in San Diego |
| 2 | San Diego Magazine | 2025-05-19 | First Look: Odie's Pizza Opens in Oceanside |
| 3 | San Diego Magazine | 2024-09-25 | Portland Pizza Veteran to Bring Specialty Pizza Shop to Oceanside |

URLs are on board item `40b932c827`. Two things Finn should not have to discover mid-build:

**(a) Cards 2 and 3 are the same story at two stages.** #3 announces Odie's coming to
Oceanside (Sep 2024); #2 covers it opening (May 2025). Same restaurant, same city, eight months
apart. Three cards where two are one story reads thinner than three cards of three stories.
It still ships — this is a note, not a blocker — but if only two are shown, show **#1 and #2**
(different brands, both recent) rather than the two Odie's pieces. Sean's call if he wants all
three; the honest framing is *"three articles, two of which are the same story."*

**(b) Do not hotlink the thumbnails.** All three expose an `og:image`, so the thumbnails exist
— but two are hosted on `sandiegomagazine.com`. Hotlinking a publisher's image is someone
else's bandwidth, someone else's rights, and a dead card the day they reorganise their uploads
folder. **Download all three into `website/assets/media/imgs/press/` and reference them as
absolute CDN URLs**, per the CLAUDE.md rule that asset URLs inside fragments must be absolute
CDN URLs. `website/assets/media/` is `*` territory, so no ownership handoff is needed.

Worth knowing on the rights point: card #1's image filename is
`BoardBrew_Food-Spread_Courtesy-of-Blacktop-Restaurant-Group-1.jpg` — **BRG supplied that photo
to WhatNow**, so it is already ours to use. Cards 2 and 3 are the publisher's own photography
(one credited `PC-KimberlyMotos`), so if self-hosting those is a concern, the safe fallback is a
BRG-owned food shot per card rather than the article's image. That is a rights question, so
it is Sean's, not mine.

### 8.2 The Media Inquiries cutout — placeholder with an expiry

Sean supplied a stand-in at `assets/team/`, and it is genuinely the right object: a
transparent-background cutout of a news anchor, thematically correct for a press band and the
correct SHAPE for §2.3 (the comp's photographer bleeds off an edge).

- **Use the WebP, as Sean asked** — `brg-team_placeholder.webp` is **51KB** against the PNG's
  **669KB**, a 13× difference for the same image.
- **It has to move before it can be referenced.** `assets/team/` is outside `website/`, so it
  is not on the CDN and no fragment can point at it. Copy it to `website/assets/media/imgs/`.
  Do **not** try to `git add` it where it sits — and note *why*, because I got this slightly
  wrong first time: `/assets/` is **explicitly gitignored**, not merely untracked
  (`.gitignore`, root-anchored with a leading `/` on purpose, so that a bare `assets/` cannot
  also swallow `website/assets/`). So `git add` silently does nothing there, `git add -f`
  would be needed to force it, and the disclosure guard's refusal of new root-level files is
  the second line of defence rather than the first. Three guards agree: leave it where Sean
  put it, and copy.
- **It must not survive launch.** It is a recognisable still from *Anchorman*. Sean already
  said *"we just won't put it up until we go live"*, so this is his intent, recorded here so
  nobody later mistakes a placeholder for a decision. `GO-LIVE.md` is Conti's file, so I have
  filed the checklist entry to him rather than editing it.

§6.3's judgement still stands underneath all this: the band ships fine without any cutout, so
this never blocks the page.

### 8.3 The Press marker — derive a recoloured copy, not `currentColor`

Sean: *"can we just use the SVGs we have and recolor them?"* **Yes — and it costs one file
copy and one hex.** But the route recorded on board item `1854f27bf4` does not work, and two
claims behind it are wrong. Corrected here so nobody spends an afternoon on it:

1. **`fill="currentColor"` cannot work with the current markup.** The marker is referenced as
   an **`<img src=…>`** (`website/sections/home-hero/embed.html:92`, pointing at the CDN copy).
   CSS does not cross into an external image document, so the per-hero `color:` rule can never
   reach the path. `currentColor` only becomes available if the SVG is **inlined** into the
   fragment — a markup change to a pattern that currently has exactly one user.
2. **The path does not inherit its colour anyway.** `line-home-lg.svg` is one `<path>`, zero
   `stroke` attributes, `fill="none"` on the `<svg>` — and a **hardcoded `fill="#FAE200"` on
   the path itself**. There is no colour to inherit; there is a literal to replace.
3. **SPEC-004's "really three shapes, not five" does not hold at the path level.** I hashed the
   `d` attribute of all five `-lg` files: **all five are distinct.** home/restaurants/community
   have near-identical viewBoxes (`845×28`, `844×28`, `841×28`) which is almost certainly why
   they read as one curve, but they are three separate exports with different geometry. Nothing
   downstream breaks — you still copy exactly one of them — but "one path serves three pages"
   is not a thing the files support today.

> ## SUPERSEDED 2026-08-20 — Sean exported a real purple marker, so nothing is derived
>
> `line-purp-lg*.svg` now exists in `website/assets/media/lines/` in all three weights, flat
> and stroked. Press uses **`line-purp-lg-mid.svg`** (`851×34`) per Sean's weight ruling; no
> copy, no recolour, no `--violet` token. Contact takes the same file. Everything below is
> kept because the reasoning about `<img>` vs inline and the hardcoded `fill` is still true
> and still constrains anyone who tries to recolour a marker in future.
>
> **ONE THING TO CHECK BEFORE PRESS SHIPS, and it is Sean's call, not mine.** §5 of this spec
> measured the Press comp's hero underline as **`#5D0E8B`** — a dark violet. The artwork he
> exported is **`#A17DC4`**, a distinctly lighter lilac. Those are not the same colour and the
> difference is large enough to be deliberate — a dark violet on the black hero would be very
> low contrast, so the lighter value may well be him correcting the comp. Recording it rather
> than assuming either way: **the artwork wins unless Sean says the comp does.**

**So the build was going to be:** copy any existing `-lg` marker to `line-press-lg.svg` (and `-nav`),
change the one `fill` literal to violet `#5D0E8B`, drop both in `website/assets/media/lines/`,
reference by `<img>` exactly as `home-hero` does. **No new artwork from Sean, no export, no
markup change, and no `--violet` token** — which retires §5a's token-vs-inline question
entirely, since the colour now lives in the artwork where the other four already live. Contact
inherits the same recipe.

**One more confirmation for §5b while we are here:** that hardcoded `fill="#FAE200"` is the
artwork disagreeing with `brgw.css`'s `--yellow:#FCE200` for the **fourth** independent time.
§5b's recommendation — move the tokens to the artwork values — is still Conti's direction call,
and is now that much better evidenced.

### 8.4 What this leaves open

Nothing that blocks the build. Still genuinely outstanding, unchanged by these answers:

- **9 gallery photographs** (§6.2) — `press-gallery` cannot ship without them.
- **The `press@` address** (§6.4) and **the Media Inquiries sub line** (§6.5) — both still Sean's.
- **Whether to show two articles or three** (§8.1a) and **the thumbnail rights question**
  (§8.1b) — both Sean's, neither blocking.
