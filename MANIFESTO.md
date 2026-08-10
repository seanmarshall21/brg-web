# BRG-WEB — MANIFESTO (shared brain for the build chats)

Canonical coordination channel for the Claude conversations building this repo.
Lives in the repo on purpose: versioned, diffable, merge-safe, in-context on startup.
Any external doc/board is a human-readable mirror only — **this file is the working truth.**

Adapted from the TEMPER handoff (`new-project-starter/HANDOFF-how-we-run-temper.md`).

---

## The operating model (Explorer / Finesser / Controller)
Run this project across 2–3 conversations, each with a role, all sharing this one repo:

- **Controller** — **source of truth.** Owns direction & final decisions, signs off new
  features/sections and any change to shared code before it ships, keeps `STATUS.md`,
  owns the WP plugin + `pages.json` manifest, and does the canonical reconciliation
  pushes when work needs merging. **Everything routes through here.**
- **Finesser** — makes a page/section *pixel- and motion-right*: edits the fragment
  code + shared reveal engine, pushes, iterates on look/feel/timing, fixes mobile.
  The hands-on build chat.
- **Explorer** — explores *what the site could be*: sitemap, content/structure,
  references, best-practices research, new-section and new-feature proposals, and the
  "stacking sections" architecture. Produces **specs & ideas, not final production code.**

Scale: 2 chats minimum (Controller also finesses; Explorer optional) → add the Explorer /
extra Finessers as parallel work grows.

## The pipeline (how a change goes live)
```
you dictate → Finesser edits a file under website/ → push → Netlify auto-deploys (~30–60s)
            → WordPress page's [brg_<slug>] shortcode re-fetches the CDN file → live
```
No WP login, no re-upload, no builder edits for code changes. The builder is touched
once to **place** a shortcode. See `STATUS.md` for the concrete stack + URLs.

## Working protocol (every turn, every chat)
1. `git pull` before doing anything.
2. **Read the other chats' `notes/*.md`** (and `STATUS.md`).
3. Do the work — **consume shared utilities in `website/assets/`; never hand-roll a
   parallel reveal engine, slider, or doodle system.**
4. Append a dated entry to **your own** note file
   (`DONE:` / `PLAN:` / `NEED:` / `DECISION:` / `QUESTION:`). Single-writer files = no conflicts.
5. `git push`.

**Clearance rule (Controller oversight):** the Finesser and Explorer **clear changes
through the Controller before they land** for anything that touches shared code
(`website/assets/brgw.css`, `website/assets/brgw.js`), the WP plugin, `pages.json`, or
introduces a new page/section/feature. Log the request as a `NEED:`/`PLAN:` in your note;
the Controller replies with a `DECISION:` 👍 (or edits). Pure page-level polish inside a
single `website/<slug>/embed.html` may proceed and be logged as `DONE:`.

**New feature/section flow:** Explorer proposes (`PLAN:`) → **Controller 👍 (`DECISION:`)**
→ Finesser builds (`DONE:`). Prevents two chats building the same thing.

