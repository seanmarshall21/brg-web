# BRG — Go-Live Runbook

The **one human step** that unblocks everything: create the WordPress pages that hold the
shortcodes. The code is done and deployed to Netlify; WordPress just has no pages yet (every
`/<slug>/` is currently 404). ~10 minutes.

Only Sean can do this — it needs the WP login (a chat can't and won't).

## 1. Confirm the plugin is installed
WordPress → **Code Snippets** (WPCode) or `/wp-content/mu-plugins/` → the
**VC-Clients Embed** plugin is **Active**. (Same place the password gate lives.)

## 2. Create the 5 pages
For **each** row: WordPress → **Pages → Add New**.

| Page title | URL slug | Shortcode to paste in the body |
|---|---|---|
| Home | `home`¹ | `[brg_home]` |
| Our Restaurants | `our-restaurants` | `[brg_our-restaurants]` |
| Team | `team` | `[brg_team]` |
| Community | `community` | `[brg_community]` |
| Careers | `careers` | `[brg_careers]` |

For each page:
1. **Title** = the name above.
2. Check the **URL slug** matches the table exactly (edit the permalink under the title).
3. In the body add a **Shortcode block** (or a WPCode/Oxygen **Shortcode element** — **not** an
   Oxygen *Text* element) containing just the shortcode, e.g. `[brg_community]`.
4. **Publish.**

¹ Home: you may instead set this page as **Settings → Reading → Homepage**. If the site root
already shows the Oxygen "Coming Soon" splash, keep Home at `/home/` for now and switch the
homepage over when you're ready to drop the splash.

> Tip for the first one: do **Community** first and verify it (below) before doing the other
> four — that proves the whole pipeline end-to-end on one page.

## 3. Verify
From the repo:
```bash
bash scripts/verify-live.sh
```
Green ✅ for every page means: HTTP 200, the `<!-- vc_embed brg/<slug> v2.0.0 -->` marker
(plugin ran), and the nav header injected. Or check one by hand — view source and look for that
marker comment.

**This v2.0.0 live-verify is the deploy gate for the stacking-sections plugin (v2.1.0).**
Once it's green, Conti ships v2.1.0.

## 4. Gotchas
- **Lock screen instead of the page?** That page has a **Password** set (Quick Edit → clear it).
  The gate only fires on password-protected pages.
- **Old/blank content?** Purge cache (**Purge Current Page**) or hard-refresh in incognito —
  page caching can serve a pre-shortcode version briefly. `?brg_refresh=1` on the URL busts the
  plugin's own fetch cache.
- **Nav missing?** Means an older plugin (pre-v2.0.0) is installed — re-upload the current
  `website/wp-mu-plugin/vc-clients-embed.php`.
- **Editing content later** never needs WP again — edit the fragment in the repo, `git push`,
  live in ~60s.
