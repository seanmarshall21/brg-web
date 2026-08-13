# SPEC-005 — Press & Gallery: the section plan

**Status:** proposed · Explorer · 2026-08-13 · comp: `website/mocks/build-spec/page-7.png` ·
spec source: [`website/BUILD-SPEC.md` §2.6](../../website/BUILD-SPEC.md)

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
2. **9 food photographs.** Real, and BRG's own. See [SPEC-007 §2](content-gaps.md) — the same
   greyscale/crop constraints do *not* apply here (the gallery is in colour and square), so
   this is the one photography ask that can use existing marketing shots as-is.
3. **The photographer cutout for §2.3 — it does not exist.** `assets/media/imgs/` has the surfer
   (`brg-srfr-img-crop/full/trim`) and nothing else cut out. The comp's photographer, with his
   hand-drawn motion strokes, is a new asset from Sean. **The band ships fine without it** —
   it's a centred heading and button; the cutout is decoration — so this degrades gracefully and
   shouldn't block.
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
