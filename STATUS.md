# BRG-WEB — Project Status

_Living snapshot so any chat/machine can pick up where we are. The **Controller** maintains
this; other chats request edits via their `notes/*.md`. Update whenever state changes._

**Last updated:** 2026-08-10 (Controller) — v2.0.0 verified live; v2.1.0 written

## What this project is
The Blacktop Restaurant Group (BRG) marketing site for Vivo Creative. Pages are built as
**code fragments** in this repo, served from Netlify, and pulled **natively** (no iframe)
into the existing WordPress/Oxygen site at `blacktoprestaurantgroup.com` via a single
per-page shortcode. Dictate a change → a chat edits a file → push → live in ~30–60s. The
Oxygen "Coming Soon" splash is a separate build and intentionally has no BRG chrome.

## The pipeline
```
you dictate → Claude edits repo under website/ → push → Netlify auto-deploys
            → WordPress page's [brg_<slug>] shortcode re-fetches the file → live
```
- **Repo:** `seanmarshall21/brg-web` (private; `gh` authed so chats can push). Publish dir `website/`.
- **Netlify:** `blacktoprg.netlify.app` (auto-deploys on push to `main`).
- **WP plugin:** `website/wp-mu-plugin/vc-clients-embed.php` (v2.0.0, must-use). Manifest-driven:
  registers `[brg_<slug>]` for every slug in `website/pages.json`, fetches
  `blacktoprg.netlify.app/<slug>/embed.html`, and inlines the shared assets **once per page**
  (so multiple BRG shortcodes can stack on one WP page without double-loading CSS/JS).
- **Shared assets (inlined by the plugin):** `website/assets/brgw.css` + `website/assets/brgw.js`
  — brand tokens, buttons, header/nav, footer, reveal engine, reusable slider, doodle loops.

## Pages (built in repo)
| Slug | Title | Repo fragment | Live WP page |
|---|---|---|---|
| home | Home | ✅ `website/home/embed.html` | ❌ not created yet (404) |
| our-restaurants | Our Restaurants | ✅ built | ❌ not created |
| team | Team | ✅ built (9-card crew grid) | ❌ not created |
| community | Community | ✅ built (give-back **slider**, stats, CTA) | ❌ not created |
| careers | Careers | ✅ built | ❌ not created |

All five fragments render correctly in compose-tests (shared CSS + header + fragment +
footer + shared JS), desktop and mobile.

## Current state
- **Plugin:** user reports the v2.0.0 file was just "dropped in" to `/wp-content/mu-plugins/`.
  **Unverified live** — can't confirm until a WP page with a shortcode exists.
- **Header/footer:** auto-injected on every shortcode-rendered page (nav built from
  `pages.json`, active link teal). `chrome="0"` opts a page out. Splash excluded by design.
- **Animations:** shared reveal engine (font-gated split-line reveals, fade-ups, clip-path
  button reveal), looping micro-animations (badge/doodle jitter, stat pulses, hero drift),
  auto-advancing community slider. All reduced-motion-safe; doodles hidden < 560px.

## Open items / not done yet
1. **Create the WP pages.** Every `/<slug>/` URL is 404 — WordPress has no pages yet. Blocking
   go-live and blocking live verification of the plugin. (Human step: add page + drop `[brg_<slug>]`.)
2. **Verify plugin live** once one page exists — expect `<!-- vc_embed brg/<slug> v2.0.0 -->` + nav.
3. **Real assets** — team headshots, Board & Brew / Odie's logos, give-back photos. Fragments
   use colored-card / gradient placeholders wired to swap in cleanly.
4. **SPEC-001 "stacking sections" — plugin v2.1.0 WRITTEN, awaiting upload + section harvest.**
   The 4 section-pages (brg-home/team/community/careers) are already composed in Oxygen from
   `[brg_nav]` + `[brg_<page>-<section>]` × N + `[brg_footer]` (~16 section ids total). They render
   literal today because v2.0.0 has no section shortcodes. **our-restaurants** uses the v2.0 monolith
   `[brg_our-restaurants]` and works.
   - **A. ✅ done** — WP pages exist (password-gated, pw shared); **v2.0.0 verified live** on our-restaurants
     (`<!-- vc_embed brg/our-restaurants v2.0.0 -->` + nav + hero).
   - **B. ✅ done (Conti)** — plugin **v2.1.0** written: `[brg_nav]`/`[brg_footer]` chrome, `[brg_<id>]`
     + `[brg_section id=…]` section renderer, `vcc_shared_assets()` dedupe, `{{slot}}` fill, nav
     `Home→/brg-home/` fix. `website/sections.json` created (17 ids: 5 live heroes + 12 stubs).
   - **C. HUMAN, next** — **upload `website/wp-mu-plugin/vc-clients-embed.php` to `/wp-content/mu-plugins/`**
     (replaces v2.0.0). Push already deploys the manifests to Netlify first. Then all 4 pages light up
     (heroes render; stub sections show invisible until harvested).
   - **D. Finn, next** — harvest the **12 stub sections** (home-about/values/…, team-members/apply,
     community-stats/give/partner, careers-positions/posts/apply) into `website/sections/<id>/embed.html`
     from the existing monolith fragments, per the §4 contract.

   **Live URLs (all password-gated):** /brg-home/ · /our-restaurants/ · /team/ · /community/ · /careers/

## Deploying (the loop)
```
git pull → edit under website/ → git add website/ && git commit && git push → verify with curl of the live URL
```
New page = add its slug to `website/pages.json` + push → its `[brg_<slug>]` shortcode works automatically.

## Gotchas (learned)
- **`git add -A` from `website/` stages root junk** (.DS_Store, assets/) — stage `website/` (or the repo root deliberately).
- **Netlify deploy ≠ WP plugin update.** Pushing the repo does NOT update the PHP plugin on WordPress; the plugin is a one-time manual upload to `/wp-content/mu-plugins/`.
- **Oxygen shortcodes must be signed** after a host/domain move, or the builder goes blank (also needs PHP 8.2 + 512M memory). See memory `oxygen-site-migration-checklist`.
- **Put `[brg_*]` in an Oxygen _Shortcode_ element / WP Shortcode block — not an Oxygen Text element.**
- **One reveal engine only.** `brgw.js` self-inits every `.brgw` root; never add a second init script or a parallel slider.

## Coordination
See `MANIFESTO.md` for roles/ownership/protocol; each chat logs to its own `notes/*.md`.

## Key links
- Repo: github.com/seanmarshall21/brg-web · Live: blacktoprestaurantgroup.com · CDN: blacktoprg.netlify.app
