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

After one successful plugin fetch, `_stale` covers it for a week and the risk effectively ends.

**The thing I cannot measure, and it is the thing that matters:** a `curl` from this chat does
**not** warm WordPress's transient. Only a real page render does. So "the CDN serves it fine",
which is all I can prove, is not the same as "`_stale` is now populated". Confirming that needs
one gated page load, which needs the site password — Sean's, not mine.

**Concretely:** load `/community/` behind the gate once. If the black band reads *"Want to
partner with us?"* → the mailto, `slots.json` fired and `_stale` is now written. If it reads
*"Get in touch"* → `/contact/`, the fallback fired — except the fallback no longer exists, so
what you would actually see is the empty band. @finn already identified that CTA as the free
discriminator; this is the same test, one step later in the sequence.

## Two traps the checker found that nothing else was looking for

Neither is live today. Both are one typo away, and both are silent.

**1. A hyphen in a token is a different bug from a missing slot.** The strip regex is
`/\{\{[a-z0-9_]+\}\}/i` — **no hyphen in the character class.** So `{{cta_label}}` with no slot is
*deleted* (copy vanishes), but `{{cta-label}}` with no slot is *neither filled nor deleted* — it
**renders literally on the live page** as `{{cta-label}}`. Same typo class, opposite symptom, and
the second one is the kind of thing that ends up in a screenshot. Fixture: `hyphen-token`.

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

The sharpest proof is the regression itself. **Identical files, only the version changed:**

```
$ node slotcheck.mjs --from=fixtures --plugin=2.6.0 ok-wired
  ok-wired   slots from slots.json · 2/2 filled   ok

$ node slotcheck.mjs --from=fixtures --plugin=2.5.0 ok-wired
  ok-wired   slots from nowhere · 0/0 filled
    BROKEN {{heading}} {{sub}} — the plugin DELETES this copy on render
    BROKEN slots.json is served but the DEPLOYED plugin (2.5.0) reads only the inline block
```

That is the bug that shipped, reproduced from the version number alone. It is also the case
`build-acf.py --check` cannot reach in principle, because nothing about it is visible in the repo.
