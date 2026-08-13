# What slotcheck says today — 2026-08-13, Dee

Measured against the **live CDN** at plugin **2.6.0**, confirmed on the server by deploy Action
run `31686161607` (its verify step greps `VCC_VERSION', '2.6.0'` out of the deployed file).

```
18 sections · 17 clean · 1 with a finding · 0 BROKEN · 0 INERT
community-partner   slots from slots.json · 3/3 filled   WARN no fallback
```

**The ACF chain is working.** `community-partner` resolves its three slots from
`sections/<id>/slots.json`, all three tokens fill, the `_note` key is correctly ignored, and
`--drift` shows repo and CDN agreeing on every fragment and every `slots.json`. `build-acf.py
--check` is green and this agrees with it. The other 17 sections have no tokens and no slot
source, which is the expected state — they are the 14 singular wirings still to come.

## The one finding, and it is a real one

**`community-partner` now has no fallback.** Step 3 deleted the inline block, so `slots.json` is
the only source. That is the intended end state and I am not arguing against it — but it changes
the failure mode, and the change is worth being explicit about because @finn had already flagged
the same mechanism from the other direction:

`vcc_fetch` (`:79-86`) caches **nothing** on failure — good, there is no stale-empty window — but
it writes its week-long `_stale` copy **only after a successful fetch** (`:85`). So until the
**plugin itself** has fetched `slots.json` successfully once, there is no safety net: a transient
CDN blip returns `''`, `$slots` stays empty, the fallback that used to catch it is gone, and
`:217` strips all three tokens. The band renders with an **empty button and an empty line of
copy** — silently, and it would stay that way until the next successful fetch.

After one successful fetch, `_stale` covers it for a week and the risk effectively ends.

### CORRECTED 2026-08-13 — both live sections are already primed

The first version of this file said *"a `curl` from this chat does not warm WordPress's
transient — only a real page render does"*, and concluded both sections were exposed pending a
load only Sean could do. **The first half was wrong and the conclusion with it.** It conflated
curling the **CDN** (`blacktoprg.netlify.app/...`), which warms nothing, with curling the
**WordPress page** (`blacktoprestaurantgroup.com/community/`), which is a real render:
WordPress renders server-side, the plugin runs, `vcc_fill_slots()` calls `vcc_fetch()`, and the
success path writes `_stale`. Nothing on that path is client-side, so curl is as good as a
browser. Corrected by @conti, who had already primed both sections that way and supplied the
renders rather than asserting it.

I checked the inference rather than taking it, since it is the load-bearing part — **it holds,
by all three paths that can produce a filled render:**

1. **Fresh successful fetch** → writes the primary transient *and* `_stale` together (`:84-85`).
2. **Primary-transient hit** → returns early at `:77` without touching `_stale`, so this render
   does not write it. But that transient is at most **`VCC_TTL` = 120 seconds** old (`:36`), and
   the write that created it wrote `_stale` in the same call. 120s against a one-week `_stale`
   means the primary can never outlive it — the gap I was looking for cannot open.
3. **Failure path** → `:80` can only return `_stale` *by reading it*, so a filled render on this
   path proves `_stale` exists outright.

So a filled render is itself the proof. @conti's two renders — `community-partner`'s CTA
resolving to *"Want to partner with us?"* → the mailto, and `community-stats` showing `12` + three
`XX` with **zero leftover `{{`** — could only come from having successfully fetched each
`slots.json`. **Both sections have their week-long net. Neither is exposed, and no gated load is
outstanding.**

**What survives, and it is the more useful half:** the *mechanism* and the fact that this is now
the **standing shape**. Zero of 18 sections carry an inline block, so every remaining wiring
lands with no fallback until its first successful render. @conti has taken that as a standing
rule — Finn ships a section, Conti does a gated render before it counts as safe — and it is in
`kit/README.md`.

**What this tool still cannot see:** it reads the CDN, so it can tell you a section *has* no
fallback, but never whether priming has happened. That lives in WordPress's transients. The
`WARN` is therefore a prompt to check the rendered page, not a claim that the section is exposed.

## The selftest caught a live mirror drift — 2026-08-13, within the hour

**This is the tool doing the job it was built for, on the reference implementations rather than
on a section.** Importing @finn's `TOKEN_GRAMMAR` and *checking it against the plugin* rather
than trusting it immediately surfaced a real divergence:

@conti shipped **v2.6.1** (`04a03a8`), widening the strip class from `[a-z0-9_]` to
`[a-z0-9_-]` — deliberately, so a hyphen typo is *seen and stripped* rather than displayed. Three
of the four layers moved with it:

| layer | class | state |
|---|---|---|
| plugin `:224` | `[a-z0-9_-]` | updated |
| `kit/build-acf.py:108` | `[a-z0-9_-]` | updated |
| `compose.mjs` `TOKEN_GRAMMAR` | `[a-z0-9_]` | **stale** |
| `slotcheck` | derived per version | now correct |

**And 2.6.1 is deployed** — Action run `31688155274`, verified on the server. So this is live
behaviour, not a repo-only difference.

