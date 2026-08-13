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
     "cta_label": { "type": "text",     "label": "Button label", "default": "Want to partner with us?" },
     "cta_href":  { "type": "url",      "label": "Button link",  "default": "mailto:hello@blacktoprg.com?subject=Community%20partnership" },
     "sub":       { "type": "textarea", "label": "Sub copy",     "default": "Whether you're a nonprofit, school, or local organization — we'd love to talk." }
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

### If a claim matters, make something run it

Everything that stayed true on 2026-08-13 was **executed**; everything that rotted was **read**.
Four descriptions outlived their subjects in one day — a note about `_stale` behaviour, quoted
tool output, prose about the hyphen symptom written by two people, and a justification that a
commit falsified forty minutes later. The fixtures, the selftest and the version-derived grammar
all survived, because a thing that runs cannot quietly disagree with the thing it describes.

**A comment asserting a fact about another file is a copy, and copies rot silently.** So when a
claim matters, spend the extra few minutes making it executable: a fixture that reproduces it, an
assertion against the real source, a derivation instead of a constant. Where that genuinely isn't
possible — prose, rationale, this paragraph — say *when* it was true and *who* checked it, so the
next reader knows what to re-verify rather than trusting it.

(Articulated by Dee; the same shape one level down from "a rule that lives only in a chat message
outlives nothing".)

### Read this before the traps below

**`--check` proves the two halves agree with *each other*. Every trap in this list is a way they
can agree and still be wrong.** That is not a criticism of the check — it is the limit of what
any repo-side comparison can know. Five instances found on 2026-08-13 alone: a declaration that
had drifted from its own markup, the `_stale` ordering, the `&`/`&amp;` double-escape, a slot
name that is legal to the check and illegal to WordPress, and the runtime reading slots from a
file the check never looks at. In every one, both halves matched perfectly and the page was
wrong. **Green means "consistent", never "correct" — confirm the live render.**

> **`--check` is necessary but not sufficient — it cannot see the runtime.** It compares declared
> slots to `{{tokens}}`, and both of those live in this repo. It says nothing about whether the
> *deployed plugin* reads slots from where they are now declared. That gap is not hypothetical:
> when declarations moved to `slots.json`, plugin v2.5.0 still read `sections.json` only, so a
> `slots.json`-declared section would have rendered with **every token stripped** — an empty
> button and an empty line of copy — while `--check` stayed green the whole time. Fixed in
> **v2.6.0** (`vcc_fill_slots()` prefers `slots.json`, falls back to inline). The rule this
> leaves behind: a green `--check` means the two halves *in git* agree; confirm the third on the
> live page.

> **`ttl="0"` does not make a slot edit appear instantly.** The fragment is fetched fresh on every
> render, but `slots.json` uses `$ttl > 0 ? $ttl : VCC_TTL` — so on an explicitly *uncached* page
> the slots are still cached for 120s. Editing a default therefore takes up to two minutes to show
> on a page that is supposed to be uncached, which reads as "my edit didn't deploy". Add
> `?brg_refresh=1` to the URL to force both. (Found by Finn reading the fill, 2026-08-13.)

> **An empty `slots.json` now blanks the section.** A file that parses but is empty after
> `_`-filtering (all `_note`, or a draft) yields zero slots — and with no inline fallback left
> anywhere, that strips every token rather than falling back. On `community-stats` that is the
> whole 12-token grid. The rule is emptiness-not-absence: both the plugin (`! $slots`) and every
> mirror must fall through on *empty*, not merely on *missing*. (Finn's harness diverged from the
> PHP on exactly this; Dee's checker caught it.)

> **Every new section must be rendered live once before it can be considered safe — "priming".**
> `vcc_fetch` writes its week-long `_stale` copy *only on success* (`:85`), so a `slots.json` that
> has never been fetched has no last-good fallback. **No section carries an inline fallback any
> more**, so until that first successful fetch a single network blip returns `''` → zero slots →
> every `{{token}}` stripped. On `community-stats` that is 12 tokens: the whole grid blank.
>
> Priming needs a **real render of the WordPress page** — `blacktoprestaurantgroup.com/<page>/`,
> which runs the plugin server-side. Fetching the *CDN* file warms nothing. The client doesn't
> matter: `curl` of the WP page primes exactly as a browser does. The pages are gated, so this
> falls to whoever has the password (Conti).
>
> **A correctly-filled live render is itself the proof that priming happened.** All three paths
> through `vcc_fetch` imply `_stale` exists: the success path writes it; the failure path can only
> return content by *reading* it; and a primary-cache hit returns early without touching it, but
> `VCC_TTL` is 120s (`:36`) against a one-week `_stale` — so a primary hit is at most two minutes
> old and the call that created it wrote `_stale` in the same breath. You do not need a separate
> check. (Reasoning: Dee, 2026-08-13.)
>
> **When two sources disagree, the live page tells you which one won** — that divergence is the
> free discriminator. Use it before deleting any fallback.

## Screenshotting a section (and the two ways it lies)

`shot.mjs` needs Chrome's debug port, which some sessions can't bind. The fallback is headless
Chrome with `--virtual-time-budget` — no CDP, no server:

```bash
node notes/finesser/compose.mjs --live --stack
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --virtual-time-budget=6000 --window-size=1440,1500 \
  --screenshot=out.png "file:///…/notes/finesser/.out/home--stacked.html"
```

Two limits, both measured, both capable of making you report a bug that isn't there:

1. **Compose with `--live` — but know exactly what it means.** Without it, asset URLs are
   rewritten to `/assets/…`, which under `file://` resolves to *filesystem root*, so every image,
   font and doodle 404s and a missing collage reads as a broken section. **But `--live` means
   "everything from the CDN" — the fragment and `slots.json` as well as the assets. So it can
   never verify an unpushed local change:** both sides of your comparison are the deployed file,
   and it will report "identical" for the one reason that proves nothing. That has now produced
   two false verifications, one of which was reported as done. Use `--live` to look at what IS
   deployed; compose locally to check what you have just written.

   **Strongest option of all, when the page is gated and you have the password:** save the live
   WordPress HTML (`curl` with the gate cookie) and screenshot *that*. The plugin inlines the CSS
   and fragments carry absolute CDN URLs, so it renders faithfully — and it is the real plugin
   output rather than any reconstruction of it.
2. **`--window-size` height is the VIEWPORT, not a page-height crop.** It is not
   `captureBeyondViewport`: it changes every `vh` unit, media query and IntersectionObserver
   result. Faithful at 900 and 2600; **at 5200 the home hero collage vanishes entirely.** Tall
   viewports do reveal below-fold sections, but only because everything is technically in view —
   so **no height gives you both a real viewport and a full-page reveal.**

**So `--virtual-time-budget` is a fold/section checker; `shot.mjs` is the full-page tool.** A
rewrap check is a fold check, which is why the fallback covers the case that matters. (Limits
measured by Finn, 2026-08-13, after the fallback nearly produced a second false alarm.)

## The token grammar — TWO grammars, five implementations

They were one thing until plugin v2.6.1. Widening the strip split them, and treating them as one
name afterwards is itself a bug (Finn hit exactly that and split the constant):

| | Pattern | Meaning |
|---|---|---|
| **STRIPPABLE** | `[a-z0-9_-]+` | what the plugin removes at render, and what `--check` must *see* in a fragment in order to report it |
| **SLOT&nbsp;NAME** | `[a-z0-9_]+` | what a slot may legally be **called** — narrower, because the name becomes the ACF field name `brg_<id>_<slot>`, and a hyphen there is a hyphen in a WordPress meta key |

Neither can be shared as one literal — they live in three languages. So they are **defined here**
and duplicated at five sites, each citing this section. **Change one and you must change all:**

| Site | Which | What it does |
|---|---|---|
| `vc-clients-embed.php` (strip, in `vcc_fill_slots`) | STRIPPABLE | removes leftover tokens at render |
| `kit/build-acf.py` (`used` in `check()`) | STRIPPABLE | finds tokens in a fragment |
| `kit/build-acf.py` (`SLOT_NAME`) | SLOT NAME | **rejects** an illegal slot name — check *and* generate |
| `notes/finesser/compose.mjs` (`TOKEN_STRIPPABLE` / `TOKEN_SLOT_NAME`) | both | Finn's harness |
| `work/dee/slot-plugin-check/slotcheck.mjs` (`STRIP_RE`) | STRIPPABLE | Dee's live checker |

**Why `-` was added (v2.6.1).** It used to be underscores only, so an undeclared `{{cta_label}}`
was silently stripped while an undeclared `{{cta-label}}` was **neither stripped nor filled** —
the visitor read raw template syntax on a live page. Both the strip and `--check` now match it:
the check *sees* the typo and reports it, and the runtime *removes* it. A missing line of copy is
a defect; `{{cta-label}}` in front of a customer is a worse one. Found by Dee with fixtures.

**The grammar is VERSION-DEPENDENT, and no single constant can express it.** The same typo
inverts its symptom across the v2.6.1 boundary: an undeclared `{{cta-label}}` **renders literally**
at ≤2.6.0 and is **silently deleted** at ≥2.6.1. So a tool that checks a *live* site must derive
the class from the **deployed** version, not hard-code it — `slotcheck` does, and its selftest
verifies that derivation behaviourally against the class lifted out of the plugin's own
`preg_replace`, on probes chosen to straddle the boundary. The five sites must agree, **and they
must agree per version.** Any future guard that hard-codes the class is asserting something true
of exactly one release. (Dee, after `--selftest` caught `compose.mjs` still on the old class
within an hour of v2.6.1 — three of four layers had moved and the one that hadn't was the
reference mirror.)

**And why the split was then necessary.** Widening `used` removed the very disagreement that used
to expose a hyphenated *slot name*: declare `cta-label` and write `{{cta-label}}`, and both sides
now agree perfectly — `--check` went **green** while generating the ACF field
`brg_community_partner_cta-label`, which `get_field()` cannot read. The convention had nothing
enforcing it. `build-acf.py` now rejects an illegal slot name in **both** `--check` and
generation (generation exits rather than emit a broken field name). Spotted by Finn as a side
effect of my own fix, and closed with a fixture that reproduces it.

**Divergence between the four is the real risk, not the regex.** Dee's `slotcheck --selftest`
asserts the JS matches the PHP; run it after any plugin change. Dee's tool also caught Finn's
mirror returning `{}` instead of falling through on an empty-after-`_`-filtering `slots.json` —
a checker built to catch silent divergence finding one in its own reference implementation on
day one is the best argument for keeping the selftest honest.

> **Anything carrying structural markup cannot be a `text` slot.** `text`/`textarea` are
> `esc_html`'d, so a `<br>` becomes a visible `&lt;br&gt;`; `html` maps to an ACF wysiwyg, which
> returns `<p>`-wrapped content and breaks any rule styling the element directly. The home hero
> headline is the worked case: its two-line composition exists *because* of a hard `<br>`, so a
> headline slot has only two possible outcomes and both lose the design. **If the copy carries a
> `<br>` that the layout depends on, it stays as code.**

## Rules
- **Edit `registry.json`, never the generated files.**
- **Defaults must match the code** — `shortcode_atts()` in `vc-clients-embed.php` and the
  `CFG`/attr reads in the fragments. If you change a default in code, change it here in the same commit.
- **Keep the generated pages self-contained** — no CDN, no external requests.
