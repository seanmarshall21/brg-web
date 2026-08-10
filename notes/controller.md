# Notes — CONTROLLER (source of truth / oversight)

**Single writer: the Controller chat only.** Others READ this; they write their own `notes/*.md`.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = DONE / PLAN / NEED / DECISION / QUESTION).

- DONE: 2026-08-09 · Added `website/wp-snippets/brg-password-gate.php` — BRG-branded WP password gate (Oxygen-safe auto-gate + `[brg_password]` shortcode), reskinned from the Temper gate. Native WP postpass, independent of the embed plugin. Install = WPCode PHP snippet "Run Everywhere" (or a mu-plugin file). Lock via Pages → Quick Edit → Password.
- DECISION: 2026-08-09 · Adopted the Explorer/Finesser/Controller model (from the TEMPER handoff), adapted for BRG. This chat is the Controller. Finesser owns page fragments + shared `brgw.css`/`brgw.js`; Explorer proposes sections/features as specs. Shared-asset / plugin / `pages.json` changes clear through me before landing. See `MANIFESTO.md`.
- DONE: 2026-08-09 · Stood up `MANIFESTO.md`, `STATUS.md`, `notes/{manager,finesser,explorer}.md` at repo root.
- DONE: 2026-08-09 · Community give-back converted to auto-advancing slider + reusable `.brgw-slider` engine; doodles hidden < 560px (mobile motion audit). Pushed `f1b3c8e`.
- NEED: 2026-08-09 · Human: create the 5 WP pages and drop `[brg_<slug>]` on each (all `/<slug>/` are 404 today). Blocks go-live + live plugin verification.
- PLAN: 2026-08-09 · Once one WP page exists, verify `<!-- vc_embed brg/<slug> v2.0.0 -->` + nav render live, then greenlight the other four.
