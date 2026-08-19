# Site speed audit — 2026-08-19, BRG Verify

Measured, not estimated. Every number below came from a command; where I could not measure
something I say so rather than filling the gap.

## What is already good (do not "fix" these)

- Brotli is on for CSS/JS/SVG. `brgw.css` 17.3KB -> 8KB wire, `brgw.js` 10.9KB -> 3KB.
- Media cached one year (`max-age=31536000`) via netlify.toml.
- Reveals use `IntersectionObserver`, not scroll handlers.
- Nav scroll is `{passive:true}` + `requestAnimationFrame`.
- Only `transform` and `opacity` are transitioned — compositor-friendly, no layout thrash.
- `prefers-reduced-motion` honoured in both stylesheets.
- All 42 `<img>` carry width+height (no layout shift) and alt text.

## Measured

Live TTFB, blacktoprestaurantgroup.com, 12 samples: **1.19s – 3.69s, median ~1.32s.**
One 2.06s spike in a 9-sample run at 25s spacing. CDN round trip is ~250–300ms.

## The findings, worst first

**1. Two remote fetches on EVERY WordPress request.** `vc-clients-embed.php:468` is
`add_action('init', ...)` with no `is_admin()`, no `has_shortcode()`, no REST/AJAX guard. Inside
it, `vcc_fetch(pages.json)` and `vcc_fetch(sections.json)` — 8s timeout each. This runs on
wp-admin, on AJAX, on REST, on cron, and on pages with no BRG content at all. The public splash
page has no BRG shortcodes and still pays it.

**2. `pages.json` is an empty array `[]`.** One of those two per-request fetches returns nothing
usable — the page-alias loop iterates zero times. Pure cost, every request.

**3. `VCC_TTL = 120`.** The transient cache expires every two minutes, so 1 and 4 recur all day.

**4. Zero parallelism.** Every fetch is a sequential `wp_remote_get`; `curl_multi` appears nowhere.
Home is 5 sections, each costing embed.html + slots.json, plus manifests: **~11-13 sequential
round trips** on a cold cache, at ~250-300ms each.

**5. 31 of 42 images load eagerly.** Only 11 carry `loading="lazy"`. Home fires 10 eager.

**6. 1 of 42 images has `srcset`** — home-hero's base image, and it is done correctly
(390w->1920w). Every other image ships one fixed size to every device. our-restaurants sends
**526KB identically to a phone and a desktop**.

**7. Two label SVGs dominate our-restaurants:** `odies-img-label.svg` 269KB (104KB brotli'd) and
`bnb-img-label.svg` 247KB (101KB). Genuine vector, no embedded raster — just very dense paths.

**8. CSS/JS are inlined into the HTML** (`:103-104`, `<style id="vcc-…-css">`). ~57KB uncompressed
re-sent on every page view and never browser-cached across navigations.

## Per-page image weight (browser picks ONE srcset candidate)

| page | imgs | phone | desktop | eager/lazy |
|---|---|---|---|---|
| home | 16 | 757KB | 1479KB | 10/6 |
| our-restaurants | 5 | 526KB | 526KB | 3/2 |
| careers | 4 | 153KB | 153KB | 4/0 |
| community | 6 | 88KB | 88KB | 3/3 |
| team | 9 | 68KB | 68KB | 9/0 |
| contact | 2 | 24KB | 24KB | 2/0 |

## What I could NOT establish

**Why TTFB is 1.3s.** I can prove the unguarded init fetches exist and that they run on every
request. I have NOT proved they are the dominant cause of the baseline — that needs server-side
timing (Query Monitor) or the gate password. One 2s spike in nine samples is not a 120s period,
and I am not going to call it one. Treat finding 1 as a real cost of known size, not as the
diagnosis.
