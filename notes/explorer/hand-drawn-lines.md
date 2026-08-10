# SPEC-003 — Hand-drawn underlines (`assets/lines/`) + the GSAP DrawSVG question

**Status:** proposed · Expo · 2026-08-10
**Wants a `DECISION:` from:** Conti (colour-token question §6; GSAP call already ruled §5)
**Built by:** Finn (`brgw.css` + hero section fragments — no plugin change needed, see §4)

---

## 1. Short answer

The shapes are **right** — they map 1:1 onto what we already have, no ambiguity (§2).

**DrawSVG will not animate them as exported.** All ten files are a single **filled outline path**
— `fill="none"` on the `<svg>`, one `<path fill="#…">`, and **zero stroke attributes in any of the
ten**. DrawSVG works by animating `stroke-dasharray`/`stroke-dashoffset`; with no stroke there is
nothing for it to dash. Force a stroke on these and you don't draw the line — you trace an outline
*around* the blob, out along the top edge and back along the bottom, which reads as a loop being
lassoed, not a pen stroke.

That's a file-format issue, not a "these are wrong" issue. Two ways forward, and I recommend the
first:

| | How | Re-export? | New dependency | Look |
|---|---|---|---|---|
| **A — clip wipe** ✅ | Keep the filled path exactly as-is; reveal it left→right with `clip-path` | no | **none** | pen-stroke, indistinguishable here (§3) |
| B — true draw | Re-export the **centerline** (don't expand/outline the stroke), animate `stroke-dashoffset` | yes, all 10 | none needed — GSAP optional | true draw incl. the cap growing |

**Neither needs GSAP.** §5.

## 2. What the files are

Ten files, `assets/lines/line-<page>-{nav,lg}.svg` — a nav-menu underline and a hero underline per
page. The `-lg` colours land **exactly** on the per-page hero underline colours Finn already
shipped, which is what makes the mapping certain:

| Page | `-lg` | SVG fill | current `.brgw-uline` | `-nav` |
|---|---|---|---|---|
| home | 845×28 | `#FAE200` | `color:var(--yellow)` | 95×7 |
| our-restaurants | 844×28 | `#00BEB4` | `var(--teal)` | 188×8 |
| team | 647×25 | `#F40085` | `var(--pink)` | 68×7 |
| community | 841×28 | `#F87513` | `var(--orange)` | 104×7 |
| careers | 1122×31 | `#00BEB4` | `var(--teal)` | 104×7 |

All five `-nav` files are teal and are **sized to their own word** (68 for "Team", 188 for "Our
Restaurants"), i.e. drawn under each menu item individually. Their ~5px stroke at 7px tall matches
the **6.3px active underline Finn measured off the 1920 comp** — these *are* the comp's nav
underline, replacing today's flat 2px `::after` bar.

**The centerline is recoverable.** Reading `line-home-nav.svg`: the path runs the top edge left→
right, arcs 5px down at x≈92.4 (a round cap), returns along the bottom edge, arcs back at x≈2.4.
That is a **uniform ~5px stroke with round caps, expanded to outline** — so Option B is a re-export
away (Illustrator/Figma: export the path *without* Object → Expand / "outline stroke"), and a
`stroke-width:5; stroke-linecap:round` centerline would reproduce the artwork essentially exactly.

## 3. Why the wipe is genuinely as good here (and fixes a real bug)

Draw-by-dashoffset and wipe-by-clip differ **only on paths that double back or run right-to-left**.
Every one of these is a monotonic left→right underline, so at 60fps the two are visually the same
animation. The one honest difference: the leading round cap presents as a flat vertical edge for
its first ~5px of travel. On a 95px line that is ~5% of the sweep, at speed, in a 5px-tall shape.

**And it fixes something that's wrong today.** `.brgw-uline` currently animates
`transform:scaleX(0)→scaleX(1)` ([brgw.css:78–82](../../website/assets/brgw.css)). On the old CSS
blob that was fine. Applied to these files it would **squash the round caps into ellipses** for the
whole transition — the shape is horizontally distorted at every frame except the last. A clip wipe
never distorts the artwork; it uncovers it. So swapping `scaleX` → `clip-path` is the correct move
regardless of which option we pick.

```css
/* brgw.css — replaces the scaleX rule at :78–82 */
.brgw-uline{display:block;width:min(340px,62%);margin:16px auto 0;
  clip-path:inset(0 100% 0 0);}                     /* hidden at first paint, same as today */
.brgw-uline svg{display:block;width:100%;height:auto;}
.brgw .reveal.is-in .brgw-uline{clip-path:inset(0 0 0 0);
  transition:clip-path .75s cubic-bezier(.25,.8,.3,1) .3s;}
@media (prefers-reduced-motion:reduce){
  .brgw-uline{clip-path:none!important;transition:none!important;}
}
```
`inset()`→`inset()` interpolates cleanly and needs no JS. It rides the existing reveal engine
untouched — `.reveal.is-in` is already the trigger, so stagger and scroll-in behaviour are unchanged.

## 4. The nav underline needs **no plugin change** — which matters right now

The nav is emitted by the plugin (Conti's file) as bare `<a href="/team/">Team</a>` with no
per-page class, and the plugin is behind the deploy gate. But the href *is* the discriminator, so
this is pure `brgw.css` — Finn's file, shippable today:

```css
.brgw-nav a::after{                       /* replaces the 2px teal bar at :64–66 */
  content:"";position:absolute;left:0;right:0;bottom:-2px;height:6px;
  background:no-repeat center/100% 100%;
  clip-path:inset(0 100% 0 0);
  transition:clip-path .28s cubic-bezier(.4,0,.2,1);
}
.brgw-nav a[href="/"]::after            {background-image:url('…/lines/line-home-nav.svg');}
.brgw-nav a[href="/our-restaurants/"]::after{background-image:url('…/lines/line-restaurants-nav.svg');}
.brgw-nav a[href="/team/"]::after       {background-image:url('…/lines/line-team-nav.svg');}
.brgw-nav a[href="/community/"]::after  {background-image:url('…/lines/line-community-nav.svg');}
.brgw-nav a[href="/careers/"]::after    {background-image:url('…/lines/line-careers-nav.svg');}
.brgw-nav a:hover::after,.brgw-nav a.is-active::after{clip-path:inset(0 0 0 0);}
```

Caveat to hand Finn: Home's manifest `url` override (the page lives at `/brg-home/`) means the
`a[href="/"]` selector must match whatever `pages.json` actually emits — worth reading, not assuming.

## 5. GSAP: no, and this is consistent with the ruling already made

Finn asked for a dependency ruling and Conti answered: baseline stays the bespoke engine, reach for
GSAP **when a specific effect warrants it** (scroll-scrub, timelines). Applying that test here:

1. **DrawSVG can't act on these files at all** as exported — so it isn't even an option today.
2. **After a re-export it still wouldn't be needed.** `stroke-dashoffset` from `getTotalLength()`
   is a few lines of vanilla JS, or pure CSS with a hardcoded length.
3. **The cost is unusually high in our architecture.** `vcc_shared_assets()` **inlines** `brgw.js`
   into the page body — inline script is **not cacheable across pages**, so ~75KB of GSAP + plugin
   would be re-downloaded on *every page view*, forever, to do what one CSS property does.

Where I'd still spend it, per Conti's rule: scroll-**scrubbed** motion (a line that draws as you
scroll rather than on entry), pinned sections, or MorphSVG-class shape work. If GSAP ever does come
in, load it as an external cacheable `<script src>` — never inlined into the shared bundle.

## 6. Blockers / asks

- **NEED (Finn) — files are in the wrong place.** They're at repo-root `assets/lines/`. Netlify's
  publish dir is `website/` ([netlify.toml](../../netlify.toml)), so as they stand they are **not on
  the CDN and would 404**. They belong at `website/assets/media/lines/`, alongside `fonts/`,
  `logos/`, `icons/` — which `netlify.toml` already serves with `Access-Control-Allow-Origin:*` and
  a one-year cache.
- **Inline the `-lg` ones, link the `-nav` ones.** The hero lines want `fill="currentColor"` so the
  existing `color:var(--yellow|teal|pink|orange)` per-hero rule keeps driving them — and
  `currentColor` doesn't survive `background-image` or `<img>`. They're 413–849 bytes each; inlining
  the markup in the hero fragment costs less than the request it saves. The nav five are all one
  teal, so `background-image` is fine there.
- **QUESTION (Conti) — our colour tokens don't match the artwork.** All four differ, systematically:
  teal `#00BEB4` vs `--teal:#19C7C2`, yellow `#FAE200` vs `#FCE200`, pink `#F40085` vs `#EC0F8D`,
  orange `#F87513` vs `#F5821F`. These SVGs came out of the design source, so I'd treat them as
  authoritative and the tokens as drift — but that's a direction call, it affects **every** page, and
  it's your file. `currentColor` makes the lines follow whatever you decide, so it doesn't block.
