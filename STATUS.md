# BRG-WEB — Project Status

_Living snapshot so any chat/machine can pick up where we are. The **Controller** maintains
this; other chats request edits via their `notes/*.md`. Update whenever state changes._

**Last updated:** 2026-08-12 (Conti) — 18/18 sections built and **verified rendering live** ·
plugin **v2.4.0 live, v2.5.0 in repo** · nav assigned and live · chats restructured to
clone-per-chat + territory hook

## What this project is
The Blacktop Restaurant Group (BRG) marketing site for Vivo Creative. Pages are built as
**code fragments** in this repo, served from Netlify, and pulled **natively** (no iframe)
into the existing WordPress/Oxygen site at `blacktoprestaurantgroup.com` via shortcodes.
Dictate a change → a chat edits a file → push → live in ~30–60s. The Oxygen "Coming Soon"
splash is a separate build and intentionally has no BRG chrome.

## The pipeline
```
you dictate → Claude edits repo under website/ → push → Netlify auto-deploys
            → the WP page's [brg_*] shortcode re-fetches the file → live
```
- **Repo:** `seanmarshall21/brg-web` (private; `gh` authed). Publish dir `website/`.
- **Netlify:** `blacktoprg.netlify.app` (auto-deploys on push to `main`).
- **WP plugin:** `website/wp-mu-plugin/vc-clients-embed.php` (**v2.5.0** in repo, must-use).
- **ACF loader:** `website/wp-mu-plugin/brg-acf.php` (install once; fetches field groups from Netlify).
- **Password gate:** `website/wp-snippets/brg-password-gate.php`. All 5 pages are locked today.
- **Shared assets (inlined once per page):** `assets/brgw.css` + `brgw.js` (tokens, reveal engine,
  slider, doodles, lazy GSAP scroll layer) and `assets/brgw-nav.css` + `brgw-nav.js` (the nav component).

## Shortcodes (generated docs — see `kit/`)
`[brg_<slug>]` page · `[brg_<id>]` / `[brg_section id=]` section · `[brg_nav]` · `[brg_footer]` · `[vc_embed]`.
**`kit/registry.json` is the source of truth**; `python3 kit/build.py` regenerates `SHORTCODES.md`
+ `docs/shortcode-index.html` with per-component `version` + `contract` hash. Run it in the same
commit as any shortcode change (`--check` in CI-spirit, `--restamp` to bump). Don't hand-edit those two docs.

## Pages
| Slug | WP URL | Composition | State |
|---|---|---|---|
| home | `/brg-home/` | stacked sections | live, gated |
| our-restaurants | `/our-restaurants/` | stacked sections | live, gated |
| team | `/team/` | stacked sections | live, gated |
| community | `/community/` | stacked sections | live, gated |
| careers | `/careers/` | stacked sections | live, gated |

**Verified behind the gate 2026-08-12:** all five render every one of their sections, **zero
literal `[brg_` tokens**, nav present with 5 items and the active state resolving. Every
shortcode reports **`v2.4.0`** — so the live plugin is v2.4.0 while the repo holds v2.5.0, and
the **ACF-aware slot fill is written but not running on the site.** Legacy monolith fragments
(`website/<slug>/embed.html`) still exist and still work, but the stacked form is the current shape.

## Sections — 18/18 built
`website/sections.json` (Controller-owned) lists all 18, every one `status: live` and every
fragment present at `website/sections/<id>/embed.html` (reconciled to disk 2026-08-12).
Contract = SPEC-001 §4: CSS scoped under `.brgw-sec--<id>`, root carries `reveal`, no `.brgw` wrapper.
**Cross-section bleed rule** (+ the shared-chrome exception) is in `notes/controller.md`.

## Nav
`[brg_nav]` is **WordPress-menu-driven** (`wp_nav_menu`, location **"BRG — Primary"**). Fixed
(not sticky — each shortcode has its own short wrapper), pen-stroke teal marker underline,
morphing hamburger + staggered drawer. Attributes: `layout` (left/split/center/compact),
`left`/`right` (+ More overflow drawer), `sticky` (pin/hide), `bg` (solid/none/frost), `bgcolor`, `opacity`.

