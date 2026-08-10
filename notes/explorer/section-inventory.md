# SPEC-002 — Section inventory (what's already in the 5 fragments)

**Status:** proposed · Explorer · 2026-08-09 · companion to [SPEC-001](stacking-sections.md)

I read all five page fragments and pulled out every distinct section block. **14 archetypes**,
six of which already appear on 2+ pages — the reuse case for SPEC-001 isn't hypothetical, it's
copy-paste that already happened.

Harvest order below is deliberate: 1–6 are the near-duplicates (biggest win, least risk), 7–11 are
single-use but clearly reusable, 12–14 are one-offs I'd leave in their page fragments for now.

## The 14

| # | Proposed `id` | Today | Used on | What it is | Slots I'd expose |
|---|---|---|---|---|---|
| 1 | `hero-page` | `.brgw-hero` | restaurants, team, community, careers | Dark centered hero: H1, squiggle rule, sub, optional doodle. Styles already **shared** in `brgw.css`, only content differs. | `heading`, `sub`, `rule_color`, `anchor` |
| 2 | `badge-rule` | `.or-badge` `.tm-badge` `.ca-badge` `.cm-badge` | all four | A single `.brgw-badge` circle (or `.brgw-banner`) as a divider between sections. Four names, one thing. | `variant` (badge\|banner), `label`, `bg` |
| 3 | `cta-band` | `.tm-cta` `.ca-join` `.cm-partner` | team, careers, community | Heading + paragraph + yellow button, scattered doodles. Three near-identical implementations. | `heading`, `sub`, `cta_label`, `cta_href`, `anchor` |
| 4 | `intro-lede` | `.tm-intro` `.cm-intro` | team, community | One wide lede paragraph, often with a `.hl` highlight, sometimes a `.brgw-banner` under it. | `body` (type `html` — needs `<span class="hl">`), `banner` |
| 5 | `hero-full` | `.brgw__hero` | home | The 88vh photo hero: grayscale bg, radial scrim, drifting `brgw-herodrift`, tag line, CTA, squiggle. The site's signature moment. | `heading`, `sub`, `tag`, `cta_label`, `cta_href`, `image` |
| 6 | `apply-button` | `.ca-apply` | careers | A lone centered `.btn.anim-cta`. Trivial, but it's the spacer-plus-button pattern that keeps recurring. | `cta_label`, `cta_href` |
| 7 | `value-grid` | `.brgw__values` | home | 6 cards in a 1/2/3-col hairline grid, each a teal `.lbl` + paragraph. | `heading`; cards stay in-repo |
| 8 | `statement-pair` | `.brgw__vm` | home | Yellow rotated banner head + two label/big-statement blocks (Vision / Mission). | `heading`, both labels + statements |
| 9 | `copy-2col` | `.brgw__about` | home | H2 with `<br>`-split reveal + two body columns at ≥800px. | `heading` (`html`, needs `<br>`/`.hl`), `body_a`, `body_b` |
| 10 | `brand-row` | `.or-row` | restaurants (×2) | Alternating card/text row — logo card, H3, two paragraphs, Visit Us button, `.or-rule` between. Already used twice with a reverse modifier. | `name`, `location`, `body_a`, `body_b`, `cta_href`, `flip` |
| 11 | `stat-strip` | `.cm-stats` | community | Four big `brgw-pulse` numbers with captions. Three still read `XX` — placeholder data. | `n1..n4`, `label1..label4` |
| 12 | `people-grid` | `.tm-grid` | team | 9 crew cards, colored `.pic` placeholder + name/title overlay. | leave in-repo — real headshots pending (STATUS open item 3) |
| 13 | `media-slider` | `.cm-give` | community | The auto-advancing `.brgw-slider` with alternating media/body slides. | leave in-repo — slide count and copy are page-specific |
| 14 | `perks-list` | `.ca-like` | careers | Two-col: heading + two paragraphs beside a boxed "We offer" `<ul>`. | `heading` (`html`), `body_a`, `body_b`, list stays in-repo |

## Notes the Finesser will want

- **`hero-page` is already half-shared.** Its CSS lives in `brgw.css` (`.brgw-hero`, `.brgw-hero h1`,
  `.brgw-hero .sub`), so section #1 is nearly pure markup. It's the cheapest possible Phase-2
  harvest and I'd do it first.
- **Doodles are positioned per-instance** — every `.brgw-doodle` carries an inline
  `style="top:…;right:…"`. When these become sections the positions must ride along in the
  fragment, not become slots; they're art direction, not content. (They're hidden < 560px by
  `brgw.css` already, so mobile is unaffected either way.)
- **`cta-band` variants differ only in background and doodle placement.** `.tm-cta` and `.ca-join`
  are the same section with different doodles; `.cm-partner` puts the button *above* the
  paragraph. I'd normalise to button-below and flag the one visual change for the Controller
  rather than carry a `button_first` slot forever.
- **Don't slot list/grid content** (#7, #11, #12, #14). Once a 9-card grid lives in shortcode atts
  it's out of git, unreviewable, and one bad paste from breaking a layout. Repo-side stays repo-side.
- **`stat-strip` blocks on real numbers.** Three of four are `XX`. Harvesting it is fine; shipping
  it needs the data (already STATUS open item 3, alongside headshots and logos).
- **`media-slider` must stay one section.** `.brgw-slider__track > *` is `flex:0 0 100%`
  ([brgw.css](../../website/assets/brgw.css)) — splitting slides across shortcodes would put them
  in different tracks. One slider = one section, always.

## What this buys

Careers (#1, #2, #14, #6, #3) and Team (#1, #4, #2, #12, #3) become five shortcodes each, four of
them shared. That's the Phase-3 test in SPEC-001 — and Careers is the smaller of the two, which is
why I picked it.
