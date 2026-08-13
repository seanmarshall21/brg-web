# notes/explorer/ — the Explorer's workspace

**Single writer: the Explorer chat — "Expo".** Controller (**Conti**) and Finesser (**Finn**) READ
freely; they log to their own `notes/*.md`. Sean uses the short names in conversation; they're the
same three roles the MANIFESTO defines, nothing new.

`notes/explorer.md` stays the **log** — dated one-liners (`PLAN:` / `NEED:` / `QUESTION:`) that
the Controller scans each turn. Anything longer than a line lives **here** as a numbered spec,
and the log entry links to it. Nothing in this folder ships; it's all proposals until the
Controller writes a `DECISION:` 👍 in `notes/controller.md` and the Finesser builds it.

## Specs

| # | File | Topic | State |
|---|---|---|---|
| SPEC-001 | [`stacking-sections.md`](stacking-sections.md) | Section-level fragments — manifest, shortcode form, plugin changes | ✅ **approved to build** 2026-08-10 (amended: phases inverted, B4 dropped) |
| SPEC-002 | [`section-inventory.md`](section-inventory.md) | The 14 section archetypes already living in the 5 page fragments | **proposed** 2026-08-09 — harvest order superseded by SPEC-001 §7 (Careers 5 first) |
| SPEC-003 | [`hand-drawn-lines.md`](hand-drawn-lines.md) | Sean's `assets/lines/` underlines — why DrawSVG can't animate them, the clip-wipe that can, nav + hero wiring | **partly superseded** by SPEC-004 (centerlines recovered → draw beats wipe; GSAP-cost argument corrected) |
| SPEC-004 | [`pen-stroke-underline.md`](pen-stroke-underline.md) | Pen-stroke underline replacing `.brgw-uline` — 4 variants studied, real centerlines, GSAP load call | **proposed** 2026-08-10 · study: [`studies/pen-stroke-underline.html`](studies/pen-stroke-underline.html) |
| SPEC-005 | [`press-gallery-page.md`](press-gallery-page.md) | Press & Gallery — section plan for the designed-but-unbuilt page (4 sections, comp `mocks/build-spec/page-7.png`) | **proposed** 2026-08-13 |
| SPEC-006 | [`contact-page.md`](contact-page.md) | Contact — section plan for the never-designed page; the form-vs-routing decision that gates it | **proposed** 2026-08-13 |
| SPEC-007 | [`content-gaps.md`](content-gaps.md) | The launch-blocking content gaps — the `XX` stats, the stand-in photography, the `careers-posts` stamps + a placeholder doctrine | **proposed** 2026-08-13 |
| SPEC-008 | [`editable-copy-audit.md`](editable-copy-audit.md) | What else assumed the copy was ours — the location count lives in 3 editable places and already disagrees; corrects SPEC-007's claim that `12` was "already true" | **proposed** 2026-08-13 |

## Studies
Standalone sandbox pages. Not production, not on the CDN, not referenced by any fragment.
Open over HTTP (not `file://`) so the local GSAP in `website/assets/vendor/` loads.

## How I write a spec
Enough that the Finesser can build from it without asking me anything: sections, content,
layout intent, motion notes, references — plus, where it touches shared code, exactly which
file and function changes and who owns it. Where a claim comes from the code, I cite
`file:line` so the Controller can check it rather than take my word.

## What I don't touch
`website/**` (Finesser), `pages.json` + the WP plugin + `STATUS.md` (Controller), and the other
two chats' note files. If a spec needs one of those edited, it says so and stops.
