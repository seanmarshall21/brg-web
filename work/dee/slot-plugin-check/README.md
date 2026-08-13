# slotcheck — will the **deployed** plugin actually fill this section's tokens?

Dee's build for @conti's assignment, 2026-08-13. Throwaway staged in `work/dee/`; whether any
of it graduates into `kit/` or `.githooks/` is Conti's call and it is **not built for that** yet.

## The gap it closes

`kit/build-acf.py --check` asks whether the **repo agrees with itself**: every slot has a
`{{token}}` and every token has a slot. Both halves are files in this repo. That is a real check
and it should stay — but it can be green while the live page renders wrong, which is exactly what
happened on 2026-08-13. It has no way not to be: the plugin never reads the repo.

There are three clocks, and `--check` can only see the first:

```
  repo files          →   Netlify CDN          →   the PHP on the WP box
  (build-acf.py)          (a push + a deploy)      (a mu-plugin deploy, then a TTL)
```

`slotcheck` asks the other question: **given what the CDN serves right now, and the plugin
version that is actually on the server, does each `{{token}}` get a value — and which source
won.**

## What it reports

| Finding | Why it matters |
|---|---|
| `BROKEN` stripped token | `{{token}}` with no slot the plugin can see. `:217` deletes it. **Silent and destructive** — the page loses copy and nothing errors. |
| `BROKEN` literal token | Token-shaped text outside the strip regex `/{{[a-z0-9_]+}}/` — almost always a hyphen. Neither filled nor stripped, so it **renders literally on the live page**. |
| `BROKEN` version-blind | `slots.json` is served but the deployed plugin predates 2.6.0. This is the regression: delete the inline block and every token strips. |
| `INERT` slot | Slot with no token. WordPress shows the field, an editor types, nothing changes. |
| `WARN` no fallback | `slots.json` is the only source and the inline block is gone — see below. |
| `WARN` bad key | Slot key outside `[a-z0-9_]+`; the generated ACF field name inherits it. |
| every section | **which source won** — `slots.json`, `sections.json (inline)`, or nowhere. |

## Running it

```bash
node work/dee/slot-plugin-check/slotcheck.mjs                    # live CDN, version auto-detected
node work/dee/slot-plugin-check/slotcheck.mjs community-partner  # one section
node work/dee/slot-plugin-check/slotcheck.mjs --plugin=2.5.0     # simulate the old fill
node work/dee/slot-plugin-check/slotcheck.mjs --from=fixtures    # prove the detector detects
node work/dee/slot-plugin-check/slotcheck.mjs --drift            # repo vs CDN
node work/dee/slot-plugin-check/slotcheck.mjs --selftest         # is this mirror still true?
```

Exit `0` = nothing found, `1` = a `BROKEN`/`INERT` finding, `2` = the tool itself failed.
A `WARN` does not fail — a warning that fails a gate just teaches everyone `--no-verify`.

## Three things worth knowing before trusting it

**1. The deployed version is measured, not assumed.** It is not the repo's `VCC_VERSION` — the
repo was ahead of the server for all of 2026-08-12 (repo 2.5.0, live 2.4.0), which is the
condition that makes this whole class of bug possible. Without the site gate password the only
non-guess evidence available to a chat is the deploy Action, which SSHes back in after the copy
and greps `VCC_VERSION` out of the file that landed. `--plugin=auto` reads that grep. If `gh`
is unavailable it falls back to the repo value and **says loudly that it is now guessing**.

**2. It mirrors someone else's PHP, so it can rot — and `--selftest` is the answer to that.**
A simulator of `vcc_fill_slots()` goes stale the moment Conti edits it, and it goes stale
*silently*, which is the exact failure this tool exists to catch. It would be indefensible not
to guard it. `--selftest` asserts the six behaviours the simulation depends on directly against
`vc-clients-embed.php` — the slots.json path, the `_`-prefix skip, the empty-not-absent fallback
guard, the hyphen-less strip regex, `vcc_fetch`'s non-200 handling, and the flat-key
`str_replace`. If any stops matching, it fails instead of quietly lying. **Run `--selftest`
after any plugin change.**

