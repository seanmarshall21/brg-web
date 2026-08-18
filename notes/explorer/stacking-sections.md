# SPEC-001 — Stacking Sections

**Status:** ✅ **APPROVED to build** — Conti, `DECISION:` 2026-08-10, with four amendments (folded in below)
**Written by:** Expo (Explorer) 2026-08-09 · **amended** 2026-08-10
**Built by:** Finn (section fragments) + Conti (plugin)
**Depends on:** nothing. Phase 1 is additive — every existing `[brg_<slug>]` keeps working byte-for-byte.
**Verified against:** `f8113db` — claims about the codebase were checked at this tree; re-check before acting on a `file:line` or a state claim.

> **Amendment log — 2026-08-10, per `notes/controller.md`**
> **(a)** Phases 2↔3 inverted — harvest only the 5 sections Careers needs, prove parity, *then* harvest the rest (§7).
> **(b)** **B4 dropped.** Scoped `.brgw-sec--<id>` CSS makes a duplicate `<style>` idempotent, and the strip-regex was
> exactly the markup-regex failure mode §8 rejects elsewhere — I shouldn't have specced it. Plugin change #3 ships
> without it (§3, §6).
> **(c)** Motion parity confirmed in code; Finn runs the screenshot-diff at the Phase-3 gate with the harness in
> `notes/finesser/`.
> **(d)** §9 Q1–Q4 answered — recorded inline, plus one new contract rule on slot defaults (§5).
>
> **Deploy gate (separate `DECISION:`):** nothing touches the *deployed* plugin until v2.0.0 is verified live. Conti may
> write v2.1.0 in the repo; the mu-plugins upload waits for one `[brg_<slug>]` page rendering `<!-- vc_embed brg/<slug>
> v2.0.0 -->` + nav. Everything in §7 Phases 1–2 is local/repo work and is **not** blocked by that gate.

---

## 1. What we're solving

Today one WP page = one `[brg_<slug>]` = one whole hand-authored fragment. To reorder the home
page you edit `home/embed.html`; to reuse the Community CTA band on Careers you copy markup.
Five fragments already contain **14 recognisable, repeated section archetypes** (SPEC-002).

Goal: a WP page composes itself from several section shortcodes —

```
[brg_header active="careers"]
[brg_section id="hero-page" heading="Work with us" sub="Real people. Rad experiences."]
[brg_section id="perks-list"]
[brg_section id="cta-band" heading="Apply today" cta_href="/apply/"]
[brg_footer]
```

— so ordering, A/B-ing and reuse are page-builder edits, not code edits, while the markup and
motion stay ours in the repo.

## 2. What already works (verified in the code, not assumed)

- **Shared-asset dedupe across stacked shortcodes.** `static $shared` in `vcc_render_page`
  ([vc-clients-embed.php:101–110](../../website/wp-mu-plugin/vc-clients-embed.php)) is per-request,
  keyed by client — the 2nd..Nth BRG shortcode on a page emits no `<style>`/`<script>`. ✅
- **Multiple reveal roots.** `startAll` inits every `.brgw` whose parent has no `.brgw` ancestor
  ([brgw.js:55–62](../../website/assets/brgw.js)). Each shortcode emits its own
  `<div class="brgw brgw-shell">`, so N stacked shortcodes = N top-level roots, each initialised
  once, no double-splitting of headings. ✅
- **Recursion guard.** The zero-width-space rewrite at the end of `vcc_render_page` already stops
  a `[brg…` token inside fetched markup from re-expanding. ✅
- **Stale-while-error fetch.** `vcc_fetch` serves the last-good body for a week if Netlify blips —
  a stacked page degrades section-by-section, never to a blank page. ✅

## 3. What blocks it (the actual work)

