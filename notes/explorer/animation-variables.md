# SPEC-012 — Exposing the animation variables

**Status:** proposed · BRG Specs · 2026-08-20 · board `f401758b51`
**Verified against:** working tree at `c9b2f49` — every `file:line` here was checked at that tree.

Sean, 19 Aug: *"I thought there was talk about using more variables. We have the testers with
variables in them that have animation speed, ease out, ease in, colour nudge, the text colour
and the card colour. Those should all be variables to adjust."*

---

## 1. Which lab he means, because there are two and only one has these knobs

- **`website/lab/motion.html`** has exactly **one** control: `Speed`, a range 0.25–2.5×
  (`motion.html:220`). Not this one.
- **`notes/explorer/studies/lab.html`** (promoted to `website/kit/lab.html`) is the one with the
  knobs he is describing. Controls, measured:

| Lab control | id | Range / kind | Default |
|---|---|---|---|
| Speed | `dur` | range 200–1600 ms | 720 |
| Easing | `ease` | select | — |
| Colour | `col` | colour | — |
| Stroke timing | *(dial)* | range −600…900 ms, step 25 | 0 |
| Speed *(per card)* | `.sp` | number 200–4000 ms | — |
| Y nudge *(per card)* | `.yn` | number −40…40 px | — |
| Text in highlight | — | text | — |

**His five names do not map cleanly onto these six controls, and I am not guessing the mapping.**
"Ease out, ease in" is one `Easing` select, not two. "Colour nudge" matches no control — the lab
has `Colour` and `Y nudge` as *separate* knobs, so it is probably those two remembered as one.
"Text colour" and "card colour" are plausibly `Colour` and `Text in highlight`. See §5.

## 2. What already exists as a CSS variable

Six, and they are already the right shape — `brgw.css:270` and `:321`:

```
--brgw-u-dur:.62s   --brgw-u-delay:.6s   --brgw-u-ease:cubic-bezier(.2,.7,.2,1)   /* underline */
--brgw-h-dur:.52s   --brgw-h-delay:.12s  --brgw-h-ease:cubic-bezier(.2,.7,.2,1)   /* highlight */
```

Plus three the highlight system already reads (`brgw.css:310-317`): `--brgw-hl-c` (mark colour),
`--brgw-hl-pad`, `--brgw-hl-rot`.

**So the variables Sean is asking for mostly EXIST.** What does not exist is a way to set them
from wp-admin. That is the actual gap, and it is one dependency: `kit/build-acf.py:38` has no
`select` type (board `2dace015d8`).

## 3. The argument: a lab knob is not an admin field

This is the part I would want Sean to disagree with explicitly rather than by default.

**A knob exists to find a value once. A field exists to vary a value forever.** They look the
same and they are not, and turning all six knobs into fields has three costs:

1. **Easing cannot be a text field.** `cubic-bezier(.2,.7,.2,1)` typed with one wrong character
   is not an error — it is an ignored declaration, so the animation silently falls back to
   `ease` and looks *slightly* wrong. That is the plausible-failure class this project keeps
   logging. As a `select` of named curves it is safe; as free text it is a trap.
2. **Per-section timing destroys the family.** The reason the site reads as one system is that
   the underline and the highlight share an easing curve and near-identical durations. Give six
   sections independent speed fields and they will drift apart within a month, one well-meaning
   edit at a time, and nobody will be able to say when it stopped feeling coherent.
3. **Every field is a question asked of whoever inherits this.** SPEC-007's doctrine — an admin
   built for us is not an admin we can hand over — cuts both ways. Nine fields nobody
   understands is worse than three they do.

> ## RULED BY SEAN 2026-08-20 — ALL SIX, AS DROPDOWNS
>
> He read the argument above and overrode it. **That is his call and this spec now builds
> what he asked for**, not what I recommended. He did accept the one constraint that mattered:
> **dropdowns, never text boxes** — so §3.1's silent-typo failure cannot happen, which was the
> only cost I would have pushed back on twice.
>
> He also settled §5.2: **"colour nudge" was two knobs remembered as one** — the `Colour`
> control and the `Y nudge` control, separately.
>
> The §3 argument is kept rather than deleted. If the fields do drift the sections apart, the
> reasoning for why should be readable next to the decision that accepted the risk — not
> reconstructed from memory a year later.

