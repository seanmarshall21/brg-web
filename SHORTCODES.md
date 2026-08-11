# BRG — Shortcode Reference

Every BRG shortcode + the attributes you can pass to customize it. This reflects the
**actual plugin** (`website/wp-mu-plugin/vc-clients-embed.php`, v2.3.0) — not aspirational.
Where Temper has a knob BRG doesn't have yet, it's called out under **Not yet configurable**.

---

## How the system works (in one breath)
Pages are code fragments on Netlify, pulled into WordPress natively (no iframe) by a shortcode.
Edit a fragment in the repo → `git push` → Netlify redeploys → the page updates in ~60s. The
**nav is managed in WordPress** (Appearance → Menus). You only place a shortcode once in WP.

---

## The shortcodes

| Shortcode | What it renders | Attributes |
|---|---|---|
| `[brg_<slug>]` e.g. `[brg_home]` | A whole **page** fragment (v2.0 monolith) + header/footer | `ttl`, `chrome` |
| `[brg page="community"]` | Same as above, generic form | `page`, `ttl`, `chrome` |
| `[brg_<id>]` e.g. `[brg_community-hero]` | One **section** fragment (no chrome) | `ttl`, `anchor`, *(slots)* |
| `[brg_section id="cta-band"]` | Same as above, generic form | `id`, `ttl`, `anchor`, *(slots)* |
| `[brg_nav]` | The **navigation** (content from the WP menu) | `ttl` |
| `[brg_footer]` | The shared **footer** lockup | `ttl` |
| `[vc_embed url="…"]` | One-off: any Netlify fragment by full URL | `url`, `ttl` |

A page is **either** one monolith `[brg_<slug>]` **or** `[brg_nav]` + sections + `[brg_footer]` —
not both (mixing doubles the chrome).

---

## Attributes

### `ttl` — server cache, in seconds *(every shortcode)*
How long WordPress caches the fetched fragment before re-pulling from Netlify.
- **Default:** `120` (2 minutes).
- `ttl="0"` → never cache; always fetch fresh. Put this on **test/staging pages** so edits show
  instantly. Leave it off (or higher) on live pages for speed.
- Example: `[brg_home ttl="0"]`

### `?brg_refresh=1` — instant cache bust *(URL, not an attribute)*
Add `?brg_refresh=1` to any page's URL to force every BRG shortcode on it to re-fetch once.
Handy after a push when you don't want to wait out the `ttl`. Example:
`https://blacktoprestaurantgroup.com/community/?brg_refresh=1`

### `chrome` — header/footer on monolith pages *(`[brg_<slug>]`, `[brg page=]`)*
- **Default:** on (the page renders with the shared header + footer).
- `chrome="0"` → render the page fragment **bare**, no header/footer. Use when you're stacking
  chrome yourself. Example: `[brg_home chrome="0"]`
- *(Ignored by section shortcodes — sections never emit chrome.)*

### `id` — which section *(`[brg_section]` only)*
Which section fragment to render. Example: `[brg_section id="careers-apply"]`.
The per-section aliases (`[brg_careers-apply]`) don't need this — the id is baked in.

### `page` — which page *(`[brg]` only)*
Which page fragment to render. Example: `[brg page="team"]`. The per-page aliases
(`[brg_team]`) don't need it.

### `anchor` — jump-link id *(section shortcodes)*
Injects `id="…"` onto the section's root element so you can link to it (`/careers/#apply`).
Example: `[brg_careers-apply anchor="apply"]`. Only `[a-z0-9-]` is kept.

### `url` — raw fragment *(`[vc_embed]` only)*
Full URL of any Netlify fragment to inline. Example:
`[vc_embed url="https://blacktoprg.netlify.app/home/embed.html"]`. Netlify-host only.

### `slots` — per-section content overrides *(section shortcodes)*
A section can expose `{{token}}` slots (heading, sub, cta_label, cta_href, anchor) that you
override from the shortcode, escaped by declared type (`text`/`url`/`html`). **Status: the
mechanism is live, but no section declares slots yet** — every section's copy is currently baked
into its fragment. When Finn adds slots to a section in `sections.json`, they'll appear here and
you'll pass them like `[brg_cta-band heading="Apply today" cta_href="/careers/"]`.

---

## The nav — WordPress menu + layout attributes
`[brg_nav]` content is a WordPress menu; its **layout is set by shortcode attributes** (v2.3.0):

| Attr | Default | Does |
|---|---|---|
| `layout` | `left` | `left` · `split` · `center` (logo centered) · `compact` |
| `left` / `right` | `2` / `2` | items per side (split/center) or total-before-overflow (compact); overflow → a **More** drawer |
| `sticky` | `pin` | `pin` stays; `sticky="hide"` = hide-on-scroll-down |

Full example: `[brg_nav layout="center" left="2" right="2" sticky="hide"]`

**To set the items:**

1. **Appearance → Menus** → create **"BRG — Primary"**, add/order items + links.
2. **Manage Locations** → assign it to **BRG — Primary** (`BRG — Social` is registered for later).

The styling (white bar, yellow rule, teal marker underline on hover + active page) lives in the
repo and pushes live; the *content* lives in WP. Change the nav = edit the WP menu, no code.

---

## Not yet configurable (Temper has these; BRG doesn't — yet)
BRG's nav was built to your export (fixed logo-left, no CTA pill), so these Temper knobs weren't
ported. Easy to add if you want them — tell me which:
- ~~Nav layout modes~~ — **DONE (v2.3.0):** `layout`/`left`/`right`/`sticky` + More drawer.
- **A CTA pill** (Temper's Tickets) — BRG has none; could add e.g. a "Contact" or "Order" button.
- **Auto-invert** over dark/light sections (the code's in `brgw-nav.js` but gated off; BRG's nav
  is solid white by design).
- **Mobile Tickets placement** (`data-tix`) — N/A without a CTA.
- **`[brg_footer]` options** — Temper's footer takes `capture`/`wordmark`/`layout`/`band`/`reg`
  etc.; BRG's footer is the simple lockup only.

---

## Naming convention
- `[brg_<slug>]` — a whole page (slugs in `pages.json`: home, our-restaurants, team, community, careers).
- `[brg_<page>-<section>]` — a section (ids in `sections.json`: `community-hero`, `careers-apply`, …).
- `[brg_nav]` / `[brg_footer]` — shared chrome.

## Adding things (no plugin edits)
- **New page:** Claude adds `website/<slug>/embed.html` + a line in `pages.json`; push. Then drop `[brg_<slug>]` on a WP page.
- **New section:** Claude adds `website/sections/<id>/embed.html` + a line in `sections.json`; push. Then drop `[brg_<id>]` where you want it.
- **Nav item:** Appearance → Menus. No code, no push.