| # | Blocker | Evidence | Fix |
|---|---|---|---|
| B1 | **Chrome duplicates.** Every page shortcode emits header + footer. 4 stacked = 4 headers, 4 footers. | [:113–115](../../website/wp-mu-plugin/vc-clients-embed.php) | Sections never emit chrome; add explicit `[brg_header]` / `[brg_footer]`. §6 |
| B2 | **No path for a section.** Slug is sanitised to `[a-z0-9-]` (slashes stripped) and hard-wired to `/<slug>/embed.html`, so `sections/hero` fetches `/sectionshero/embed.html`. | [:90](../../website/wp-mu-plugin/vc-clients-embed.php), [:97](../../website/wp-mu-plugin/vc-clients-embed.php) | Separate `vcc_render_section()` with its own path builder. §6 |
| B3 | **Asset dedupe is trapped inside `vcc_render_page`.** A second render function gets its own `static` → shared CSS/JS inlined twice on a page mixing a page + sections. | [:101](../../website/wp-mu-plugin/vc-clients-embed.php) | Lift to `vcc_shared_assets()`; both renderers call it. §6 |
| ~~B4~~ | ~~**Same section twice = duplicate `<style>`.**~~ **Dropped 2026-08-10 (Conti).** Because every section's CSS is scoped under `.brgw-sec--<id>` (§4 rule 3), a repeated block is *idempotent* — identical bytes, identical cascade, no visual effect. Cost is a few hundred duplicate bytes in a page that's already inlining the whole stylesheet. The cure (regex-stripping `<style>` out of fetched markup) was worse than the disease and contradicted §8. If duplicate bytes ever matter, hoist section CSS to a collected head-inject properly. | — | none — not a blocker |
| B5 | **Nav can't know the active page.** `is-active` comes from the rendered slug; a stacked page has no single slug. | [:71](../../website/wp-mu-plugin/vc-clients-embed.php) | `[brg_header active="careers"]`. §6 |
| B6 | **Cold-cache fan-out.** N sections = N sequential `wp_remote_get` at 8s timeout each. A 7-section page on a cold cache is a slow TTFB. | [:50–52](../../website/wp-mu-plugin/vc-clients-embed.php) | Cap ~8 sections/page + raise TTL for sections. **Controller call** — see §9 Q3. |

Also worth knowing, not blocking: `startAll` is one-shot (`if (started) return`,
[brgw.js:56](../../website/assets/brgw.js)). Fine for server-rendered stacks, since every section
is in the DOM before `DOMContentLoaded`. It would need an exported re-init only if we ever
lazy-load a section — not now.

## 4. File layout

```
website/sections/<section-id>/embed.html    ← markup + its own scoped <style>
website/sections.json                       ← the section manifest
```

`<section-id>` is `[a-z0-9-]+` — same charset the plugin already sanitises to, so no new rules.

### The fragment contract

A section fragment is **one root element and nothing else**:

```html
<!-- BRG · section: cta-band -->
<section class="brgw-sec brgw-sec--cta-band reveal">
<style>
  .brgw-sec--cta-band{background:#000;padding:clamp(70px,12vh,150px) var(--pad);text-align:center;}
  .brgw-sec--cta-band h2{font-size:clamp(2rem,5vw,3.6rem);text-transform:uppercase;}
  .brgw-sec--cta-band .lede{max-width:52ch;margin:22px auto 34px;opacity:.85;}
</style>
  <h2 class="blanco anim-head">{{heading}}</h2>
  <p class="lede anim-up">{{sub}}</p>
  <a class="btn anim-cta" href="{{cta_href}}">{{cta_label}}</a>
</section>
```

Four rules, and they're the whole contract:

1. **No `<section class="brgw">` wrapper.** The plugin's `.brgw brgw-shell` provides the token
   scope. Dropping the inner root also means a section file can be pasted straight inside an
   existing page fragment — so the Finesser can compose locally and compose-test with the exact
   same bytes that ship.
2. **Root carries `reveal`** (plus `anim-head` / `anim-up` / `anim-cta` inside) so the shared
   IntersectionObserver picks it up. No section ever ships its own JS.
3. **Every CSS rule is scoped under `.brgw-sec--<id>`.** This is the collision answer: sections
   invent **zero** new global class names, so `.lede`, `.card`, `.row` are free inside each one
   and the MANIFESTO's "globally unique names" rule needs no per-section reservation. Only
   `brgw-sec` and `brgw-sec--*` get added to §Shared tokens.
4. **`{{slot}}` tokens** for anything a page might want to override (§5). Everything else is
   baked in.

## 5. `sections.json`