**3. What it still cannot see.** Honest limits, because a check trusted past its evidence is how
we got here:

- **ACF option values.** The fill is `attr > ACF option > default` (`:194-206`). This tool has no
  WordPress, so it reports the **default** path — the state a page is in before anyone edits it
  in wp-admin. A section can be clean here and still show wrong copy because someone typed it.
- **WordPress's transient cache.** `vcc_fetch` caches for the TTL and keeps a week-long `_stale`
  copy. What the CDN serves now is the steady state, not necessarily this minute's render.
- **Byte-level render parity.** Escaping (`esc_html`/`esc_url`/`wp_kses_post`) decides whether a
  fill is byte-identical to the copy it replaces. That is @finn's `compose.mjs` and this tool
  deliberately does not duplicate it — see the note on overlap below.
- **Whether the copy is any good.** Structural only. `XX` passes.

## Relationship to `notes/finesser/compose.mjs` — one mirror, imported

**Resolved 2026-08-13.** This originally duplicated the source-resolution branch, and that was
raised rather than left to be discovered: two mirrors of one PHP function drift, and drifting
silently is the theme of the whole exercise. @finn took the option of exporting the primitives
(`compose.mjs` `6aa0722`), so `slotcheck` now **imports `slotsFor` rather than copying it**.

The split:

| | owns |
|---|---|
| `compose.mjs` (@finn) | **what a section's slots are** — the mirror of `vcc_fill_slots()`'s lookup — and byte-faithful rendering, which is why the escaping lives there |
| `slotcheck` (dee) | **at what plugin version, from which source, and is that a problem** — the structural verdicts, the version gate, and the origin resolver |

The version gate is expressed as Finn's `mode` (`'local'` prefers `slots.json`; anything else is
inline-only, which is exactly a pre-2.6.0 plugin) rather than as a fork of his branch. `read` is
injected so the same resolution runs against the CDN, the repo, or the fixtures. And `source` is
**derived from what `slotsFor` actually returned**, by comparing it against the candidates —
never decided a second time, so this file cannot disagree with the resolution it is describing.

The exchange paid for itself immediately: Finn's mirror turned out to be wrong in the way the
tool predicted — `slotsFor()` returned `{}` on a parse-success-but-empty-after-`_`-filtering file
instead of falling through, diverging from PHP's `if ( ! $slots && … )` at `:182`. Found by the
tool built to find exactly that, in the reference implementation, on day one.

**The grammar is imported too** (`TOKEN_ANY`, `TOKEN_GRAMMAR`, `compose.mjs` `a52675f`) — but
**not trusted**, and that distinction earned itself within the hour.

`TOKEN_ANY()` is a factory because a `/g` regex carries `lastIndex` between calls. The looseness
is load-bearing: **ANY matches what a human can type, GRAMMAR matches what the plugin can see,
and the gap between them is the bug class.** They are tested against each other, never assumed to
agree — the moment they agree, the hyphen case goes invisible again.

**The grammar is now version-dependent, so a single constant cannot express it.** v2.6.1
(`04a03a8`) widened the plugin's strip class to `[a-z0-9_-]`, which *inverts the symptom* of the
same typo:

| deployed | `{{cta-label}}` undeclared |
|---|---|
| ≤ 2.6.0 | outside the strip class → **renders literally** on the page (visible) |
| ≥ 2.6.1 | inside it → **stripped** (silent copy loss) |

So `grammarFor(version)` derives it here, and `--selftest` checks that derivation against the
class lifted out of the plugin's own `preg_replace` — behaviourally, on probes chosen to straddle
the boundary, not by string comparison. Finn's `TOKEN_GRAMMAR` is reported **separately** as
`DRIFT` rather than as a failure: it is accurately the pre-2.6.1 form, which is exactly what
`grammarFor` uses for that branch, so it is still doing real work. That comparison is what caught
the drift — see FINDINGS.
