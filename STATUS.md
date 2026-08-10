# BRG-WEB — Project Status

_Living snapshot so any chat/machine can pick up where we are. The **Manager** maintains
this; other chats request edits via their `notes/*.md`. Update whenever state changes._

**Last updated:** 2026-08-09 (Manager)

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
4. **"Stacking sections" architecture** (Explorer + Manager) — section-level fragments so a WP
   page can compose several `[brg_section_*]` shortcodes. Infra already dedupes shared assets;
   remaining work is a section manifest + shortcode form.

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