```json
{
  "version": 1,
  "sections": [
    {
      "id": "cta-band",
      "title": "CTA band",
      "group": "cta",
      "summary": "Black band, big display heading, lede, one yellow button.",
      "status": "live",
      "slots": {
        "heading":   { "type": "text", "default": "Come say hi" },
        "sub":       { "type": "text", "default": "" },
        "cta_label": { "type": "text", "default": "Get in touch" },
        "cta_href":  { "type": "url",  "default": "/careers/" }
      }
    }
  ]
}
```

- `slots` is a **whitelist**. A shortcode att that isn't a declared slot is ignored — a WP editor
  can never inject markup through a shortcode att.
- `type` picks the escaper: `text` → `esc_html`, `url` → `esc_url`, `html` → `wp_kses_post`
  (use `html` sparingly; only where an em-dash-and-`<br>` line actually needs it).
- Empty default + empty att → the token resolves to `''` and the line collapses. Sections should
  be written so an empty slot degrades to a missing element, not an empty box.
- **Defaults must be the real production copy, never placeholders** (contract rule, Conti
  2026-08-10, from Finn's refinement). The compose harness renders from repo files and *cannot*
  see slot values stored in WordPress — so if defaults are `Lorem`/`TBD`, a default compose-test
  stops representing the live page and the "verify before DONE" rule silently degrades. Write the
  real headline as the default; a WP att then overrides it only where a page genuinely differs.
- **Separate file, not a `type` field in `pages.json`.** `pages.json` drives the nav
  ([:66–76](../../website/wp-mu-plugin/vc-clients-embed.php)); putting sections in it would need
  filtering at three call sites and one missed filter puts "Cta Band" in the header. Two files,
  no filtering.

## 6. Plugin changes (Controller)

Seven changes, all additive. Nothing in `vcc_render_page` changes behaviour for an existing page.

1. **Client config** — add `'sections' => '/sections.json'` alongside `'manifest'` (:33–37).
2. **`vcc_shared_assets( $client, $cfg, $ttl )`** — lift lines 101–110 verbatim into a function
   holding the `static $shared`. `vcc_render_page` calls it; so does the new section renderer.
   Fixes B3. *(This is the one refactor of existing code — worth doing first and alone.)*
3. **`vcc_render_section( $client, $id, $atts )`**:
   ```php
   $id   = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $id ) );
   $frag = vcc_fetch( $base . '/sections/' . $id . '/embed.html', $ttl );
   $frag = vcc_fill_slots( $frag, $id, $atts, $cfg, $ttl );   // §5
   // (no repeat-section <style> stripping — B4 dropped 2026-08-10; scoped CSS is idempotent)
   if ( ! empty( $atts['anchor'] ) ) { /* inject id="…" on the root element */ }
   return $css_js_once . '<div class="brgw brgw-shell">' . $frag . '</div>' . $js_once;   // no chrome
   ```
4. **`vcc_fill_slots()`** — read `sections.json` (same cached fetch), walk the declared slots,
   `str_replace( '{{key}}', escaped, $frag )`, then strip any `{{…}}` left over.
5. **Shortcodes** — `[brg_section id="…"]` generic, plus `[brg_s_<id>]` aliases registered from
   `sections.json` exactly the way page aliases are registered today (:141–152).
6. **`[brg_header active="…"]` / `[brg_footer]`** — thin wrappers over `vcc_chrome()`, which
   already takes the active slug as its second arg (:62). Fixes B1 + B5. Server-side we can't know
   which shortcode is *last* on a page, so the footer is explicit rather than auto — one extra
   shortcode per page, and it's honest about what it does.
7. **Bump `VCC_VERSION`** to `2.1.0` so the `<!-- vc_embed … v2.1.0 -->` marker proves the upload
   landed. The plugin is a manual upload to `/wp-content/mu-plugins/` — pushing the repo does not
   update it.

**Back-compat:** `[brg_home]` etc. keep emitting chrome. A page is either "one page shortcode"
(today) or "header + sections + footer" (new). Mixing both would double the header, so the
manifest keeps them distinct and the docs say so.

## 7. Rollout

**Phases 2↔3 inverted 2026-08-10 (Conti amendment (a))** — the contract test moves to the front.
Harvesting 14 sections before proving one page composes correctly would mean writing 14 fragments
against an unproven contract; if §4 is wrong, all 14 get reworked. Prove it on 5, then scale.

| Phase | Work | Risk | Who | Blocked by deploy gate? |
|---|---|---|---|---|
| **1** | Harvest **only the 5 sections Careers needs** — `hero-page`, `badge-rule`, `perks-list`, `apply-button`, `cta-band` — into `website/sections/<id>/embed.html` per the §4 contract. Draft `sections.json` (real copy, §5) in `notes/finesser/`, hand up as a `NEED:` | none — nothing references them | Finn | no — local |
| **2** | **Go/no-go.** Extend the compose harness to assemble a stacked Careers from those section files; screenshot-diff vs monolith `[brg_careers]`, desktop 1440 + mobile 390 | contained to one page, local only | Finn | no — local |
| **3** | On parity: Conti ratifies `website/sections.json` and writes plugin **v2.1.0** in the repo. Upload waits on the v2.0.0 live-verify gate | none in-repo | Conti | **upload only** |
| **4** | Harvest the remaining archetypes (SPEC-002 order); migrate the other pages; retire duplicated markup last | low, reversible | Finn | no |

Phase 2 is the go/no-go. If stacked Careers doesn't match the monolith pixel-for-pixel and
motion-for-motion, the answer is to fix the section fragments or the §4 contract — not to loosen
the bar.

Two things that make Phase 2 a *real* test rather than a rubber stamp, both from Finn's turn:
`.anim-head{opacity:0}` is cleared **only** by `brgw.js`, so a capture taken before the font gate
resolves silently drops every display headline while still looking like a valid page — the harness
polls for it. And motion parity is structural, not incidental: the stagger is computed per
`.reveal` ([brgw.js:40–45](../../website/assets/brgw.js)), and §4 rule 2 puts exactly one `.reveal`
on each section root, so a stacked page reproduces the monolith's per-block cadence by
construction.

## 8. Why not the alternatives

- **Oxygen-native sections.** Puts markup back in the builder — kills the dictate→push→live loop
  and re-introduces the exact "log into WP to change a heading" problem this stack removed.
- **One fragment with `show="hero,values"` filters.** Server-side HTML filtering by class; no
  reordering, no reuse across pages, and a regex-over-markup failure mode.
- **Client-side composition (JS fetches sections).** Breaks the no-FOUC guarantee the reveal
  engine is built on (`brgw.css` hides content at first paint) and hurts SEO on a marketing site.

## 9. Open questions — ✅ all resolved (Conti, 2026-08-10)

- **Q1 — Slots at all?** → **Yes, but few.** `heading`, `sub`, `cta_label` + `cta_href`, `anchor`.
  Body copy, lists and grids stay in git where they're reviewable and diffable. Carries the new
  contract rule in §5: **defaults are the real production copy, not placeholders.**
- **Q2 — `[brg_footer]` explicit or auto-injected?** → **Explicit.** A `the_content` filter would
  be fewer shortcodes to place but more magic, and harder for a human to reason about in Oxygen.
- **Q3 — Cold-cache budget (B6).** → **Cap ~8 sections/page; section TTL 600s.** `ttl="0"` and
  `?brg_refresh=1` still bust it instantly during a build session.
- **Q4 — `brgw-sec` / `brgw-sec--*` in MANIFESTO §Shared tokens?** → **Added** (MANIFESTO:99–100),
  along with `website/sections.json` → Conti and `website/sections/<id>/embed.html` → Finn in the
  ownership table.

## 10. Still open (Expo, tracked here so they don't get lost)

Not blockers for Phases 1–2; they want an answer before Phase 4 turns 14 sections into live pages.

- **A stacked page has no single "page" identity.** Nav active-state is solved by
  `[brg_header active="…"]` (B5), but `<title>`, meta description and OG tags come from the WP
  page, not from us — fine, as long as nobody assumes `pages.json` still describes what a page
  contains. Worth a line in `STATUS.md` when Phase 4 lands (Conti's file).
- **`hero-page` carries the `<h1>`.** If a page ever stacks two heroes, or none, it gets two `<h1>`s
  or zero. Cheap fix: an `as="h1|h2"` slot on `hero-page`, decided when a second hero actually
  appears rather than pre-emptively.
- **SPEC-002 #11 `stat-strip` is still content-blocked** — three of four numbers read literal `XX`
  (STATUS open item 3). Harvestable now, not shippable until the real figures exist.
