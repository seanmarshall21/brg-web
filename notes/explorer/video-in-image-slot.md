# SPEC-013 — Video in an image slot

**Status:** proposed · BRG Specs · 2026-08-20 · board `c0f9189dc1`
**Verified against:** working tree at `3e12748`.

Sean: a toggle on the image slots for *"this is a video"* — paste a Vimeo or YouTube link,
ideally just the ID, and it plays a looping muted video in that place, sized so `min-height`
and `min-width` are both 100%, probably 110%, so it covers.

**Ruled by Sean 2026-08-20: render BOTH, video on top.** The image stays as a poster frame
behind the video. Chosen over a toggle and over "non-empty field wins".

---

## 1. Why "both" is the right answer, not just his preference

Our template grammar has **no conditionals** — Finn established this when wiring the team
repeater. A slot cannot branch between "render an image" and "render a video".

The toggle option is worse than it looks: a `true_false` field can **disagree with itself**
(toggle on, ID blank → a blank box where a photo used to be), and it needs a second field type
from the generator on top of `select`.

Rendering both dodges all of it, and the poster earns its place three separate times:
it shows **while the embed loads**, it survives **the embed failing** (blocked third-party
frames are common on corporate networks), and it is what a **reduced-motion** visitor sees.
A video-only slot has no answer to any of those.

## 2. The one thing "both" still has to solve

An empty video field must not paint an empty frame over the photo. With no conditionals, the
answer is a CSS attribute selector — **`[data-vid=""]` matches an empty attribute**:

```css
.brgw .vid{position:absolute;inset:0;overflow:hidden;}
.brgw .vid[data-vid=""]{display:none;}          /* no ID → the poster is the whole story */
@media (prefers-reduced-motion:reduce){ .brgw .vid{display:none!important;} }
```

That is a real conditional expressed in CSS rather than in the template, so it costs the
grammar nothing. **Nothing like it is used in `brgw.css` today** (checked: zero occurrences),
so it is a new idiom — worth stating plainly rather than letting it appear as if it were
already a pattern here.

## 3. Markup

```html
<div class="media">
  <img class="poster" src="{{bg_image}}" alt="" loading="lazy" decoding="async">
  <div class="vid" data-vid="{{video_id}}" data-src="{{video_source}}" aria-hidden="true"></div>
</div>
```

**The iframe is NOT in the markup.** `brgw.js` reads `data-vid` and injects it only when
non-empty. Three reasons, and the first is the one that matters:

1. **An `<iframe>` in the fragment loads on every page view even when hidden** — `display:none`
   does not prevent the request. Six sections with background video would pull six third-party
   frames on a page that shows none of them.
2. It keeps the provider URL-building in one place instead of duplicated per section.
3. It lets the reduced-motion check run before anything is requested.

## 4. Provider, and why it is a select rather than detection

`video_source` is a `select` — `youtube` | `vimeo`. **Do not sniff the ID.** YouTube IDs are 11
characters of `[A-Za-z0-9_-]` and Vimeo IDs are numeric, so sniffing works until someone pastes
a full URL or a Vimeo ID that happens to be 11 digits, and then it fails as a blank box with no
error. A two-option dropdown costs one field and cannot be wrong.

Accept **either an ID or a full URL** in `video_id` and parse in JS — asking a client to extract
an ID from a share link is exactly the "built for us, not for whoever inherits it" complaint
this whole parent item exists to fix.

## 5. Embed URLs — the parameters that are not optional

| | URL | Notes |
|---|---|---|
| YouTube | `https://www.youtube-nocookie.com/embed/<ID>?autoplay=1&mute=1&loop=1&playlist=<ID>&controls=0&playsinline=1&modestbranding=1&rel=0` | **`playlist=<ID>` is required for `loop=1` to work** — YouTube loops a *playlist*, and a single video without it plays once and stops. `-nocookie` is the privacy-preserving host. |
| Vimeo | `https://player.vimeo.com/video/<ID>?background=1&autoplay=1&loop=1&muted=1` | `background=1` is purpose-built: muted, looping, no controls, no UI. Prefer it over setting the flags individually. |

**`mute=1` / `muted=1` are load-bearing, not stylistic** — every current browser blocks
autoplay with sound. Without them the video does not play at all.

## 6. Sizing — his "probably 110%" is right, and here is why

A 16:9 iframe cannot `object-fit`. Covering an arbitrary box needs the transform trick:

```css
.brgw .vid iframe{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:100vw;height:56.25vw;min-width:110%;min-height:110%;border:0;pointer-events:none;}
```

`56.25vw` is 16:9. The `110%` overshoot is deliberate: at exactly 100% a sub-pixel rounding gap
can show a 1px hairline of the poster along one edge, which reads as a rendering fault.
`pointer-events:none` keeps the video from swallowing clicks meant for a CTA over it.

## 7. Slots

```json
"video_id":     { "type":"text", "label":"Background video (optional)",
  "doc":"Paste a YouTube or Vimeo link, or just the ID. Leave blank to use the image.",
  "default":"" },
"video_source": { "type":"select", "label":"Video from", "default":"youtube",
  "choices": { "youtube":"YouTube", "vimeo":"Vimeo" } }
```

## 8. Dependencies and order

1. **Image slots must exist first.** There are **46 `<img>` tags across the fragments and one
   image slot declared** — board `e11b7aabca` is declaring them. A video slot with no poster
   slot has nothing to sit behind it.
2. **`select` in the generator** — `2dace015d8` (Conti), for `video_source`.
3. `brgw.js` injector + `brgw.css` rules — Finn.

## 9. Not specced, deliberately

**Self-hosted video.** Sean mentioned it and said he prefers the two hosted services. A local
`<video>` needs no iframe, no provider and no parameters — it is genuinely simpler — but it puts
multi-MB files in the WP media library and serves them from the origin rather than a CDN. If he
wants it later it is a small addition, not a redesign. Flagged so nobody reads its absence as an
oversight.