## ACF-editable sections
Sections declare `slots` in `sections.json` → `kit/build-acf.py` generates per-section
`website/acf/brg-<id>.acf.json` + the combined `website/acf/all.acf.json` → `brg-acf.php`
registers the "Section Content" options page and fetches those groups from Netlify. So a field
change is: edit `sections.json` → run the generator → push. **No import step, ever.**
Fill precedence: shortcode attr > ACF option > default. Field name = `brg_<id_with_underscores>_<slot>`.
`community-partner` is the only section with slots declared today (the worked example).

## Open items
1. **Human, one-time — the two things that unblock automation:**
   (a) install `website/wp-mu-plugin/brg-acf.php` (needs ACF Pro);
   (b) add 4 repo secrets — `WP_SSH_HOST`, `WP_SSH_USER`, `WP_SSH_KEY`, `WP_MU_PLUGINS_PATH` —
   so `.github/workflows/deploy-mu-plugins.yml` SCPs the mu-plugin files on push.
   Until (b), plugin **v2.5.0 still needs a manual drop** into `/wp-content/mu-plugins/`.
2. ~~Verify the live plugin version.~~ **Done 2026-08-12 — live is v2.4.0.** Re-verify after
   the v2.5.0 drop; bust cache with `?brg_refresh=1`.
3. ~~Menu assignment.~~ **Done** — "BRG — Primary" is assigned and serving Home / Our Restaurants
   / Team / Community / Careers, with `current-menu-item` resolving.
4. **Real content still outstanding:** team headshots + quotes, three of four community stats
   (still `XX`), real photography for `home-community` (2 plates) and `home-different` (3 plates),
   real LinkedIn job URLs for `careers-posts` (its follower counts / age stamps are hand-maintained
   and will silently go stale).
5. **Nav gaps vs the Temper upstream:** `register` attr (auto-invert — mechanism exists, no attr)
   and WP submenu/dropdown support. Deferred, see `notes/upstream-fc-brands.md`.
6. **New pages not built:** Press & Gallery, Contact.
7. **Launch:** point the site root at `/brg-home/`, unlock the gate, retire the Oxygen splash.

## Deploying (the loop)
```
git pull → edit under website/ → git add <your pathspec> && git commit && git push → verify live
```
New page = add its slug to `website/pages.json` + push. New section = add it to `website/sections.json`
+ drop `website/sections/<id>/embed.html`.

## Gotchas (learned)
- **Never `git add -A` / `git add notes/` from a shared checkout** — it sweeps another chat's
  in-flight files. Stage your own pathspec (MANIFESTO §Working protocol).
- **Netlify deploy ≠ WP plugin update.** Pushing does not update the PHP; that's the manual drop
  (or the deploy Action, once its secrets exist). ACF *data* does auto-update.
- **Oxygen shortcodes must be signed** after a host/domain move, or the builder goes blank (also
  needs PHP 8.2 + 512M memory). See memory `oxygen-site-migration-checklist`.
- **Put `[brg_*]` in an Oxygen _Shortcode_ element / WP Shortcode block — not a Text element.**
- **One reveal engine only.** `brgw.js` self-inits every `.brgw` root; never add a second init
  script or a parallel slider. GSAP is lazy-loaded and prefers the host page's copy.
- **CSS is inlined into the WP page**, so asset URLs inside fragments must be absolute CDN URLs.
- **Headless screenshots:** `--force-device-scale-factor=2` widens `innerWidth` past `--window-size`
  and crops the right edge — verify mobile nav at scale 1.

## Coordination — restructured 2026-08-12
**Clone per chat, one owner per file.** `MANIFESTO.md` is the contract;
`.githooks/territory.tsv` is the machine-readable map and `.githooks/pre-commit` enforces it
(**currently `warn`**, flip to `block` once Finn's clone is running clean). `CLAUDE.md` is the
per-chat operating brief. Shared: `notes/roundtable.md` (the cross-chat thread),
`notes/tasks.json` (the board), `notes/log/` (dated shared entries). Each chat still keeps its
own decision log (`notes/controller.md`, `notes/finesser.md`). Expo is retired — `notes/explorer*`
is archive, and research is a task on the board.

Set up a clone: `./.githooks/install.sh <chat> warn`, then push with `git push origin HEAD:main`.
**Clones must live on local disk — never in a cloud-synced folder.**

## Key links
Repo: github.com/seanmarshall21/brg-web · Live: blacktoprestaurantgroup.com · CDN: blacktoprg.netlify.app