**Name collisions:** the maintainer's existing names win; the other chat renames
(that's what §Shared tokens is for).

## Roles → who is who
| Role | Conversation | Writes to |
|---|---|---|
| Controller | **BRG Controller** (main) | `notes/controller.md` |
| Finesser | **BRG Finesser** | `notes/finesser.md` |
| Explorer | **BRG Explorer** | `notes/explorer.md` |

## Ownership (primary maintainer per file/area)
| Maintainer | Files / area |
|---|---|
| **Controller** | `STATUS.md`, `MANIFESTO.md`, `website/pages.json`, `website/wp-mu-plugin/vc-clients-embed.php`, direction & reconciliation |
| **Finesser** | `website/<slug>/embed.html` (page fragments) **and** `website/assets/brgw.css` + `website/assets/brgw.js` (shared reveal engine / slider / doodles) |
| **Explorer** | proposals only — no production files; specs live in `notes/explorer.md` |

Either chat may push a fix to another's file, but note it in your log and preserve
in-flight changes on pull. Changes to shared assets follow the clearance rule above.

## Shared tokens (contract — globally unique; don't reuse a name in a second implementation)
Everything renders in **one shared namespace on the page** (the plugin inlines
`brgw.css`/`brgw.js` — there is no iframe), so these must never collide:

- **Root / namespace:** `.brgw` (every fragment's outer section), `.brgw-shell` (plugin wrapper).
- **CSS class prefixes:** `brgw-*` and `brgw__*` (e.g. `brgw-header`, `brgw-nav`, `brgw-hero`,
  `brgw-badge`, `brgw-doodle`, `brgw-banner`, `brgw-uline`, `brgw-lede`, `brgw__footer`).
- **Reveal engine classes:** `reveal`, `is-in`, `anim-head`, `anim-up`, `anim-cta`,
  `ln`, `ln-i`, `w`, `hl`, `blanco`, `btn`. Page-scoped section classes use a 2-letter
  page prefix: `or-*` (our-restaurants), `tm-*` (team), `cm-*` (community), `ca-*` (careers),
  `brgw__*` (home). Keep new page classes on that pattern.
- **Slider:** `brgw-slider`, `brgw-slider__track`, `brgw-slider__dots`, `brgw-dot`, `brgw-slide`.
- **Keyframes:** `brgw-jit`, `brgw-spin`, `brgw-pulse`, `brgw-bob`, `brgw-herodrift`, `brgw-cta`.
- **Color/space tokens (CSS vars on `.brgw`):** `--yellow --teal --pink --orange --bg --bg2
  --ink --white --pad`.
- **Fonts:** `Blanco Cavelary` (display; Montserrat is its fallback until the real file
  is confirmed everywhere), `Montserrat` (body/UI).
- **JS data-attrs / state:** `data-anim-init`, `data-slider-init`, `data-head="words"`,
  `data-autoplay`. **The whole engine self-inits on `.brgw` roots — never add a second
  init script.**

## Kickoff prompts (paste into each new conversation)
- **Controller (this chat, already running):** "You're the Controller/source-of-truth for
  `seanmarshall21/brg-web`. Read `MANIFESTO.md`, `STATUS.md`, and all `notes/*.md` first.
  You own direction, final decisions, new-feature sign-off, `pages.json`, the WP plugin,
  and `STATUS.md`. Log to `notes/controller.md`."
- **Finesser:** "You're the Finesser for `seanmarshall21/brg-web` (repo already cloned at
  ~/Documents/GitHub/brg-web). Read `MANIFESTO.md` + all `notes/*.md` first, `git pull`
  before every push. You own the page fragments `website/<slug>/embed.html` and the shared
  engine `website/assets/brgw.css` + `brgw.js` — but **clear any shared-asset / plugin /
  pages.json change through the Controller (a `NEED:` in your note) before it lands.** Consume
  the shared reveal engine, slider, and doodle system instead of rebuilding. Compose-test a
  page the way the plugin renders it (shared CSS → header → fragment → footer → shared JS)
  and screenshot before you call it done. Log to `notes/finesser.md`."
- **Explorer:** "You're the Explorer for `seanmarshall21/brg-web`. Research
  direction/sitemap/content/best-practices and propose new sections & features as **specs,
  not production code** — including the 'stacking sections' model (section-level fragments
  the Controller can wire into the plugin). Read `MANIFESTO.md` + all `notes/*.md`, and log
  proposals as `PLAN:` entries in `notes/explorer.md` for the Controller to approve."

## Credential boundary (what a chat can't do)
A chat **cannot** and must not: use the WordPress login, create the Netlify↔GitHub link,
enter secrets, or edit native Oxygen/builder layouts. Those are one-time human steps.
Everything after that is push-to-deploy.
