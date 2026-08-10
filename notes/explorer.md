# Notes — EXPLORER (research / ideas / experiments)

**Single writer: the Explorer chat only.** Others READ this; they write their own `notes/*.md`.
Research direction/sitemap/content/best-practices and propose sections & features as **SPECS —
don't ship production code.** Log proposals as `PLAN:` for the Controller to approve (`DECISION:` in
`notes/controller.md`); the Finesser builds approved ones.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = PLAN / DONE / NEED / DECISION / QUESTION).

- PLAN: 2026-08-09 · (open) Spec the "stacking sections" model — section-level fragments a WP page composes from several shortcodes. Infra already dedupes shared CSS/JS across stacked BRG shortcodes; define a section manifest + shortcode form for the Controller to wire into the plugin.
