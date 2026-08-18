# SPEC-009 — The text-attached underline

**Status:** proposed · Explorer · 2026-08-13 · commissioned by Sean via Conti ·
source: [Osmo, `codepen.io/osmosupply/pen/qEEKRrx`](https://codepen.io/osmosupply/pen/qEEKRrx) (MIT) ·
demo: **[Three Underlines](https://claude.ai/code/artifact/b339f004-60aa-4ead-b2ec-0493141ef97c)**
**Verified against:** `d68f202` — claims about the codebase were checked at this tree; re-check before acting on a `file:line` or a state claim.

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

## 0. The reference implementation — measured from a live site we built

**Sean, 2026-08-17:** *"somewhere the underline was used before and is exactly what we are trying
to do… especially the ones like on the ice cream section."* — [thebakedbear.com](https://www.thebakedbear.com/),
built on **Salient** (ThemeNectar). Read from the served source, not described.

The "Ice Cream" heading he singled out:

```html
<div class="nectar-highlighted-text" data-style="scribble" style="color:#0f74b8">
 <h2><em>Ice Cream<svg class="nectar-scribble basic-underline"
      viewBox="-400 -55 730 60" preserveAspectRatio="none">
   <path style="animation-duration:1.8s"
         d="m -383.25 -6 c 55.25 -22 130.75 -33.5 293.25 -38 c 54.5 -0.5 195 -2.5 401 15"
         stroke="#7fcaee" pathLength="1" stroke-width="20" fill="none"/>
 </svg></em></h2>
</div>
```

```css
@keyframes nectarStrokeAnimation{
  0%  {stroke-dashoffset:1; opacity:0}
  1%  {opacity:1}                       /* no dot at the start */
  100%{stroke-dashoffset:0}
}
.nectar-highlighted-text .nectar-scribble      {position:absolute;left:0;top:0;z-index:-1}
.nectar-highlighted-text .nectar-scribble path {stroke-dasharray:1;stroke-dashoffset:1;opacity:0}
.nectar-highlighted-text em.animated .nectar-scribble path{
  stroke-linecap:round; opacity:1;
  animation:nectarStrokeAnimation 1.3s cubic-bezier(.65,0,.35,1) forwards}
body .nectar-scribble.basic-underline     {width:100%;height:30%;top:auto;bottom:-20%}
body .nectar-scribble.squiggle-underline-2{width:100%;height:50%;top:auto;bottom:-45%}
```

**What this settles, and what it corrects in this spec.**

| Question | The reference |
|---|---|
| Draw or wipe? | **Draw.** `fill="none"`, `stroke`, `stroke-width`, `stroke-linecap:round` — a **centreline**, never a filled outline |
| `pathLength` | **an attribute**, `pathLength="1"` — exactly the bug that left our A2/A4 dead |
| Engine | **CSS keyframe on `stroke-dashoffset`. No GSAP, no DrawSVG.** JS only adds a class |
| Trigger | `.animated` on the `<em>`, added on scroll-in — §2's model, confirmed |
| Duration | **1.8s** (inline, overriding the 1.3s default). Ours was 0.72s — hence *"slow it down a little bit more"* |
| Easing | `cubic-bezier(.65,0,.35,1)` — **ease-in-out**, not the ease-out we defaulted to |
| Sizing | SVG lives **inside the `<em>`** at `width:100%`, so it binds to the words, not the section |
| Placement | `height:30%; bottom:-20%` of the `<em>` — B1's "placement is wrong" has a number now |
| Stroke weight | per-instance (`20` here, `7.8`/`11.1` on the squiggles) — authored, not derived |

**Three things worth taking beyond the numbers:**

1. **The `1%{opacity:1}` step.** At `stroke-dashoffset:1` a round cap still paints a dot; holding
   opacity at 0 for the first 1% hides it. A detail we would have shipped wrong and never traced.
2. **Two variants are in use on one page** — `basic-underline` under *Ice Cream*, `squiggle-underline-2`
   under *Fresh Baked* and *one*. That is Sean's *"multiple different slight variations of this
   one"*, already demonstrated: same mechanism, different path, different `stroke-width` and box.
3. **One genuine divergence, and it is Sean's improvement, not a mistake to copy.** The SVG is
   absolutely positioned to the whole `<em>` box, so on a **wrapped** `<em>` it would stretch
   across both lines. Sean's rule — *"if it splits to two lines, it should only fill the width of
   the bottom one"* — is stricter than the reference. Ours should keep the stricter behaviour.

### 0.1 The trigger — read from the theme source, and it is the thing we had most wrong

Sean supplied the Salient theme (`~/_claude-local/salient/`, local only — it is a paid licensed
theme and must never enter `website/`). `js/src/init.js`, `highlightedText()`:

```js
var $offset = ($fullscreenMarkupBool) ? '500%' : 'bottom-in-view';
if (nectarDOMInfo.usingMobileBrowser && $offset == 'bottom-in-view') $offset = '85%';
new Waypoint({ element: $that[0], offset: $offset, handler: function () {
    $that.find('em').each(function (i) {
      var $em = $(this);
      setTimeout(function () { $em.addClass('animated'); }, i * 300);   // stagger
    });
    waypoint.destroy();                                                 // fires ONCE
}});
```

| | Salient | **`brgw.js` today** |
|---|---|---|
| Desktop trigger | **`bottom-in-view`** — the element's *bottom* reaches the viewport, i.e. it is **fully on screen** | `threshold:0.16, rootMargin:'0px 0px -8% 0px'` — fires at **16% visible** |
| Mobile browsers | `85%` — top reaches 85% down the viewport | same as desktop |
| Repeat | `waypoint.destroy()` — **once, never again** | `io.unobserve()` — also once ✓ |
| Multiple spans | staggered **300ms** apart | n/a |

**That first row is the answer to *"it triggers correctly when it's pulled onto the screen and not
anytime before."*** Ours starts when a sixth of the section has appeared; the reference waits until
the whole element is in view. Nothing about the stroke was wrong — **we were starting it too early**,
which is why it never read as "pulled onto the screen".

IntersectionObserver equivalents, since we are not adding Waypoints:
- desktop `bottom-in-view` → **`threshold: 1.0`** (whole element visible)
- mobile `85%` → `threshold: 0, rootMargin: '0px 0px -15% 0px'`
- tall-element guard: an element taller than the viewport can never reach `threshold:1`, so pair it
  with `rootMargin:'0px 0px -15% 0px'` at `threshold:0` and take whichever fires first.

### 0.2 The five scribble variants — Sean's "slight variations", already drawn

`includes/class-nectar-element-styles.php`. Same mechanism, different path and box:

| Variant | Box on the `<em>` |
|---|---|
| **`basic-underline`** — *the one he picked* | `width:100%; height:30%; top:auto; bottom:-20%` |
| `sketch-underline` | `height:60%; bottom:-15%` |
| `squiggle-underline` | `height:50%; bottom:-30%` |
| `squiggle-underline-2` — the two-pass one on *Fresh Baked* | `height:50%; bottom:-45%` |
| `circle` | `width:130%; height:140%; top:-20%; left:-15%` |

The path data is **per instance**, authored in the builder — not canned in the theme. So
"variations" means our own strokes in these boxes, which is what Sean's five `line-*-lg.svg` are.

### 0.3 The highlight — full numbers, previously flagged unconfirmed

`css/build/elements/element-highlighted-text.css`:

```css
.nectar-highlighted-text:not([data-style=text_outline]) em{
  background-repeat:no-repeat;
  background-size:0 80%;                       /* → 100% 80% on .animated */
  background-image:linear-gradient(to right,COLOR 0,COLOR 100%);
  background-position:left 90%;
  transition:background-size .9s cubic-bezier(.15,.75,.4,1), opacity .25s ease;
}
```

Three tightnesses via `data-exp`: default `80%` @ `left 90%`, `closer` `70%` @ `left 65%`,
`closest` `60%` @ `left 65%`.

**It is a `background-size` wipe on a gradient, not a scaled pseudo-element** — and that is
better than my `.mk::before{transform:scaleX()}`, because a background survives
`box-decoration-break:clone` across a wrapped line where a single stretched box does not. Worth
adopting on that ground alone.

**Timing: 0.9s `cubic-bezier(.15,.75,.4,1)`** — a strong ease-out, and notably *faster* than the
1.8s stroke. The two are not meant to match.

## 0.4 Ours or Salient's? — the recommendation, and it is neither wholesale

Sean, 2026-08-17: *"any suggestions of why one type might work better universally than another."*

**Recommendation: Salient's *mechanism*, our *geometry*.** They are not competing implementations
— they differ on exactly two axes, and the better answer on each comes from a different side.

| | Salient | Ours | Take |
|---|---|---|---|
| Draw | CSS keyframe on `stroke-dashoffset` | same | **either** — identical output |
| Attachment | SVG inside the `<em>`, `width:100%` | same | **either** |
| Wrapped line | stroke spans **both** lines | **bottom line only** | **ours** — Sean's rule, and it is the correct one |
| Slant on the highlight | none | `rotate(-1.8deg)` | **ours** — it is the BRG mark, and its absence is what he flagged on S-C1/S-C2 |
| Highlight reveal | `background-size` on a gradient | scaled pseudo-element | **Salient's** — a background survives `box-decoration-break` across a wrapped line; a stretched box does not |
| Trigger | fully on screen | 16% visible | **Salient's** — this is the whole *"not anytime before"* |
| Easing | ease-in-out | — | **ease-out**, per Sean; neither default |

**Why "better coded" is the wrong frame, and what the real difference is.** Salient's code is not
cleaner in any way that survives being lifted out of Salient — most of its length is WPBakery
plumbing, `data-exp` presets and per-instance style generation we have no use for. **What is
genuinely better is that its behaviour is parameterised**: variant, colour, tightness and delay
are all attributes on the element, and nothing about the effect is hard-coded per instance.

**That is the thing to copy — and it is the same thing §0.5 is about.** So the honest answer to
*"is theirs better?"* is: **their separation of effect from configuration is better; their
geometry is not.** Take the first, keep ours for the second.

## 0.5 The variable contract — what becomes a shortcode attribute

Sean's overall note is a list of things he needs control of. Grouped into what a section author
sets, because **this is the deliverable that turns a demo into a component.**

| Attribute | Values | Default | Answers |
|---|---|---|---|
| `mark` | `none` · `underline` · `highlight` | `none` | which effect |
| `mark_words` | **see §0.6 — the unsolved one** | last line | *"what words get underlined"* |
| `mark_shape` | `careers` · `home` · `team` · `community` · `restaurants` | per page | which stroke |
| `mark_color` | token name or hex | page accent | *"what colours they are"* |
| `text_color` | `dark` · `light` · `#hex` | `dark` | *"change the colour of the text inside the highlight"* — his words |
| `mark_speed` | ms | `1800` underline · `900` highlight | *"the speed"* / *"animation speed"* |
| `mark_ease` | `out` · `in-out` · `linear` | `out` | his ruling on S-A1 |
| `mark_delay` | ms, ± against the headline landing | `0` | *"the location"* in time |
| `mark_trigger` | `full` · `partial` · `hover` | `full` (nav: `hover`) | *"entrance"* |
| `mark_wrap` | `last-line` · `all-lines` | `last-line` | *"what happens if the line breaks"* |
| `mark_replay` | `once` · `every` | `once` | *"exit"* — see below |

**Three of his list deliberately do not become attributes, and it is worth saying why:**

- **"Entrance and exit"** — there is **no exit** on a scroll-in mark, and there should not be.
  Salient destroys the waypoint after firing; ours unobserves. An underline that un-draws when
  you scroll away draws attention to itself twice for one piece of content. Exit exists only on
  **nav hover**, where it is a state, not an entrance. `mark_replay` covers the real question.
- **"Animations if there are any"** — the doodles and plates are already per-section art
  direction, not a mark property. Folding them in would make this attribute set the whole
  section's animation config.
- **"The location"** spatially — `height`/`bottom` are per-shape geometry (Salient ships five
  presets for exactly this reason). Exposing them as attributes invites a section author to
  nudge a stroke off its baseline. **Ship the five shapes with fixed boxes; expose only the
  shape choice.**

## 0.6 Which words get the mark — SETTLED

**Sean ruled 2026-08-18: asterisks.** Chosen over a second field, a rich-text field, and
last-line-only. Conti ruled the architecture the same day. This section was the open question in
the spec; it is now the contract.

### The principle: measure, don't inject

> **The delimiter names which words to MEASURE. It never injects markup into the headline.**

The stroke stays a sibling and sizes itself to the union of the marked words' rects. The headline
DOM is untouched and the split engine never sees markup. That is what keeps the **ACF question**
and the **animation question** independent — every alternative couples them, which is why every
alternative gets harder as either side changes.

### The contract

| | |
|---|---|
| **Syntax** | `Come work somewhere *you actually want to be*` |
| **Default** | **No delimiter → mark the last line.** Today's behaviour, unchanged |
| **Where** | **Client-side, in `brgw.js`.** The plugin must not know what an asterisk means |
| **Slot type** | Heading slots stay **`type: "text"`**. Not `html` |
| **Literal asterisk** | `\*` |
| **Unbalanced** | A lone `*` renders **literally** and marks nothing. It must never swallow the rest of the headline |

**Why client-side, and it is the strongest of the three rulings.** Server-side, the conversion
would have to run *after* `esc_html` or the span gets escaped with everything else — so
`vcc_fill_slots` would carry **an exception to its own escaping rule**. That rule is one line and
completely legible today (`:213-214`); an exception in it is how the next person introduces an
XSS. A presentation convention belongs where presentation lives.

**Why `text` and not `html`.** `wp_kses_post` permits iframes, styles, tables and
scripts-by-attribute — an enormous surface for a field whose legitimate content is *a sentence*.
The delimiter means an editor never needs markup, so granting it would be paying the blast radius
for a capability the design removes.

**Why not a second field.** Two fields holding one sentence is the drift shape SPEC-008 exists to
delete — and it fails *silently* when the marked words appear twice in the heading.

### What the engine needs — narrower than first stated

`splitByWords` flattens in **two** places, not one (Conti caught this; I had said one):

```js
brgw.js:24   var words = el.textContent…            // entry flatten
brgw.js:31   cur.push(s.textContent);               // line-join flatten
```

**`:24` is not a problem — asterisks are text and survive it intact.** That is the point of a
delimiter over markup. The parse happens here: strip the delimiters, record which word indices
were inside them, tag those `.w` spans.

**Only `:31` needs to change, and only for marked words:**

```js
cur.push(s.classList.contains('mkw') ? s.outerHTML : s.textContent);
```

So **unmarked words stay plain text** and their spacing, kerning and wrapping are untouched. This
matters: my first version of this ask proposed preserving *every* word as an element, which would
have traded typography site-wide for a decoration. **The narrower change carries almost none of
that risk**, and it only exists at all on headings that actually use the delimiter.

Finn owns `brgw.js` and has the final call on whether even that is worth it. **"Not worth the
risk" remains a real answer** — the fallback is last-line-only, which is today's behaviour, and
the only thing lost is expressing *"Built **for community**"* with the mark mid-line. That would
be a deliberate limit, and should be recorded as one rather than left looking like an oversight.

### Why Sean wanted it

*"What happens if only half of the text on that line gets the underline or highlight."* With
last-line-only that is inexpressible. That is the whole case, and it is a good one.

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
