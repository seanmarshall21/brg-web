# SPEC-009 — The text-attached underline

**Status:** proposed · Explorer · 2026-08-13 · commissioned by Sean via Conti ·
source: [Osmo, `codepen.io/osmosupply/pen/qEEKRrx`](https://codepen.io/osmosupply/pen/qEEKRrx) (MIT) ·
demo: **[Three Underlines](https://claude.ai/code/artifact/b339f004-60aa-4ead-b2ec-0493141ef97c)**

Sean picked the Osmo pen and set the trigger model: **nav is hover; everything else, hero
included, fires on scroll-in — after the split-text animation.** That resolves what looked like
a defect in the pen. Hover isn't wrong, it's *right for nav and wrong for heroes*, so we need
one stroke system with two triggers rather than a choice between them.

**The finding that should drive the build, and it isn't the one anyone was looking for:**
`splitByWords` rebuilds the headline from `el.textContent`
([`brgw.js:24-25`](../../website/assets/brgw.js)). **It destroys all inner markup.** The four
heroes we'd most want a text-attached underline on are exactly the ones running it. §3.

---

> **RULED 2026-08-17 — Sean: not random, and the strokes are his, not Osmo's.**
> *"It doesn't need to be random. It just needs to follow the same ones that are in the prototype
> sample from Figma that I exported."* That answers §6's open question and changes what we take
> from the pen. **We take the draw technique, not the artwork.**
>
> His exports are already in the repo — `website/assets/media/lines/line-<page>-lg.svg`, five hero
> shapes and five nav ones, one per page. So each page draws **its own fixed mark**, every time.
> Osmo's six variants and the random picker both come out.
>
> **The one thing this needs, and it's already solved:** those ten files are *filled outline*
> paths with `fill="none"` on the svg and **zero stroke attributes**
> ([SPEC-003](hand-drawn-lines.md)), so `stroke-dashoffset` has nothing to dash — forcing a stroke
> traces the blob's outline out-and-back and reads as a lasso, not a pen. [SPEC-004](pen-stroke-underline.md)
> already recovered the centerlines (uniform stroke expanded to outline → centerline = leading
> edge offset by half the cap height) and found two things that change the build:
> **it's three shapes, not five** — home, our-restaurants and community are the same curve, so one
> path plus `preserveAspectRatio="none"` covers all three — and **`line-careers-lg.svg` is authored
> right→left**, so it writes backwards unless drawn from the far end.
>
> Cleanest path is still to **re-export the five unexpanded**, as strokes rather than outlines; the
> derived centerlines are the fallback if that's a nuisance. Everything below stands unchanged —
> only the source of the path data moves.

## 1. Which implementation

**Recommend: ~~Osmo's six stroke paths~~ Sean's five per-page marks, drawn with
`stroke-dashoffset` in CSS. No GSAP.**

Not a different effect — *the same effect by another route.* For a single open path,
`drawSVG:0→100%` and `stroke-dashoffset:1→0` are the same animation; that's already established
in [SPEC-004 §6](pen-stroke-underline.md), and the demo runs both so it can be checked rather
than believed.

**Correcting myself first, because it's the reason this looked harder than it is.** I filed
DrawSVG as a blocker in August on the grounds that it's a paid Club GreenSock plugin. **Sean
asked whether DrawSVG is a GSAP feature — it is, and since GSAP 3.13 the whole library including
DrawSVG is free**, which is why the pen loads it from a public CDN. We already vendor GSAP. So
there is no licence problem and no missing-file problem; that objection is dead and I should
have retired it before it shaped a recommendation.

What survives, and it's modest:

| | DrawSVG | dashoffset |
|---|---|---|
| Output | identical for a single open path | identical |
| Library | GSAP loads on **every** page (every hero has an underline), so it stops being lazy | none |
| Cost of that | one cached ~116KB download — *not* a per-page tax, per my own 2026-08-10 correction | — |
| Nav hover | a tween per item on `mouseenter` | a CSS `:hover` transition |
| Reduced motion | needs handling in JS | already covered by `brgw.css` |

The deciding factor is **nav**, not the heroes. Nav underlines are hover-driven on up to seven
items; in CSS that's one `transition` rule, in GSAP it's tween lifecycle management per item —
which is exactly the code the pen spends most of its length on (`enterTween`/`leaveTween`
guards). We'd be importing a library to do what one CSS property already does.

**If Sean prefers DrawSVG anyway, nothing here breaks** — the six paths and the trigger model are
the same; only the draw mechanism swaps. That's worth stating, because the strokes are the part
he actually chose.

**Two traps in the export, both real:**
- **Four of the six variants hardcode `stroke="#E55050"`.** `decorateSVG` overwrites it at
  runtime, so the pen looks fine — lift the SVGs without that step and you get red markers.
  Set `stroke="currentColor"` in the source when they're vendored.
- The CSS-scribble alternative omits `-webkit-mask-image`, so it renders as a solid block in
  Safari. Only relevant if that option is revived.

## 2. The two triggers

Both drive the same `.u` element and the same six paths.

**Nav — hover.** Matches the pen. Today's nav underline is a 2px teal bar with
`transform:scaleX(0)→scaleX(1)` ([`brgw.css:68-70`](../../website/assets/brgw.css)), on
`a:hover` and `a.is-active`. The stroke replaces the bar; the trigger rule is unchanged.
**SPEC-003's finding still holds: this is `brgw.css` only** — the plugin emits bare `<a href>`
with no slug class, and `a[href="/team/"]::after` discriminates fine. No plugin change, so it
isn't behind the deploy gate.

**Everything else — scroll-in, after the split text.** And this needs **no new timing code**,
which is the useful half: `brgw.js:39-46` already walks each `.reveal` section's
`.ln-i, .anim-up, .anim-cta` in DOM order and assigns a cumulative `transitionDelay` — 85ms per
line, 115ms per other item. **An underline carrying `.anim-up` after the headline inherits the
correct delay automatically**, landing after the last line. That is what `.brgw-uline` does
today.

For a 2-line hero that's 170ms after the last line starts. [SPEC-004 §7](pen-stroke-underline.md)
measured **+280ms** as the point where the marker reads as landing rather than racing, so the
one tunable is whether the uline's step should be larger than the standard 115ms. **Recommend
`transitionDelay + 160ms` on the stroke specifically** — cheap, and it's one line.

## 3. The blocker nobody has hit yet: the split engine eats inner markup

`splitByWords` does this ([`brgw.js:24-25`](../../website/assets/brgw.js)):

```js
var words = el.textContent.replace(/\s+/g,' ').trim().split(' ');
el.innerHTML = words.map(w => '<span class="w" …>' + w + '</span>').join(' ');
```

`textContent`, then a full `innerHTML` rebuild. **Any element inside that headline is gone** —
a `<span class="u">`, a `<mark>`, a `.hl`. It cannot survive, and it fails silently: the words
render correctly and the decoration simply never existed.

`splitByBr` is different — it splits `innerHTML` on `<br>` and keeps each line's markup intact
([`:19-21`](../../website/assets/brgw.js)), so inner spans **do** survive.

Which headlines are on which:

| Split path | Sections | Inner markup |
|---|---|---|
| **`data-head="words"`** — destroys markup | `careers-hero`, `community-hero`, `our-restaurants-hero`, `careers-positions`, `team-apply` | none today |
| **`splitByBr`** — preserves markup | `home-community`, `home-different`, `careers-apply`, `home-hero`, `home-about`, `home-values`, `our-restaurants-brands`, `team-hero` | `<span class="mark">` on three |

Two things fall out.

**(a) No live bug — but by a hair.** Every existing `.mark` sits on a `splitByBr` headline. That
is correct, and nothing in the code enforces it. Put a `.mark` in a `data-head="words"` headline
and it vanishes with no error. Worth a comment in `brgw.js` next to `splitByWords`.

**(b) The four heroes are the wrong shape for a text-attached span.** They're all
`data-head="words"`, and they're all `{{heading}}` — ACF-editable, so an editor's markup would
be stripped too. Options:

1. **Switch those heroes to `splitByBr`.** Inner markup survives, but line breaks become
   author-fixed instead of measured. `splitByWords` groups lines by reading `offsetTop`, so it
   reflows with the viewport; a hard `<br>` doesn't, and gives bad breaks on a phone.
   **Rejected** — it trades a responsive behaviour for a decorative one.
2. **Teach `splitByWords` to carry a marker through the rebuild.** Real, and it's the general
   fix, but it's engine surgery on the most delicate function we have.
3. **Don't put the stroke inside the headline — size a sibling to the last line.**
   ✅ **Recommended.** Keep `.brgw-uline` as a sibling (where it already is, and where it already
   inherits the right delay), and set its width from the last `.ln`. That needs a measurement,
   and there's a natural home for it: `wrapLines` already runs right there, and `splitByWords`
   already measures `offsetTop`. Roughly three lines after the split — read
   `lastLn.getBoundingClientRect().width`, write it to a custom property, and let the uline
   consume it.

   This also dodges the clipping problem outright: **`.ln` is `overflow:hidden`** — it's the
   reveal mask — so a stroke drawn *inside* the headline gets its overshoot cut at the line box.
   A sibling sits outside the mask entirely. That's the same clipping fact behind the `.ln`
   padding fix Conti approved today, arriving from a second direction.

## 4. How no-wrap gets *enforced*, not requested

Sean reached the constraint from mobile; I reached it from `.ln`'s clip box. Two routes, one
conclusion — worth recording so nobody relaxes it later.

Under recommendation 3 the constraint **mostly enforces itself**, because the stroke binds to a
measured line box rather than a span that might wrap. What remains is that the *last line* can
be very short — "…to be." — leaving a stroke under two words.

- **`white-space:nowrap` is not the answer on an editable field.** It doesn't prevent bad copy,
  it prevents wrapping — so a long heading overflows its container instead.
- **Recommend a floor:** if the measured last line is under ~30% of the headline's width, fall
  back to the current fixed `min(340px,62%)` behaviour rather than drawing a stub. One
  comparison, and it degrades to today's look, which is already shipping.
- **And a length cap in the field `doc`**, since the headings are ACF: state the character count
  that keeps a hero on two lines. Advisory, but it's where an editor will actually read it.

## 5. Attribution

Both exports are MIT. Osmo's six paths are the part we're keeping, so the attribution rides along
either way — a comment naming `osmo.supply` and the pen URL at the top of whichever file holds
the path data. Third-party code entering the repo is Conti's call to make deliberately; flagging
it rather than assuming.

## 6. Order

1. Conti rules on §1 (dashoffset vs DrawSVG) and §5 (attribution).
2. Finn vendors the six paths + the CSS, and prototypes **one** hero — `community-hero` is the
   cleanest, it has no `.mark` and a two-line heading.
3. Sean sees that one before it touches five.
4. Nav swap after, since it's `brgw.css`-only and independent.

~~**Open for Sean, one question:** random per load, or fixed per page?~~ **Answered 2026-08-17:
fixed, and using his own Figma exports rather than Osmo's variants** — see the ruling at the top.
Each page keeps its own mark. The remaining ask is the re-export (§1): five stroke-based SVGs, or
we derive the centerlines from the filled outlines as SPEC-004 already worked out.
