# SPEC-014 — The splash's four plates, brought to the home hero

**Status:** proposed · BRG Specs · 2026-08-21 · board `5bc6e53687`
**Verified against:** working tree at `3e12748`, plus the Oxygen splash build in the **main
clone only** (`index.html`, `css/brg-coming-soon.css` — gitignored, absent from every worktree).

Sean: *"The skater crown car and surfer on the homepage are big together, but on the splash page,
they are not. I'm referring to those on the splash page and bringing those over, and also any
other unique entrance animation pieces that would apply for content that's on the homepage right
now — not adding anything else new, just the background images."*

**Ruled: entrances fire ON LOAD, drift runs always.**

---

## 0. A correction, because it is load-bearing

I first reported that the splash background does not animate. **That was wrong.** I searched
`index.html` for the CSS; the CSS is in `css/brg-coming-soon.css`, which I had not opened. A grep
of the wrong file returning nothing is not evidence of absence. Sean pushed back and was right.
Recorded here because the retracted claim is on the board and someone will find it.

## 1. What the splash actually does

Sean's own comment in the source states the intent:

> *"Photo ENTRANCES (play once, on a black screen). 1) skater = full-screen center cover; fades
> in while scaling DOWN to size. 2) surfer slides in from the bottom-right; car from the left;
> crown fades. Each then hands off to its slow drift loop (delayed past the entrance)."*

| Plate | Entrance | Drift |
|---|---|---|
| skater | `brg-skater-in 1.4s` `cubic-bezier(.16,.7,.2,1)` — opacity 0→.30, scale 1.2→1.02 | `brg-skater-drift 36s` |
| car | `brg-car-in 1s` @`.9s` — opacity 0→1, `translateX(-60%)`→0 | `brg-drift-a 40s` |
| surfer | `brg-surfer-in 1s` @`1.05s` — opacity 0→1, `translate(58%,46%)`→0 | `brg-drift-c 30s` |
| crown | `brg-crown-in .8s` @`1.25s` — opacity 0→.8, scale .7→1 | `brg-drift-c 26s` |

All entrance easings are `cubic-bezier(.2,.7,.2,1)` except skater. Drifts are `ease-in-out
infinite`, amplitude ~1–1.5% translate with a 1.02→1.05 scale, or a `.4deg` rotate for `drift-c`.

Supporting layers: `.brg-grit` on `brg-drift-a 48s`; `.brg-bg__noise` on `brg-grain .42s
steps(1,end) infinite` (a ten-keyframe hard-cut jitter, ±5%); three `.brg-fx-blob` layers on
34s / 46s / 40s.

Base `.brg-photo`: `position:absolute`, cover/center, `opacity:.30`,
`filter:grayscale(1) contrast(1.04)`, `will-change:transform,opacity`.
Per plate: **skater** is the full-bleed cover layer; **car** is 50%×30% bottom-left with a
radial-gradient soft edge; **crown** is `top:2% right:4%`, 40% wide, `filter:invert(1)`,
`opacity:.8`.

## 2. What the home hero has today

One baked image. `home-hero/embed.html:4` says so outright — *"four separately-positioned plates
this had before. The spray crown is baked into that."* So this spec **restores a composition that
was deliberately collapsed**, and whoever collapsed it had a reason. Worth asking Conti what it
was before the work starts; it is not in `notes/controller.md` that I can find.

Today: `.plate` (a single `<img>`, `brg-img-home-xl.webp`) with `object-fit:cover`, a scroll-in
transform on `.is-in`, `data-brgw-parallax=".55"`, plus a `.grit` overlay and a `.veil`.

## 3. Assets — nothing to produce

**All four plates are already published** in `website/assets/media/bg/`: `skater.webp`,
`car.webp`, `surfer.webp`, `crown-white.webp` (also `crown.webp` and a PNG fallback), and
`grit.webp` which the hero already uses. Three of the four are already referenced live elsewhere
on the site at known dimensions — skater 733×1100, surfer 548×820, car 492×760.

**So this is pure markup and CSS. No export, no upload, no CDN change.** That is the strongest
argument for doing it: the expensive half already happened.

## 4. THE COLLISION — the one thing that will break this

**Parallax and the drift animation both write `transform` on the same element, and the JS wins.**

The splash has no parallax at all (`scroll`, `parallax`, `IntersectionObserver`,
`requestAnimationFrame` — all zero occurrences in its source). The home hero does. Proof, taken
from the **live** HTML captured in BugHerd pin 4 rather than from reading our source:

```
style="translate: none; rotate: none; scale: none; transform-origin: 50% 50%;
       transform: translate(0%, 0.6186%) translate3d(0px, 0px, 0px) scale(1.2, 1.2);"
```

That is an **inline** `transform`, set by JS on every scroll frame. An inline style beats a CSS
`animation` on the same property, so a plate that is both parallaxed and drifting will simply
not drift — and it will fail *silently*, looking like the drift was never applied.

**Fix: separate the two onto nested elements.**

```html
<div class="plate plate--skater" data-brgw-parallax=".55">   <!-- JS writes transform here -->
  <div class="plate__inner"></div>                            <!-- CSS animates transform here -->
</div>
```

One transform per element, no competition, both effects intact. This is the whole reason the
spec exists rather than being a paste job.

## 5. Trigger — Sean's ruling, and how to honour it

**Entrances on load; drift always.** The hero is the top of the page, so it is in view at load
and `.is-in` fires almost immediately — but "almost" is not "always", and a slow connection or a
deep link with a hash can leave the hero un-revealed. So:

- Entrances are plain CSS `animation … both` on the section, **not** gated on `.is-in`. `both`
  holds the from-state before the delay so nothing flashes at its final position first.
- Drifts are separate `animation` declarations with their own delays, past the entrance, exactly
  as the splash does it — two comma-separated animations per plate.
- `@media (prefers-reduced-motion:reduce)` kills both and pins every plate at its end state.
  `brgw.css` already has six such blocks; this follows the house pattern.

## 6. Scope — what Sean explicitly excluded

*"Not adding anything else new, just the background images."* So:

- **In:** the four plates, their entrances, their drifts, and the grit drift + grain, which act
  on content the hero already has.
- **Out:** the three `.brg-fx-blob` layers. They are splash-only decoration with no counterpart
  on the homepage, so they would be new content. Flagged rather than silently dropped.
- **Out:** the logo assembly and icon entrance sequence. Those animate the splash's *lockup*,
  which the homepage does not have.

## 7. Open

1. **Why were the four plates baked into one image?** `home-hero/embed.html:4` records that it
   happened, not why. If it was a performance call, four images plus two animations each is
   exactly the decision being reversed. **Conti's, before build starts.**
2. **The surfer plate's `background-image` is not in its rule** — it sets only colour, size and
   position. Its URL comes from somewhere I have not isolated. Not blocking (the published
   `bg/surfer.webp` is the obvious file and the homepage already uses it) but it should be
   confirmed rather than assumed.
