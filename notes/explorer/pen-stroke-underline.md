# SPEC-004 — Pen-stroke underline (replaces `.brgw-uline`)

**Status:** proposed · Expo · 2026-08-10 · from Conti's `PLAN:` 2026-08-10
**Study:** [`studies/pen-stroke-underline.html`](studies/pen-stroke-underline.html) — 7 sections, all verified rendering
**Wants a `DECISION:` from:** Conti — §6 GSAP load strategy, §7 the DrawSVGPlugin file
**Built by:** Finn (`brgw.css` + `brgw.js` + hero fragments)

---

## 1. Recommendation

**Ship variant 1 — single marker — as the default for every hero underline and the nav active item.**
It is the comp's own artwork moving; nothing is invented. Keep the other three as a named vocabulary
used deliberately, not as a menu applied per-page:

| Variant | Verdict | Where |
|---|---|---|
| **1 · Single marker** | **default** | every hero underline; nav active item (faster) |
| 2 · Rough marker | hold | only if Sean wants more grit — see the real cost in §5 |
| 3 · Two-pass emphasis | one moment only | a single CTA or stat per page, never five heroes |
| 4 · Scribble-circle | needs real artwork first | §4 — the shape in the study is mine, not the comps' |

Timing that reads right in the study: **0.72s, `power2.out`, 0.25s delay** behind the headline;
**0.34s** for nav, because nav feedback should feel immediate rather than performed.

## 2. The paths are real — and here's how they were derived

Conti's plan says "paths come from the exported section SVGs". They do, but not directly: **every
marker in `website/mocks/` is a filled outline with no stroke** (same as `assets/lines/`, SPEC-003),
and DrawSVG animates `stroke-dashoffset`, so a filled outline gives it nothing to act on.

They are recoverable exactly, because each is a **uniform-width stroke that was expanded to outline**.
Reading `brg_home-hero.svg`, the path runs the lower edge left→right, arcs 15px at the far end (a round
cap), returns along the upper edge, and caps back. So:

> **centerline = the leading edge, offset by half the cap height** — where the cap height, measured at
> the turn, *is* the stroke width.

