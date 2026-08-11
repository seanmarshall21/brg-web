# Upstream reference — fc-brands (Temper's system)

BRG borrows patterns from **`seanmarshall21/fc-brands`** (the Temper/FC-Brands system).
**We are READERS there — never push/PR/edit it.** We copy patterns OUT into brg-web.
Live: https://temperfest.netlify.app/kit/ · https://temperfest.netlify.app/kit/shortcodes.html

**Snapshot referenced:** registry **v1** · 41 components · commit `f8db350` · 2026-08-11.

## Why this file exists (drift detection)
fc-brands stamps every component with a `version` (int) and a `contract` (hash of its
shortcode/type/slug + every attribute name + default). **When we pull/parallel something,
we record its contract here.** Later, re-clone and re-run the check; a changed contract
means the attribute surface moved and our copy may be stale — re-read that component before
trusting our version.

Re-check command (run in a fresh clone of fc-brands):
```bash
python3 -c "import json;r=json.load(open('temper/kit/registry.json'));print('\n'.join(f\"{c['id']:18} v{c.get('version')}  {c.get('contract')}\" for c in r['components']))"
```

## Reference ledger (what BRG pulled / parallels)
| fc-brands id | ver | contract (as of f8db350) | BRG implementation | relationship |
|---|---|---|---|---|
| `nav` | 1 | `11d3f98b3055` | `website/assets/brgw-nav.*` + `[brg_nav]` in the plugin | **fresh reskin** — same design + attr names, our own code |
| `password` | 1 | `8c6b407d5c6c` | `website/wp-snippets/brg-password-gate.php` | reskin of their password gate |
| `footer` | 1 | `672dfb0bf4c3` | `[brg_footer]` (simple lockup) | parallels theirs (ours is minimal) |
| `fc_embed` | 1 | `2b6e339ed573` | `vc-clients-embed.php` (whole embed system) | same idea, our own plugin |

## Coupling traps from their nav — and how BRG stands
Their `nav.md` coupling table lists 4 SILENT failures. Because we built BRG's nav **fresh**
(reskin, not a copy), we avoided all four — worth keeping true on any future pull:
1. **Baked texture** — fc-menu.css hardcodes Temper's `base-full.webp` → wrong-brand texture. *BRG:* no baked texture. ✅
2. **Hardcoded ticketing URL** — their PHP falls back to a Temper LEAP url → nav points at the WRONG EVENT, silently. *BRG:* no CTA/ticketing. ✅
3. **Menu-location name collision** — they register `temper_primary/temper_social`. *BRG:* namespaced `brg_primary/brg_social`. ✅
4. **Fonts not loaded by the component** → silent Arial fallback. *BRG:* Montserrat/Blanco are `@font-face`'d in `brgw.css`, inlined alongside `brgw-nav.css`. ✅

## Nav attribute diff (BRG vs their `nav` v1)
- **BRG has:** `layout` (left/split/center/compact), `left`, `right`, `sticky` (pin/hide), `bg` (solid/none/frost), `bgcolor`, `opacity`. Default layout `left` (theirs `compact`).
- **They also have (BRG could adopt):**
  - `register` (auto/dark/light) — auto-invert to the section behind. **BRG has the mechanism (gated in brgw-nav.js) but no attr — worth exposing.**
  - `dropdowns` (more/bar) — submenu handling. **BRG GAP: our nav ignores WP submenu/child items.**
  - `radius` — nav corner radius (minor).
  - `menulogo`/`menutext`/`logo` — logo handling (BRG uses an `<img>` from the CDN; fine).
- **Temper-specific — skip unless BRG adds a CTA:** `tickets`, `tixlabel`, `meta`, `mtix` (event ticketing).
- **Naming note:** their `surface` (auto/frost/off) ≈ our `bg` frost; their `register` ≈ our on-dark auto-invert. If we want lockstep naming across sites, align these — but our `bg` is already shipped (v2.4.0).

## Process worth stealing (their `temper/kit/`)
Their docs never drift because they're **generated from `registry.json`**, not hand-kept:
`extract-truth.py` (what the code says) → `validate-registry.py` (registry vs code; exit 1 on
drift; recomputes the contract hash, errors if it moved without a version bump) → `build-kit.py`
(renders the hub + shortcodes page). Rule: run the generator in the **same commit** as any
shortcode change. **BRG hand-maintains `SHORTCODES.md` + `docs/shortcode-index.html` today — the
exact drift problem this solves.** Candidate to adopt: a `brg` registry.json + a small generator.
