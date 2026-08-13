# BRG — Controller (Conti) Handoff

Boot doc for a fresh **BRG Controller** chat, replacing the previous one (context full).
Everything durable lives in the repo — this is the on-ramp, not the source of truth.

## You are Conti (the Controller)
Source of truth for `seanmarshall21/brg-web` (cloned at `~/Documents/GitHub/brg-web`, `gh`
authed). You own direction, sign-off, `STATUS.md`, `pages.json`, `sections.json`, the WP plugin,
the `kit/` pipeline, and reconciliation. Finn (build) and Expo (specs) clear shared changes
through you. **Sean is redefining how the sub-chats are set up — take his new instructions for
that over the old model when he gives them.**

## Read these first (in order)
1. `MANIFESTO.md` — roles, ownership, shared-token contract, protocol, nicknames (Conti/Finn/Expo).
2. `STATUS.md` — living snapshot.
3. `notes/controller.md` — my decision log (newest first) — the real running history.
4. `notes/finesser.md`, `notes/explorer.md` — what Finn/Expo last did.
5. `SHORTCODES.md` + `docs/shortcode-index.html` — the shortcode/attribute reference (GENERATED — see below).
6. `GO-LIVE.md` — the WP-pages runbook. `notes/upstream-fc-brands.md` — the Temper drift ledger.

## The system (one breath)
Pages/sections are HTML fragments on Netlify (`blacktoprg.netlify.app`, publish dir `website/`),
pulled natively (no iframe) into WordPress (`blacktoprestaurantgroup.com`) by the mu-plugin
`website/wp-mu-plugin/vc-clients-embed.php`. Edit a fragment → `git push` → live in ~60s. Nav is
a **WordPress menu**. Commit with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; stage
your own pathspec, never `git add -A` from a subdir.

## Where things stand (2026-08-11)
- **Plugin: live at v2.4.0.** Shortcodes: `[brg_<slug>]` pages · `[brg_<id>]`/`[brg_section]`
  sections · `[brg_nav]` · `[brg_footer]` · `[vc_embed]`. Verify a page carries `<!-- vc_embed
  brg/… v2.4.0 -->` (I saw a stale `v2.1.0` on section markers once — check the cache with
  `?brg_refresh=1`).
- **Nav (`[brg_nav]`, assets `website/assets/brgw-nav.css`/`.js`):** WP-menu-driven, **fixed**
  (not sticky — each shortcode has its own short wrapper), pen-stroke teal marker underline,
  morphing hamburger + staggered drawer. Attributes: `layout` (left/split/center/compact),
  `left`/`right` (+ More overflow drawer), `sticky` (pin/hide), `bg` (solid/none/frost),
  `bgcolor`, `opacity`. Menu location **"BRG — Primary"** (Appearance → Menus → Manage Locations).
- **Sections:** `website/sections.json` (18 ids). Heroes + `careers-apply` + `careers-positions`
  live; the rest are being harvested by Finn from the Figma exports in `website/mocks/`. Contract
  = SPEC-001 §4 (scoped `.brgw-sec--<id>`, root `reveal`, no `.brgw` wrapper). **Cross-section
  bleed rule** (+ shared-chrome exception) is in `notes/controller.md`.
- **Assets:** everything graphic is in `website/assets/media/` and live on the CDN (icons SVG,
  `bg/` incl. crown + responsive `bg/base/base-*.webp` hero collage, `bkgnds/` patterns, logos).
  Sean's rule: anything NOT exported is a CSS/styling decision, not a missing asset.
- **ACF-editable sections:** `{{slot}}` fill in the plugin; `kit/build-acf.py` generates per-
  section `acf.json` + a combined `website/acf/all.acf.json` from each section's `slots` in
  `sections.json`; **`website/wp-mu-plugin/brg-acf.php`** (install once) registers the "Section
  Content" options page + fetches & registers the field groups from Netlify. Only `community-partner`
  declares slots today (the worked example).
- **Docs pipeline:** `kit/registry.json` is the source of truth; `python3 kit/build.py` regenerates
  `SHORTCODES.md` + `docs/shortcode-index.html` with per-component `version` + `contract` hash
  (`--check` for drift, `--restamp` to bump). Don't hand-edit those two docs.
- **Automation:** ACF changes go live on push (brg-acf.php fetches data — safe). Plugin *code*
  can't be fetched-and-run (RCE); `.github/workflows/deploy-mu-plugins.yml` SCPs the mu-plugin
  files on push once Sean adds 4 SSH secrets (`WP_SSH_HOST/USER/KEY`, `WP_MU_PLUGINS_PATH`).
- **Password gate:** `website/wp-snippets/brg-password-gate.php` (`[brg_password]` + auto-gate).
  The 5 pages are password-protected. **Sean has the gate password — he'll give it to you
  directly; it is deliberately NOT in the repo.**

## Open threads (pick up here)
1. **Menu assignment** — confirm a WP menu is assigned to "BRG — Primary" (was showing the
   "Assign a menu…" fallback). Until then `[brg_nav]` has no items.
2. **Finn** is harvesting the 11 `todo` sections from `website/mocks/`; each goes live behind its
   already-placed shortcode on push.
3. **Expo** owes the **pen-stroke underline** study (make the marker underline look hand-drawn).
4. **One-time automation setup:** install `brg-acf.php`; add the 4 SSH secrets for the plugin Action.
5. **Nav IA:** "Our Story" = the Home page (`/brg-home/`); **Press & Gallery** + **Contact** are
   new pages not built yet.
6. **Launch:** point the site root at `/brg-home/` and retire the Oxygen "Coming Soon" splash when Sean's ready.
7. **Temper master reference:** `fc-brands` is read-only upstream; re-pull + `--check` its
   `registry.json` against `notes/upstream-fc-brands.md` before reusing a component.

## Kickoff prompt for the new chat (paste this)
> You are **BRG Controller ("Conti")**, source of truth for `seanmarshall21/brg-web` (cloned at
> `~/Documents/GitHub/brg-web`, `gh` authed). `git pull`, then read `HANDOFF.md`, `MANIFESTO.md`,
> `STATUS.md`, and all `notes/*.md` before acting. You own direction, sign-off, `STATUS.md`,
> `pages.json`/`sections.json`, the WP plugin, and the `kit/` pipeline. Log decisions to
> `notes/controller.md`; keep `STATUS.md` current; stage your own pathspec and end commits with
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Sean is redefining how the sub-chats
> are set up — follow his new instructions for that. Ask him for the site gate password when you
> need to verify live pages.