**The consequence is that the grammar is now version-dependent, which a single constant cannot
express.** The same typo has opposite symptoms either side of the boundary:

```
$ node slotcheck.mjs --from=fixtures --plugin=2.6.0 hyphen-token
    BROKEN {{cta-label}} — falls outside the strip class ^[a-z0-9_]+$ … renders LITERALLY

$ node slotcheck.mjs --from=fixtures --plugin=2.6.1 hyphen-token
    BROKEN {{cta-label}} — declared by no slot the plugin can see, so the plugin DELETES this copy
```

Fixed here by deriving the grammar from the version (`grammarFor`) and having `--selftest` check
that derivation **behaviourally** against the class lifted out of the plugin's own `preg_replace`.
Reported to @finn; his constant is flagged as `DRIFT` rather than as a failure, because it is
accurately the pre-2.6.1 form and that is precisely what `grammarFor` uses for that branch.

Worth noting what this cost: **nothing.** The check was already written, and it fired on a change
made by someone else, in someone else's file, minutes after they made it. That is the argument
for a mirror that can tell you it has drifted.

Live impact today: **none.** No section on the CDN has a hyphenated or whitespaced token —
`--json` reports zero `literal` and zero `stripped` across all 18.

## Two traps the checker found that nothing else was looking for

Neither is live today. Both are one typo away, and both are silent.

**1. A token can fall outside what the plugin's strip can see, and then it renders literally.**
*(Rewritten — the original text used the hyphen as the example, and v2.6.1 inverted exactly that
case four hours later. Left as a marker of how fast this rots: the trap is real, the example
moved.)*

The strip is `preg_replace('/\{\{[<class>]+\}\}/i', …)`, so an undeclared token is **deleted** if
its name is inside `<class>` and **survives onto the page** if it is not. Two opposite symptoms
from one slip, and `--check` is blind to both.

Which side a hyphen lands on is **version-dependent**, which is the part worth carrying:

| deployed | `{{cta-label}}` undeclared | `{{bad.name}}` undeclared |
|---|---|---|
| ≤ 2.6.0 | renders literally | renders literally |
| ≥ 2.6.1 | **stripped** — copy vanishes silently | renders literally |

So at the version actually deployed today, the remaining "renders literally" cases are tokens
with whitespace or punctuation inside the braces — `{{ heading }}`, `{{bad.name}}`. Fixtures:
`hyphen-token` (flips symptom across the boundary — run it at both versions) and `spaced-token`
(literal at every version, since whitespace is in no strip class).

**2. `slots.json` can exist, parse, and still hand over nothing.** The fallback at `:182` is
`if ( ! $slots && … )` — it triggers on **emptiness, not absence**. A `slots.json` containing only
`_`-prefixed documentation keys leaves `$slots` empty, so the plugin silently falls back to the
inline block, and the file that looks like the source is not the source. Fixture:
`doc-keys-only`. Worth knowing before someone writes a `slots.json` that is all `_note` while
drafting.

Also noted, lower stakes: a slot key outside `[a-z0-9_]+` still fills its token via `str_replace`
but the generated ACF field name `brg_<id>_<key>` inherits the odd character (fixture:
`bad-key`); and a `slots.json` that is a JSON **array** rather than an object passes PHP's
`is_array()` and yields slots named `0`, `1`, `2`.

## How the tool was proven

Zero real sections had a token when I started, so there was no live positive case to test
against — the checker would have reported "all clean" whether or not it worked. So it is proven
against seven synthetic sections in `fixtures/`, one per failure mode: 3 clean, 4 with findings,
each firing exactly the finding it was built to trigger and nothing else.

The sharpest proof is the regression itself. **Identical files, only the version changed** — and
it reproduces in both of its shapes, which turn out to be different problems:

```
$ node slotcheck.mjs --from=fixtures --plugin=2.6.0 ok-wired
  ok-wired   slots from slots.json · 2/2 filled   ok

$ node slotcheck.mjs --from=fixtures --plugin=2.5.0 ok-wired
  ok-wired   slots from sections.json (inline) · 2/2 filled
    BROKEN slots.json is served but the DEPLOYED plugin (2.5.0) reads only the inline block
```

**That is the dangerous shape, and it is dangerous precisely because it looks fine.** The section
still fills 2/2 — from the *inline* block, silently, while the `slots.json` someone just wrote is
ignored. Nothing about the render says so. It is one `sections.json` deletion away from blank,
and that deletion is step 3 of the standard wiring order. This is why the tool reports the
resolved source for every section rather than only for broken ones.

Remove the inline block and the same version shows the shape that actually shipped:

```
$ node slotcheck.mjs --from=fixtures --plugin=2.5.0 orphan-token
  orphan-token   slots from nowhere · 0/0 filled
    BROKEN {{heading}} {{never_declared}} — the plugin DELETES this copy on render
    BROKEN slots.json is served but the DEPLOYED plugin (2.5.0) reads only the inline block
```

Both are reproduced from the version number alone, and both are cases `build-acf.py --check`
cannot reach in principle — nothing about either is visible in the repo.
