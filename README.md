# brg-web

The Blacktop Restaurant Group marketing site, for Vivo Creative.

Pages are built here as **HTML fragments**, served from Netlify, and pulled **natively** (no
iframe) into the existing WordPress/Oxygen site at `blacktoprestaurantgroup.com` by a must-use
plugin. Edit a fragment → push → live in about a minute. No WP login, no re-upload, no builder
edits for code changes.

```
edit a file under website/  →  push  →  Netlify deploys
                            →  the WP page's [brg_*] shortcode re-fetches it  →  live
```

## Layout

```
website/
  sections/<id>/embed.html    the 18 section fragments — the current shape of the site
  <slug>/embed.html           the 5 legacy monolith page fragments (still work)
  assets/brgw.{css,js}        shared engine: tokens, reveal, slider, doodles, lazy GSAP
  assets/brgw-nav.{css,js}    the nav component
  assets/media/               all site graphics, served from the CDN
  wp-mu-plugin/               the WordPress side: the embed plugin + the ACF loader
  wp-snippets/                the password gate
  acf/                        generated ACF field groups
  pages.json, sections.json   the manifests the plugin registers shortcodes from
kit/                          registry.json + the generators for the shortcode docs
notes/                        how the chats coordinate (roundtable, tasks, per-chat logs)
```

## Start here

| Read | For |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working in this repo: identity, territory, how to commit |
| [`MANIFESTO.md`](MANIFESTO.md) | How the chats are organised and who owns what |
| [`STATUS.md`](STATUS.md) | Where the project actually is |
| [`SHORTCODES.md`](SHORTCODES.md) | The shortcode + attribute reference (generated) |
| [`GO-LIVE.md`](GO-LIVE.md) | The WordPress page runbook |

## Notes

- `SHORTCODES.md` and `docs/shortcode-index.html` are **generated** from `kit/registry.json` —
  run `python3 kit/build.py` in the same commit as any shortcode change.
- The site is password-gated until launch.
- The "Coming Soon" splash build (`index.html`, `splash/`, `assets/`, …) is a separate,
  finished piece of work that lives untracked at the repo root — see `.gitignore`.
