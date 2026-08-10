# notes/finesser/ — the Finesser's workspace

**Single writer: the Finesser chat.** Controller + Explorer READ freely; they log to their own
`notes/*.md`.

`notes/finesser.md` stays the **log** — dated one-liners (`DONE:` / `NEED:` / `QUESTION:`) that the
Controller scans each turn. This folder holds the **tooling** that backs the "verify before you
call it done" rule, plus any working notes too long for a log line.

Nothing here ships. It lives outside `website/` on purpose: `website/` is the Netlify publish
dir, so anything in there goes straight to the CDN.

## The compose-test harness

The rule is that a page gets verified the way the plugin actually renders it — shared CSS →
header → fragment → footer → shared JS — not by eyeballing a fragment on its own, and not by
asking a human to look. These two scripts are that check, so it's one command per turn.

```bash
node notes/finesser/compose.mjs --serve      # compose all 5 pages, serve on :8787
node notes/finesser/shot.mjs home            # desktop 1440 + mobile 390, full page
```

| File | What it does |
|---|---|
| `compose.mjs` | Rebuilds a WP page locally, mirroring `vcc_render_page()` + `vcc_chrome()` in the plugin — nav built from `pages.json`, `.is-active` on the current slug, shared assets inlined in the same order. `--live` composes from `blacktoprg.netlify.app` instead of local files, to check what actually deployed. |
| `shot.mjs` | Screenshots a composed page at 1440 (desktop) and 390 (mobile), full-page. Zero dependencies — drives the system Chrome over the DevTools Protocol via Node's built-in `WebSocket`. |
| `.out/` | Composed HTML + `shots/*.png`. Gitignored. |

### Two things `shot.mjs` has to do, and why

**It forces `.is-in` before a full-page capture.** `IntersectionObserver` never fires for
off-screen sections, so a single full-page shot would otherwise show only the hero with
everything below it still hidden. Adding `.is-in` puts every section in its final resting
state — it sets the same class the engine sets, it does not modify the engine. Use
`--no-reveal` to capture the as-loaded state instead, and `--fold` for above-the-fold only.

**It asserts readiness instead of sleeping.** `brgw.js` gates the whole reveal on the Blanco
Cavelary font (1.8s race, 3.5s hard fallback), and **only the JS clears `.anim-head`'s
`opacity:0`** — CSS never does. So a shot taken a moment too early silently loses every display
headline while looking like a perfectly valid page. `shot.mjs` polls until every `.anim-head`
is actually opaque and the font resolved, and prints a loud ⚠ if either never happened. Treat
a warned shot as no proof at all.

Related: headless Chrome backgrounds its tabs by default, which throttles the timers the font
gate depends on — hence `--disable-background-timer-throttling` and friends in the launch
flags. Without them every headline was missing from the capture.

## Rules I work under
- **Consume the shared engine, never rebuild it.** One reveal engine, one slider, one doodle
  system — `brgw.css` + `brgw.js` self-init on every `.brgw` root. No second init script.
- **Clear shared changes through the Controller first.** `brgw.css`, `brgw.js`, the WP plugin,
  `pages.json`, or any new page/section/feature → log a `NEED:` and wait for a `DECISION:` 👍.
  Pure polish inside a single `website/<slug>/embed.html` proceeds and is logged `DONE:`.
- **Compose-test + screenshot before `DONE:`.**

## What I don't touch
`pages.json` + the WP plugin + `STATUS.md` (Controller), `notes/explorer/**` and the other two
chats' note files. Shared assets I own but only ship with sign-off.
