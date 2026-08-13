# BRG-WEB — MANIFESTO (how the chats work)

Canonical coordination contract for the Claude conversations building this repo.
Lives in the repo on purpose: versioned, diffable, merge-safe, in-context on startup.
Any external doc/board is a human-readable mirror only — **this file is the working truth.**

**Restructured 2026-08-12 (Sean).** The old model — every chat sharing one checkout on `main`,
kept apart by per-role `git add` pathspecs — is retired. Discipline was doing a job that
structure should do. Now: **clone per chat, one owner per file, enforced by a hook.**

---

## The model

**One clone per chat.** Each conversation gets its own local clone. Nothing is shared through
a working tree, so no chat can sweep another's in-flight file into a commit, and `git pull`
can never touch a file someone else is mid-edit on. Coordination happens through `main`, which
is the only place the chats actually meet.

**One owner per file.** Every tracked path has exactly one owner, listed in
[`.githooks/territory.tsv`](.githooks/territory.tsv). Ownership is about *authorship*, not
permission to read — read everything, write only yours.

| Owner | Territory |
|---|---|
| **conti** (Controller) | Infrastructure and contracts: `website/wp-mu-plugin/`, `website/wp-snippets/`, `website/acf/`, `kit/`, `scripts/`, `.github/`, `.githooks/`, `netlify.toml`, `website/pages.json`, `website/sections.json`, `docs/`, `SHORTCODES.md`, and the root coordination docs (`MANIFESTO.md`, `STATUS.md`, `HANDOFF.md`, `CLAUDE.md`, …) |
| **finn** (Finesser) | The build: the five page `embed.html` fragments, `website/sections/`, `website/assets/brgw.{css,js}`, `website/assets/vendor/` |

**One exception worth knowing:** `website/assets/brgw-nav.{css,js}` is **conti's**, despite the
`brgw-` prefix — it's the body of the `[brg_nav]` shortcode, and every commit to it is a nav
version bump that moves `SHORTCODES.md`, `docs/`, and the plugin together. Its `.bnav*` classes
are deliberately namespaced away from Finn's `.brgw-*` for that reason. The history scan is what
caught this; the first draft of the map had it filed under Finn.
| **shared (`*`)** | `notes/roundtable.md`, `notes/tasks.json`, `notes/log/`, `.gitignore` |
| **unowned** | `website/assets/media/`, `website/mocks/` — inputs, not authored code. Whoever needs them edits them. |

**No standing research chat.** Expo is retired; `notes/explorer.md` + `notes/explorer/` are
archive — read them, don't extend them. Research is now a *task* in `notes/tasks.json`, picked
up by whichever chat is doing the work that needs it. A question that needed a standing chat to
answer was usually a question nobody had scoped.

**Two gates.** Every change passes one of them before it ships:
- **Conti** gates plan and integration — does this fit the architecture, does it break a
  contract, does it land in the right place.
- **Sean** gates design and content — does it look right, does it say the right thing.

Nothing else is a gate. If neither applies, build it.

## The pipeline (how a change goes live)
```
you dictate → a chat edits a file under website/ → push → Netlify auto-deploys (~30–60s)
            → the WP page's [brg_*] shortcode re-fetches the CDN file → live
```
No WP login, no re-upload, no builder edits for code changes. The builder is touched once to
**place** a shortcode. See `STATUS.md` for the concrete stack + URLs.

## Working protocol (every turn, every chat)
1. `git pull` (rebase — `install.sh` sets `pull.rebase true`).
2. Read `STATUS.md`, `notes/roundtable.md`, `notes/tasks.json`, and the other chat's log.
3. Do the work — **inside your territory.** Consume the shared utilities in `website/assets/`;
   never hand-roll a parallel reveal engine, slider, or doodle system.
4. Log it: your own `notes/<role>.md` for decisions, `notes/log/` for anything shared,
   `notes/roundtable.md` to address another chat.
5. `git push origin HEAD:main`.

**Push form matters.** Always `git push origin HEAD:main` — a chat clone may be on a
differently-named local branch, and this pushes what you have to where it belongs regardless.

**Clones live on local disk.** Never inside Dropbox, iCloud, Google Drive, OneDrive, or any
`CloudStorage` path. Sync daemons rewrite files under `.git`; the corruption surfaces later as
an unrecoverable repo, not as an error when it happens. `install.sh` warns if it sees one.

## The territory hook
`.githooks/pre-commit` reads `git config fc.chat` and refuses (or warns about) staged files
owned by another chat. `.githooks/pre-push` runs `kit/build.py --check`, `node --check` on
changed JS, and `php -l` on changed PHP — each of which exists because something once broke
silently. A missing interpreter prints SKIPPED rather than failing the push.

```bash
./.githooks/install.sh conti warn     # once per clone: chat id + warn|block
```

