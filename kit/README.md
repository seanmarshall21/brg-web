# BRG kit — how the shortcode docs stay honest

`registry.json` is the **single source of truth** for every BRG shortcode: slug, type,
attributes, defaults, options, prose. The docs are **generated from it** — so they can't
drift. Pattern borrowed from fc-brands (`temper/kit`); see [`notes/upstream-fc-brands.md`](../notes/upstream-fc-brands.md).

## What's generated (never edit these by hand)
| Output | What it is |
|---|---|
| `SHORTCODES.md` | Markdown reference (tables + per-attr docs). |
| `docs/shortcode-index.html` | The visual index (filterable cards). |

Both carry a header saying they're generated. Edit `kit/registry.json`, then run the builder.

## The loop
```bash
python3 kit/build.py            # regenerate both docs from the registry
python3 kit/build.py --check    # CI-style: exit 1 if a contract moved un-bumped, or docs are stale
python3 kit/build.py --restamp  # bump version + re-hash any component whose contract moved
```
**Run `kit/build.py` in the same commit as any shortcode change** (add/rename/re-default an
attribute). `--check` is the guard.

## Versioning — how to tell what's live
Every component carries a **`version`** (int) and a **`contract`** (12-char hash of its
shortcode + type + every attribute name + default). Prose is excluded on purpose — rewording a
doc string is not a contract change.

- Change an attribute (name/default/options-that-affect-default) → the contract moves.
  `--check` fails: *"contract moved … without a version bump."* Run `--restamp` to bump the
  version and re-hash, then commit. So a doc generated from v1 can never quietly be v2's markup.
- This mirrors fc-brands, so BRG and Temper track contracts the same way. Our upstream ledger
  (`notes/upstream-fc-brands.md`) records **their** contract hashes; this registry records **ours**.

## Editable sections (ACF) — `kit/build-acf.py`
A section becomes WordPress-editable (change image/text without code) by declaring `slots` on
it in `website/sections.json`, then generating its field group:
```bash
python3 kit/build-acf.py          # website/sections.json slots -> website/acf/brg-<id>.acf.json
python3 kit/build-acf.py --check  # every slot has a {{token}} and vice versa
```
The flow (borrowed from fc-brands, but BRG needs **no per-section PHP** — the plugin fills any
section generically — and **no manual import**, which is where we diverge from theirs):
1. **One-time:** the mu-plugin `website/wp-mu-plugin/brg-acf.php` registers the **Section
   Content** options page *and* fetches `all.acf.json` from Netlify, registering each group with
   `acf_add_local_field_group()`. Requires ACF Pro. It is deployed by the GitHub Action — do not
   upload it by hand. *(This superseded the old `brg-section-content-options.php` WPCode snippet,
   which no longer exists.)*
2. **Fragment:** the section's `embed.html` uses `{{slot}}` tokens (`{{heading}}`, `{{image}}`, …).
3. **Declare:** write `website/sections/<id>/slots.json` — **beside the fragment, same owner** —
   then run `build-acf.py` and push. **That's the whole loop; there is no import step.** The
   loader re-fetches and the fields update themselves.
   ```jsonc
   // website/sections/community-partner/slots.json
   {
     "_note": "keys starting with _ are ignored — use them for comments",
     "heading":   { "type": "text",     "label": "Heading",      "default": "Want to partner with us?" },
     "sub":       { "type": "textarea", "label": "Sub copy",     "default": "…" },
     "cta_label": { "type": "text",     "label": "Button label", "default": "Get in touch" },
     "cta_href":  { "type": "url",      "label": "Button link",  "default": "/contact/" }
   }
   ```
   Types: `text` · `textarea` · `url` · `image` · `html`. **Defaults must be the real production
   copy**, never placeholders — the compose harness can't see WP-stored values, so a default
   compose-test is only representative if the defaults are what the page actually says.
   *(A `slots` object inline in `sections.json` still works and is read as a fallback, but it
   splits a wiring across two owners' files. `--check` flags a section that declares both.)*
4. Editors change fields under **Section Content**; the plugin fills the slots.
   **Precedence: shortcode attr > ACF value > built-in default.** Field name = `brg_<id>_<slot>`.

**Run `--check` whenever you touch either half.** Steps 2 and 3 are edited by different people in
different clones, and both halves fail *silently*: a slot with no `{{token}}` gives WordPress a
field that edits nothing (the editor types, saves, and sees no change, with no error to go on),
while a `{{token}}` with no slot is stripped on render, so that copy simply disappears. fc-brands
checks the same class of bug with `tools/acf-readers.py --strict` — their coupling is field → PHP
reader, ours is slot → `{{token}}`.

> **`--check` is necessary but not sufficient — it cannot see the runtime.** It compares declared
> slots to `{{tokens}}`, and both of those live in this repo. It says nothing about whether the
> *deployed plugin* reads slots from where they are now declared. That gap is not hypothetical:
> when declarations moved to `slots.json`, plugin v2.5.0 still read `sections.json` only, so a
> `slots.json`-declared section would have rendered with **every token stripped** — an empty
> button and an empty line of copy — while `--check` stayed green the whole time. Fixed in
> **v2.6.0** (`vcc_fill_slots()` prefers `slots.json`, falls back to inline). The rule this
> leaves behind: a green `--check` means the two halves *in git* agree; confirm the third on the
> live page.

## Rules
- **Edit `registry.json`, never the generated files.**
- **Defaults must match the code** — `shortcode_atts()` in `vc-clients-embed.php` and the
  `CFG`/attr reads in the fragments. If you change a default in code, change it here in the same commit.
- **Keep the generated pages self-contained** — no CDN, no external requests.
