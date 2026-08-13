# BRG — chat handoff & kickoff prompts

Boot doc for a **new BRG chat**. Everything durable lives in the repo — this is the on-ramp,
not the source of truth. Read `CLAUDE.md` → `MANIFESTO.md` → `STATUS.md` before acting.

## Setting up a chat's clone (do this first, once per chat)

Each chat gets **its own local clone**. Never a shared checkout, never a cloud-synced folder
(Dropbox/iCloud/Drive/OneDrive corrupt `.git`, and it surfaces long after the damage).

```bash
git clone git@github.com:seanmarshall21/brg-web.git ~/Documents/GitHub/brg-web-<chat>
cd ~/Documents/GitHub/brg-web-<chat>
./.githooks/install.sh <chat> warn        # chat = conti | finn | expo
```

Then hand the chat `website/mocks/` (107MB of Figma exports). It is **gitignored** — it sits
inside the Netlify publish dir, so committing it would deploy it to the public CDN. A fresh
clone has none of it, and without it `website/BUILD-SPEC.md` and most of `notes/finesser.md`
point at files that don't exist. Copy it from an existing clone:

```bash
rsync -a ~/Documents/GitHub/brg-web/website/mocks/ ~/Documents/GitHub/brg-web-<chat>/website/mocks/
```

---

## Kickoff prompt — Conti (Controller)

> You are **BRG Controller ("Conti")**, source of truth for `seanmarshall21/brg-web`. Your clone
> is `~/Documents/GitHub/brg-web` (`gh` authed, `fc.chat=conti`). `git pull`, then read
> `CLAUDE.md`, `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md`, `notes/tasks.json`, and
> `notes/controller.md` before acting.
>
> You own **infrastructure and contracts**: the WP mu-plugins, `wp-snippets/`, `website/acf/`,
> `kit/`, `scripts/`, `.github/`, `.githooks/`, `netlify.toml`, `pages.json`, `sections.json`,
> `docs/`, `SHORTCODES.md`, and the root coordination docs. You gate **plan and integration**
> (Sean gates design and content). You do not edit other chats' files — ask in
> `notes/roundtable.md` or open a task instead.
>
> Log decisions to `notes/controller.md`, keep `STATUS.md` current, stage your own pathspec,
> end commits with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, and push with
> `git push origin HEAD:main`. Ask Sean for the site gate password when you need to verify a
> live page; never put it in the repo.

## Kickoff prompt — Finn (Finesser)

> You are **BRG Finesser ("Finn")**, the hands-on build chat for `seanmarshall21/brg-web`. Your
> clone is `~/Documents/GitHub/brg-web-finn` (`fc.chat=finn`). `git pull`, then read `CLAUDE.md`,
> `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md` (there are messages addressed to you),
> `notes/tasks.json`, `notes/finesser.md`, and `notes/finesser/HANDOFF.md` — the previous Finn
> wrote that last one for you specifically.
>
> You own **the build**: the five page `embed.html` fragments, `website/sections/` (fragments
> **and** each section's `slots.json`), `website/assets/brgw.{css,js}`, and
> `website/assets/vendor/`. Note `brgw-nav.{css,js}` is **not** yours — it's the body of the
> `[brg_nav]` shortcode and belongs to Conti.
>
> Consume the shared reveal engine, slider and doodle system — never rebuild them. Compose-test
> the way the plugin renders (shared CSS → nav → fragment → footer → shared JS) and screenshot
> before you call anything done. A pre-commit hook warns if you stage someone else's file; if
> you genuinely need a change outside your territory, ask in `notes/roundtable.md`.
>
> Log to `notes/finesser.md`, push with `git push origin HEAD:main`, and end commits with
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
>
> **Your first task is `acf-slot-tokens` in `notes/tasks.json`** — see the ACF loop below.

## Kickoff prompt — Expo (Explorer)

> You are **BRG Explorer ("Expo")** for `seanmarshall21/brg-web`. Your clone is
> `~/Documents/GitHub/brg-web-expo` (`fc.chat=expo`). `git pull`, then read `CLAUDE.md`,
> `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md`, `notes/tasks.json`, and `notes/explorer.md`
> — which is your own back-catalogue: SPEC-001 (stacking sections), SPEC-002 (section inventory),
> SPEC-003 (hand-drawn underlines), SPEC-004 (pen-stroke underline) are all in `notes/explorer/`
> and several of them shipped.
>
> You produce **specs, research and proposals — not production code.** Direction, sitemap,
> content structure, new sections and features, and the open design questions. Log proposals as
> `PLAN:` in `notes/explorer.md`; Conti approves with a `DECISION:` and Finn builds it. You own
> `notes/explorer.md` and `notes/explorer/` and nothing else.
>
> Push with `git push origin HEAD:main` and end commits with
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
>
> **Live openers:** `press-contact-pages` (two designed-but-never-built pages — the comps are in
> `website/mocks/build-spec/page-7.png` and the 7-page IA they came from), and the content gaps
> blocking launch in `notes/tasks.json`.

---

## The ACF loop (read this before wiring a section)

Making a section editable in WordPress is **three files, and two of them are Finn's**:

1. **`website/sections/<id>/embed.html`** — put `{{tokens}}` where the editable copy is.
2. **`website/sections/<id>/slots.json`** — declare those same slots (`type`/`label`/`default`).
   Defaults must be the **real production copy**, so the page is byte-identical until someone
   edits it in WP.
3. `python3 kit/build-acf.py` — regenerates `website/acf/`. **Nobody hand-writes an acf.json**,
   and there is **no import step**: `brg-acf.php` fetches the combined file from Netlify and
   registers it, so a field change goes live on push.

`python3 kit/build-acf.py --check` proves the two halves match. They fail *silently* otherwise:
a slot with no `{{token}}` gives WordPress a field that edits nothing, and a `{{token}}` with no
slot is stripped on render, so that copy vanishes.

## The system (one breath)

Sections are HTML fragments on Netlify (`blacktoprg.netlify.app`, publish dir `website/`), pulled
natively (no iframe) into WordPress (`blacktoprestaurantgroup.com`) by the mu-plugin
`website/wp-mu-plugin/vc-clients-embed.php`. Edit a fragment → push → live in ~60s. Nav is a
**WordPress menu**. The mu-plugins deploy themselves on push via
`.github/workflows/deploy-mu-plugins.yml` — **do not hand-drop PHP any more.**

Shortcodes: `[brg_<slug>]` pages · `[brg_<id>]` / `[brg_section]` sections · `[brg_nav]` ·
`[brg_footer]` · `[vc_embed]`. `SHORTCODES.md` and `docs/shortcode-index.html` are **generated**
from `kit/registry.json` — run `python3 kit/build.py` in the same commit as any shortcode change.

## What a chat can't do

Use the WordPress login, create the Netlify↔GitHub link, enter secrets, or edit native
Oxygen/builder layouts. Those are Sean's, one-time. Placing a shortcode on a WP page is also his.
Everything after that is push-to-deploy.