---

## 4. The six, as ruled

Every one a `select`. Values are the real CSS values; labels are plain language.

| # | Sean's name | Field | Drives | Exists? |
|---|---|---|---|---|
| 1 | animation speed | `anim_speed` | `--brgw-u-dur` + `--brgw-h-dur` together | ✅ `brgw.css:270,321` |
| 2 | ease out / ease in | `anim_ease` | `--brgw-u-ease` + `--brgw-h-ease` | ✅ same |
| 3 | card colour | `hl_colour` | `--brgw-hl-c` | ✅ `brgw.css:310` |
| 4 | *(nudge half)* | `hl_nudge` | **new var needed** | ❌ no variable today |
| 5 | text colour | `hl_text_colour` | **new var needed** — `.hl-t` hardcodes `color:var(--ink)` at `brgw.css:324` | ❌ |
| 6 | *(the style itself)* | `hl_variant` / `u_variant` | `[data-hl]` / `[data-u]` scope | ✅ shipped, defaults `h3` |

**Two need new CSS variables first** (`brgw.css`, Finn's file): a `--brgw-hl-nudge` applied as a
`translateY` on `.mark`, and a `--brgw-hl-t` replacing the hardcoded `var(--ink)` on `.hl-t`.
Both are one-line additions with the current value as the fallback, so nothing changes until a
slot sets them.

```json
"anim_speed":     { "type":"select", "label":"Animation speed", "default":"std",
  "choices": { "slow":"Slower", "std":"Standard", "fast":"Faster" } },

"anim_ease":      { "type":"select", "label":"Animation feel", "default":"settle",
  "choices": { "settle":"Settle — eases out at the end (default)",
               "even":"Even — same speed throughout",
               "spring":"Spring — slight overshoot" } },

"hl_colour":      { "type":"select", "label":"Highlight colour", "default":"yellow",
  "choices": { "yellow":"Yellow", "teal":"Teal", "pink":"Pink", "orange":"Orange",
               "purple":"Purple" } },

"hl_text_colour": { "type":"select", "label":"Text on the highlight", "default":"ink",
  "choices": { "ink":"Black", "white":"White" } },

"hl_nudge":       { "type":"select", "label":"Nudge the highlight", "default":"0",
  "choices": { "-6":"Up a little", "-3":"Up slightly", "0":"Aligned (default)",
               "3":"Down slightly", "6":"Down a little" } },

"hl_variant":     { "type":"select", "label":"Highlight style", "default":"h3",
  "choices": { "h3":"Rough block, angled wipe",
               "h1":"Smooth wipe — safe across line breaks",
               "h4":"Label pill — for OUR VISION, LEADERSHIP",
               "h0":"Static, no animation" } },

"u_variant":      { "type":"select", "label":"Underline style", "default":"u3",
  "choices": { "u3":"Filled brush, angled wipe", "u1":"Simple bar", "u0":"None" } }
```

`return_format: "value"` is load-bearing — without it ACF returns the LABEL, so the fragment
receives `Rough block, angled wipe` where it expects `h3`. Recorded on `2dace015d8`.

**H2, U2 and U4 are deliberately absent.** `website/lab/README.md:28-39` parks them — U2 reads
as a ballpoint, U4 muddies below 2rem, H2 is superseded by H3. A dropdown listing every variant
we ever built is a menu of known-worse options.

**`hl_nudge` values are px as strings**, negative for up. Named rather than numeric because Sean
ruled dropdowns: an editor picking "Up a little" cannot enter `40px` and push a mark off its text.

## 5. Build order

1. **`2dace015d8`** — `select` in `kit/build-acf.py` (Conti). Nothing below works without it.
2. **Two new CSS vars** in `brgw.css` (Finn) — `--brgw-hl-nudge`, `--brgw-hl-t`, each defaulting
   to today's value so the site does not move.
3. **Declare the slots** per section (Finn) and regenerate.

Steps 2 and 3 can run in parallel with 1; only the regeneration waits.