Derived that way (script archived in the study's header comment), the six real markers are:

| id | stroke-width | viewBox | direction | colour |
|---|---|---|---|---|
| home | 15 | `0 0 847.4 29.97` | L→R | `#FAE200` |
| our-restaurants | 15 | `0 0 845.67 29.97` | L→R | `#00BEB4` |
| team | 15 | `0 0 649.36 26.9` | L→R | `#F40085` |
| community | 15 | `0 0 843.43 29.97` | L→R | `#F87513` |
| careers | 15 | `0 0 1123.75 32.16` | **R→L** | `#00BEB4` |
| nav (active) | 5 | `0 0 97.05 8.62` | L→R | `#00BEB4` |

Two things fell out of that table that change the build:

- **It's three shapes, not six.** Home, Our Restaurants and Community are the *same* curve to within
  ~2 units — only the length differs. With `preserveAspectRatio="none"` and
  `vector-effect="non-scaling-stroke"`, one path stretches to any headline width while the stroke stays
  exactly 15px. So ship `mk-long`, `mk-short` (team), `mk-rise` (careers), and `mk-nav`.
- **Careers is authored right→left.** Drawn naively it writes backwards. Fix at the draw, not by
  re-authoring the path: DrawSVG `drawSVG:"100% 100%" → "0% 100%"`, or with dashoffset, arm at `-1`
  instead of `1`. Flagged in the study with `data-reverse`.

## 3. Integration — where this goes in `brgw.js`

It replaces `.brgw-uline` but it should **not** become a fourth thing the reveal engine hard-codes.
The engine's existing contract is: CSS owns the hidden state, `.reveal.is-in` owns the trigger. Keep that.

**Markup** (hero fragment — Finn's file):
```html
<span class="brgw-uline" aria-hidden="true">
  <svg viewBox="0 0 847.4 29.97" fill="none" preserveAspectRatio="none">
    <path class="brgw-uline__mk" pathLength="1" vector-effect="non-scaling-stroke"
          stroke-width="15" stroke-linecap="round"
          d="M8.5 18.09C116.56 13 224.72 10.04 332.9 9.27C441.06 8.5 549.25 9.89 657.35 13.45C717.9 15.44 778.41 18.12 838.9 21.47"/>
  </svg>
</span>
```
`stroke` stays out of the markup — `brgw.css` keeps driving colour off the existing per-hero
`.brgw-sec--<id> .brgw-uline{color:var(--pink)}` rule via `stroke:currentColor`.

**Hidden state in CSS, exactly like `.anim-head`** — `pathLength="1"` makes this resolution-independent:
```css
.brgw-uline__mk{stroke:currentColor;stroke-dasharray:1;stroke-dashoffset:1}
.brgw .reveal.is-in .brgw-uline__mk{stroke-dashoffset:0;
  transition:stroke-dashoffset .72s cubic-bezier(.22,.9,.24,1) .25s}
.brgw-uline--rev .brgw-uline__mk{stroke-dashoffset:-1}       /* careers */
@media (prefers-reduced-motion:reduce){
  .brgw-uline__mk{stroke-dasharray:none;stroke-dashoffset:0;transition:none}
}
```
**That's the whole feature, in CSS, with no JS at all** — because `.reveal.is-in` is already applied by
the existing IntersectionObserver. GSAP is only needed if we want per-path stagger or scrub (§6).

Add the `<noscript>` override the fragments already carry for `.anim-head`, plus rely on the engine's
existing 3500ms hard fallback so a stalled font gate can't leave a stroke permanently undrawn.

## 4. The scribble-circle is not in the comps

I searched every SVG in `website/mocks/`. There is **no scribble-circle anywhere in the design.** The
nearest marker artwork is the hand-drawn *numerals* in `brg_community-stats.svg` — variable-width brush
glyphs, not uniform strokes, so they can't be centerline-derived the way §2 does. The loop in the study
is drawn by me in the marker idiom to show the motion and prove the timing (1.15s, `power1.inOut`,
~1.6 loops, stroke 9 — at 15 a loop that tight closes into a blob).

**Ask before building it:** if we want this, the shape should come from Sean's hand, exported the same
way as the others but **without Expand/Outline Stroke**, so it arrives as a centerline and skips §2
entirely.

## 5. What the study actually showed

- **Variant 1 mid-draw is the whole argument.** At 42% the ink has a live rounded leading edge — the
  round cap grows as it travels. A clip-wipe (SPEC-003's recommendation, before these paths existed)
  can't do that; it presents a flat vertical edge. With real stroked centerlines, **the draw is now
  strictly better than the wipe**, and SPEC-003 §1's Option A is superseded for the hero underline.
- **The A/B is unflattering to what ships.** Today's blob renders as a tapered wedge and `scaleX`
  distorts it at every frame; the marker holds even weight end-to-end and never deforms.
- **Rough marker costs more than it looks.** `feDisplacementMap` forces the stroke onto its own raster
  surface and re-rasterises **every frame of the draw** — at hero width that's the most expensive thing
  on the page. The filter region also has to be generous (`y:-120% height:340%`) or the noise clips the
  stroke's own edge. **Never animate the `seed`.** At scale 11 it stops reading as our marker and starts
  reading as a scratchier brand.
- **Two-pass only works if pass 2 is thinner and dimmer** (w11/α.82 against w15). Two identical strokes
  read as a rendering bug, not emphasis.

## 6. The GSAP question — and a correction to SPEC-003

**I need to correct myself.** SPEC-003 §5 argued against GSAP partly because `vcc_shared_assets()`
inlines `brgw.js`, so inline script isn't cacheable across pages. Finn didn't bundle it — GSAP is
self-hosted in `assets/vendor/` and loaded with `<script src>`, which **is** browser-cached across every
page. That objection doesn't apply, and the cost is one cached ~116KB download, not a per-page tax.

The live decision is different, and it's real: `startMotion()` today loads GSAP **only if the page
contains `[data-brgw-img]`, `[data-brgw-parallax]` or `[data-brgw-pin]`. Every hero has an underline.**
So routing the underline through GSAP silently converts a lazy dependency into a site-wide one.

| | Approach | GSAP loads | Verdict |
|---|---|---|---|
| **A** | CSS `stroke-dashoffset` on `.reveal.is-in` (§3) | only for scrub work, as today | **recommended** |
| B | GSAP + DrawSVGPlugin, added to `MOTION_SEL` | every page | defensible, buys little here |

For a single open path with `pathLength="1"`, `drawSVG:0→100%` and `stroke-dashoffset:1→0` produce
**identical output** — the study runs the dashoffset path and looks exactly like the plan intends.
DrawSVG earns its keep on multi-subpath shapes, partial draws (`"20% 80%"`), and measuring paths you
didn't author — none of which this needs. My recommendation is **A**, and to keep DrawSVG in reserve for
the scribble-circle, which is multi-loop and may well want partial draws.

If Conti prefers **B** anyway, the study already supports it: it detects `window.DrawSVGPlugin` and uses
it when present, so dropping the file in flips it with no other change.

## 7. Pairing with split text — and the Blanco crop (§8 of the study)

Sean's read is right on both counts: they pair well, and the mask *is* living close to the edge.

**Sequencing.** Lines keep the engine's existing 85ms stagger; the marker starts at **+280ms** so it
lands just after the last line settles rather than racing it. Study §8 runs the real production markup
— `.ln` with `overflow:hidden` and `padding:.30em .10em .16em`, `.ln-i` from `translateY(160%)` — in the
real Blanco, with the marker behind it.

**The crop, measured rather than eyeballed.** The study carries a live audit that measures ink position
against the actual mask box in the actual DOM (nothing hardcoded):

| | measured |
|---|---|
| headroom above the ink | **+0.163em** |
| headroom below the ink | **+0.202em** |
| current copy's tallest ink (`’`) | 0.872em |
| **what the mask can hold** | **1.034em** |
| **tallest glyph in the face (`é`)** | **1.132em** |

So: **today's copy does not clip — but the face doesn't fit the mask.** There's 0.163em of slack, and
`é` needs 0.098em more than the mask has. Any accented capital in a headline gets shaved, and nothing
warns you; it just looks like a slightly wrong letterform. Horizontal is fine (worst overhang 0.067em
against 0.10em of padding), and descenders are fine (worst 0.184em against 0.346em).

**Fix — one line in `brgw.css`, no layout change:**
```css
.brgw .ln{padding:.42em .10em .16em;margin:-.42em -.10em -.16em}   /* was .30em top */
```
The negative margin already cancels the padding, so spacing is untouched. `.42em` puts the budget at
~1.155em, clearing the whole face with room. **Raising the *top* padding is safe for the reveal**: the
line travels upward from `+160%` and stops at rest, so it is never above its rest position — extra
room above the mask can't leak it early. (The same is *not* true of `padding-bottom`, which is why
that one should stay at `.16em`.)

**Caveat I could not close.** I couldn't reproduce a clip in today's copy, so if what Sean saw was on a
specific headline, the cause may be different from the one I found. My leading suspect is the font
gate rather than the padding: `splitByWords` groups words into lines by measuring `offsetTop`, and
`startRevealGate` will fall through on a 1800ms race / 3500ms hard timeout. If Blanco resolves *after*
that fallback fires, the grouping is measured in Montserrat metrics, so a line can end up wider than
`.ln` — and `overflow:hidden` then cuts the end of it off horizontally. That would look exactly like
"the font got cropped." Worth Finn checking on a throttled connection before we call it fixed.

## 8. Asks

- **DECISION (Conti) — §6, A or B.** Everything else in this spec is unaffected either way.
- **NEED (Conti) — `DrawSVGPlugin.min.js` is not in `assets/vendor/`;** only `gsap.min.js` and
  `ScrollTrigger.min.js` are. Option B can't be built until someone adds it. I haven't downloaded it —
  that's a call for you or Sean, not me.
- **QUESTION (Sean) — the scribble-circle shape** (§4), if we want it: re-export from Figma *without*
  outlining the stroke.
- **NEED (Finn) — `.ln` mask padding `.30em → .42em`** (§7). One line, no layout change, closes a latent
  crop on any accented capital.
- **QUESTION (Finn) — the font-gate hypothesis** in §7's caveat: does a throttled connection produce
  horizontally-clipped headlines, via `splitByWords` measuring in fallback metrics?
- **NEED (Finn) — two capture traps**, both of which cost me time and will cost you a bad screenshot:
  1. **ScrollTrigger's `onEnter` never fires for anything already above the start line at first paint** —
     i.e. the hero, always. IntersectionObserver reports already-visible elements when you observe them;
     ScrollTrigger only fires on *crossing*. If any of this ever moves to ScrollTrigger, it needs an
     explicit initial sweep (the study has one, commented).
  2. **GSAP's ticker is rAF-driven, and rAF is frozen in headless/background capture** — `gsap.ticker.frame`
     sat at 4 after two seconds, so every tween stayed at progress 0 and the page looked broken when it
     wasn't. Same family as your `.anim-head` font-gate trap. Drive motion deterministically for
     screenshots (set progress explicitly) rather than sleeping and hoping. Note this bites GSAP motion
     only — the CSS path in §3 is immune, which is a quiet argument for A.
