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

**Recommendation: expose THREE, bake the rest.**

| Expose | As | Why |
|---|---|---|
| **Variant** (`u_variant`, `hl_variant`) | `select` | Already how `hl_variant` works. This is the real choice — U1–U4, H0–H4 — and it is per-section by nature. |
| **Mark colour** (`--brgw-hl-c`) | `select` of brand colours | Genuinely varies per section today (yellow / teal / pink / orange). Must be a select, not a colour picker, or the palette leaks. |
| **Speed** | `select`: Slower / Standard / Faster | Three named steps that scale BOTH `-dur` values together, so the family holds. Not a millisecond box. |

Bake as tokens, not fields: easing, delay, Y nudge, stroke timing, padding, rotation. These are
design decisions made once. If one is wrong, it is a one-line CSS fix by whoever owns `brgw.css`
— not a field that has to be right in nine places.

## 4. Slot declarations, ready for the generator

Blocked only on `select` existing (`2dace015d8`). Wording is mine; values are the real ones.

```json
"hl_variant": { "type": "select", "label": "Highlight style", "default": "h3",
  "choices": { "h3": "Rough block, angled wipe",
               "h1": "Smooth wipe — safe across line breaks",
               "h4": "Label pill — for OUR VISION, LEADERSHIP",
               "h0": "Static, no animation" } },

"u_variant":  { "type": "select", "label": "Underline style", "default": "u3",
  "choices": { "u3": "Filled brush, angled wipe",
               "u1": "Simple bar",
               "u0": "None" } },

"anim_speed": { "type": "select", "label": "Animation speed", "default": "std",
  "choices": { "slow": "Slower", "std": "Standard", "fast": "Faster" } }
```

`return_format: "value"` is load-bearing — without it ACF returns the LABEL, so the fragment
receives `Rough block, angled wipe` where it expects `h3`, and prose lands in an attribute.
Recorded on `2dace015d8` because it is the generator's job, not the slot's.

**H2 and U2/U4 are deliberately absent.** `website/lab/README.md:28-39` parks them — U2 reads as
a ballpoint, U4 muddies below 2rem, H2 is superseded by H3. A dropdown listing every variant we
ever built is a menu of known-worse options.

## 5. Open — Sean's, and only his

1. **Does he want all six exposed, or the three above?** §3 is an argument, not a decision.
2. **What "colour nudge" means** — the lab has `Colour` and `Y nudge` separately.
3. **Whether speed should be three named steps or a real number.** Named steps keep the family;
   a number lets him tune one section exactly and is the more literal reading of what he asked for.
