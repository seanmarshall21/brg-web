# BRG-WEB — Project Status

_Living snapshot so any chat/machine can pick up where we are. The **Controller** maintains
this; other chats request edits via their `notes/*.md`. Update whenever state changes._

**Last updated:** 2026-08-13 (Conti) — 18/18 sections built · **16 sections ACF-editable (62
fields live)** · plugin **v2.6.1**, deployed by the Action · monoliths retired · five seats on
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

**Verified behind the gate 2026-08-13, on plugin v2.6.1:** all five render every one of their
sections, **zero literal `[brg_` tokens**, no leftover `{{tokens}}`, no PHP errors, nav present
with 5 items and the active state resolving. Every shortcode on every page reports **`v2.6.1`**.

**The legacy monolith fragments are retired** (2026-08-13 — Sean: *"the only page up is splash so
we are good"*). `website/<slug>/embed.html` deleted, `website/pages.json` emptied to `[]`, so
`[brg_<slug>]` is no longer registered: a forgotten page using one now renders the **literal**
`[brg_home]` rather than silently rendering empty. They had drifted badly from the sections they
duplicated — home's headline was five lines against the live two — while this file described them
as "still exist and still work". That sentence cost a wrong diagnosis before they went, which is
the argument for deleting a duplicate rather than maintaining one.

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

## ACF-editable sections — chain verified end to end 2026-08-12
A section declares its slots in **`website/sections/<id>/slots.json`** (beside the fragment, so a
slot and its `{{token}}` ship in one commit) → `kit/build-acf.py` generates
`website/acf/brg-<id>.acf.json` + the combined `all.acf.json` → `brg-acf.php` registers the
**Section Content** options page and **fetches those groups from Netlify**. A field change is:
edit `slots.json` → run the generator → push. **No import step, ever.** Fill precedence:
shortcode attr > ACF option > default. Field name = `brg_<id_with_underscores>_<slot>`.
Verified: ACF Pro 6.8.7 active and the Section Content menu is registered in wp-admin.

`python3 kit/build-acf.py --check` proves every slot has a `{{token}}` and vice versa — both
halves fail silently otherwise. **It is currently red:** `community-partner` declares four slots
with no tokens in its fragment, so those fields edit nothing. That's Finn's `acf-slot-tokens`.

## Deploying the WordPress side (no longer a hand-drop)
`.github/workflows/deploy-mu-plugins.yml` SCPs `website/wp-mu-plugin/*.php` to the server on
every push that touches them, then SSHes back in and greps `VCC_VERSION` out of the deployed
file — because scp succeeding only proves bytes moved. Auth is password (`WP_SSH_HOST`,
`WP_SSH_USER`, `WP_SSH_PASSWORD`, `WP_MU_PLUGINS_PATH`). **First successful deploy: 2026-08-12,
run 31670042632 — v2.4.0 → v2.5.0, verified live on all five pages.** Manual `workflow_dispatch`
is still available from the Actions tab.

## Open items
1. **Wire the sections for ACF** (`acf-slot-tokens`, Finn). The loader, the options page and the
   plugin fill are all live and proven; what's missing is `{{tokens}}` + `slots.json` per section.
   Until then `build-acf.py --check` stays red and the one declared field group edits nothing.
2. ~~Verify the live plugin version.~~ **Done — v2.5.0 live**, all five pages, cache-busted.
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
- **Never `git add -A` / `git add notes/`** — it sweeps files that aren't yours. Clone-per-chat
  plus the territory hook makes this hard to do by accident now, but stage your own pathspec.
- **Anything committed under `website/` deploys to the public CDN.** Prep and reference material
  go in `work/` or `website/mocks/` (gitignored) — this has bitten twice.
- **Netlify deploy ≠ WP plugin update** — but the Action closes that gap now: a push touching
  `website/wp-mu-plugin/**` deploys the PHP and verifies the version on the server. ACF field
  data auto-updates separately, via the loader's fetch.
- **Oxygen shortcodes must be signed** after a host/domain move, or the builder goes blank (also
  needs PHP 8.2 + 512M memory). See memory `oxygen-site-migration-checklist`.
- **Put `[brg_*]` in an Oxygen _Shortcode_ element / WP Shortcode block — not a Text element.**
- **One reveal engine only.** `brgw.js` self-inits every `.brgw` root; never add a second init
  script or a parallel slider. GSAP is lazy-loaded and prefers the host page's copy.
- **CSS is inlined into the WP page**, so asset URLs inside fragments must be absolute CDN URLs.
- **Headless screenshots:** `--force-device-scale-factor=2` widens `innerWidth` past `--window-size`
  and crops the right edge — verify mobile nav at scale 1.

## Coordination — restructured 2026-08-12
**Five seats: conti · finn · expo · dee · dum. Clone per chat, one owner per file.** `MANIFESTO.md` is the contract;
`.githooks/territory.tsv` is the machine-readable map and `.githooks/pre-commit` enforces it
(**currently `warn`**, flip to `block` once Finn's clone is running clean). `CLAUDE.md` is the
per-chat operating brief. Shared: `notes/roundtable.md` (the cross-chat thread),
`notes/tasks.json` (the board), `notes/log/` (dated shared entries). Each chat still keeps its
own decision log. **Expo** = content strategy + the two unbuilt pages (held until Finn is
rolling). **Dee/Dum** = helper seats that own `work/<chat>/` and hand finished work to its owner
to promote — `work/` is outside `website/` so prep never deploys to the CDN.

Set up a clone: `./.githooks/install.sh <chat> warn`, then push with `git push origin HEAD:main`.
**Clones must live on local disk — never in a cloud-synced folder.**

## Key links
Repo: github.com/seanmarshall21/brg-web · Live: blacktoprestaurantgroup.com · CDN: blacktoprg.netlify.app