`fc.chat` unset → the hook is inert, so a human clone or CI is never blocked by a rule meant
for chats. Genuine cross-territory work: **say so out loud**, then
`FC_ALLOW_CROSS=1 git commit …`. The override exists so the honest path is easier than the
quiet one — an unexplained override in the log is the signal, not the block.

## Crossing a territory line
The hook stops the accident; this stops the argument.
1. Ask in `notes/roundtable.md`, addressed to the owner (`@finn` / `@conti`).
2. Or open a task in `notes/tasks.json` with `owner` set to whoever should do it.
3. The owner makes the change in their own clone. That's the default, and it's cheap —
   a request costs one round trip; an unowned edit costs a merge conflict and a bad diff.
4. **Emergency only:** `FC_ALLOW_CROSS=1`, and say what you did in `notes/roundtable.md`
   in the same turn.

**Name collisions:** the existing name wins; the newcomer renames (that's what §Shared tokens
is for).

## Roles → who is who
| Role | Chat | `fc.chat` | Own log |
|---|---|---|---|
| Controller | **BRG Controller** — "Conti" | `conti` | `notes/controller.md` |
| Finesser | **BRG Finesser** — "Finn" | `finn` | `notes/finesser.md` |
| ~~Explorer~~ | retired 2026-08-12 | — | `notes/explorer.md` (archive) |

## Shared coordination files
- **`notes/roundtable.md`** — the cross-chat thread. Newest first, sign every entry, address
  people with `@`. This is where a chat asks another for something.
- **`notes/tasks.json`** — the board. One entry per piece of work: `id`, `title`, `owner`,
  `gate` (conti | sean | none), `status` (todo | doing | blocked | done), `note`.
- **`notes/log/`** — dated shared entries: `YYYY-MM-DD-<chat>-<slug>.md`. One file per entry
  means two chats writing on the same day never touch the same file. Add your own; never edit
  someone else's.

## Shared tokens (contract — globally unique; don't reuse a name in a second implementation)
Everything renders in **one shared namespace on the page** (the plugin inlines
`brgw.css`/`brgw.js` — there is no iframe), so these must never collide:

- **Root / namespace:** `.brgw` (every fragment's outer section), `.brgw-shell` (plugin wrapper).
- **CSS class prefixes:** `brgw-*` and `brgw__*` (e.g. `brgw-header`, `brgw-nav`, `brgw-hero`,
  `brgw-badge`, `brgw-doodle`, `brgw-banner`, `brgw-uline`, `brgw-lede`, `brgw__footer`).
  The nav component is `.bnav*` (Conti-owned, deliberately namespaced away from `brgw-*`).
- **Reveal engine classes:** `reveal`, `is-in`, `anim-head`, `anim-up`, `anim-cta`,
  `ln`, `ln-i`, `w`, `hl`, `blanco`, `btn`. Page-scoped section classes use a 2-letter
  page prefix: `or-*` (our-restaurants), `tm-*` (team), `cm-*` (community), `ca-*` (careers),
  `brgw__*` (home). Keep new page classes on that pattern.
- **Slider:** `brgw-slider`, `brgw-slider__track`, `brgw-slider__dots`, `brgw-dot`, `brgw-slide`.
- **Sections (SPEC-001):** `brgw-sec`, `brgw-sec--<id>`. **Every section fragment's CSS must be
  scoped under `.brgw-sec--<id>`** — that is the whole collision contract: sections invent zero
  other global class names, so `.lede`/`.card`/`.row` are free inside each one and need no
  reservation here. `<id>` is `[a-z0-9-]+`.
- **Keyframes:** `brgw-jit`, `brgw-spin`, `brgw-pulse`, `brgw-bob`, `brgw-herodrift`, `brgw-cta`.
- **Color/space tokens (CSS vars on `.brgw`):** `--yellow --teal --pink --orange --bg --bg2
  --ink --white --pad`.
- **Fonts:** `Blanco Cavelary` (display), `Montserrat` (body/UI).
- **JS data-attrs / state:** `data-anim-init`, `data-slider-init`, `data-head="words"`,
  `data-autoplay`, `data-brgw-img`, `data-brgw-parallax`, `data-brgw-pin`. **The whole engine
  self-inits on `.brgw` roots — never add a second init script.**

## Generated files — never hand-edit
`SHORTCODES.md` and `docs/shortcode-index.html` are generated from `kit/registry.json`.
Edit the registry, run `python3 kit/build.py` in the **same commit** as any shortcode change.
`--check` fails on drift (pre-push runs it); `--restamp` bumps a moved contract.

## Credential boundary (what a chat can't do)
A chat **cannot** and must not: use the WordPress login, create the Netlify↔GitHub link,
enter secrets, or edit native Oxygen/builder layouts. Those are one-time human steps.
Everything after that is push-to-deploy.
