# SPEC-010 — A judgement expires with the thing it judged

**Status:** proposed · Explorer · 2026-08-17 · rule requested by Sean ·
**Verified against:** `f8113db`, working tree clean

---

## The rule

> **Anything that records a judgement about a mutable thing must carry the identity of what it
> judged, and must stop counting when that identity changes.**

A judgement is any recorded conclusion: an approval, a verification, a status, a check result, a
default, a pointer, a "done". The thing it judged is a file, a fragment, a number, a line, a
rendered page.

The failure is always the same shape and it is **never** an error:

- nothing throws
- nothing warns
- **the stale judgement is visually identical to a live one**

Which is why it survives. A stale approval looks exactly like an approval. A `--check` that went
green in March looks exactly like one that went green this morning.

**The corollary, and it is the actionable half:** a judgement with no identity attached cannot
expire, so it will be read as current forever. If you cannot say *what* a verification was
against, it is not a verification — it is a memory.

## Why it keeps recurring here

Four instances in one day, in four costumes, none of which erred:

| What | The judgement | What moved under it |
|---|---|---|
| `community-stats` | `12` was "already true" ([SPEC-007](content-gaps.md)) | It was Board & Brew's count, presented as the group's |
| [SPEC-006 §3](contact-page.md) | "`/contact/` is a 404 with a timer on it" | It had been fixed incidentally; the spec argued for a hazard that no longer existed |
| [SPEC-003](hand-drawn-lines.md) | `brgw.css:78–82` | The rule moved to `:82–86` — right claim, wrong address |
| Lab verdicts | "A5 approved" | The card was rebuilt underneath the approval |

The first three were caught **by a person reading carefully**, not by any tool. The fourth was
caught by Sean noticing the board hadn't reset. That is the whole problem: our only detector is
attention, and attention does not scale across five chats.

## We already solved this once

`kit/build.py` does exactly this and has since the start:

```
kit/build.py:28-32   contract(c) -> sha256 of the canonicalised component, 12 hex
kit/build.py:143-144 cc = contract(c); stored = c.get('contract')
--check    exit 1 if a contract moved un-bumped, or the docs are stale
--restamp  bump version + re-hash any component whose contract moved
```

Every shortcode carries `version` + `contract`. Change the contract without bumping, and the
push fails. **That is this rule, implemented, proven, and running in CI-spirit on every push.**

It is applied to **one** thing — shortcodes — and to nothing else in the repo. The mechanism is
not the hard part; noticing that everything else needs it is.

## Where it is violated today, and the fix

Ranked by value, and deliberately **not** "hash everything" — see §Cost.

### 1. Specs in `notes/explorer/` — **mine, fixed in this commit**
Every spec now carries `**Verified against:** <commit>` in its header. That is the minimum
honest form: a claim about the codebase is dated to a tree, so a reader can tell whether it has
been re-checked since. Applied to all ten.

### 2. Verification claims in `STATUS.md` — **conti**, cheap, no tooling
*"18/18 sections built and verified rendering live 2026-08-12"* names a **date** but not the
artifact. It was verified against plugin **v2.5.0**; the plugin is now v2.6.x. The claim may
still hold — but nothing in the sentence lets you tell.
**Fix:** verification lines name the version they were taken against — *"verified live against
plugin v2.5.0, 2026-08-12"*. One clause. No code.

### 3. `sections.json` `status: "live"` — **conti**, and this one is a judgement call
A status recorded once about a fragment that changes often. It has already gone stale in bulk:
eleven entries read `todo` while live, reconciled 2026-08-12.
**Fix if wanted:** stamp the fragment hash when a section is marked live; `--check` warns when a
`live` section's fragment has moved since.
**My recommendation: don't, yet.** Fragments change constantly, so this fires on every ordinary
edit, and a check that cries wolf gets muted — which is the argument Conti used to kill my
shared-facts check, and it applies to me here too. Worth it only if scoped to the parts that
make a section *renderable* (tokens, slot names), not to any byte.

### 4. `--check` green being read as "it renders" — **already caveated, keep it that way**
Finn and Conti both attached this warning to `build-acf.py --check`, and Dee attached it to
`slotcheck`. Nothing to build; the point is that the caveat is part of the judgement and must
travel with it.

## Cost, and the line I would not cross

The rule says *carry identity*, not *hash everything*. Two failure modes at the extremes:

- **No identity** → the judgement never expires, and is read as current forever. Today's default.
- **Identity on everything** → every ordinary edit invalidates a judgement, everyone re-stamps
  reflexively without re-checking, and the stamp becomes a ritual. **A judgement that is
  re-affirmed without being re-tested is worse than none**, because it now carries false
  authority *and* a fresh date.

So: stamp the judgements that would mislead someone if stale, and leave the rest alone. Of the
four instances above, only two are worth mechanising, and one of those I am arguing against.

## Applied: the first thing outside `kit/` that earns a real identity check

**`lines-centrelines.json` — done, in `notes/explorer/studies/derive-centrelines.py`.**

The derived centrelines are a judgement about ten SVGs I do not own, and **Sean is re-exporting
those SVGs right now** — *"I'm making it a little bolder."* The failure would be perfectly
invisible: the strokes still draw, just in the shape of last week's artwork.

So each entry records the sha256 of the file it came from, and `--check` exits 1 when any source
has moved. It passes the boundary test in §Cost on all three counts: **the artwork changes
rarely** (so it will not cry wolf), **the cost of staleness is high** (you ship the wrong stroke),
and **the identity is one hash** (so re-stamping means re-deriving, which is the actual work —
you cannot re-affirm it without re-doing it). That last property is the one that matters:
a stamp you can refresh without re-testing is the failure mode this rule creates.

**Made to fail on purpose before being trusted:** forged a source hash, confirmed `--check`
exits 1 naming the file and both hashes, restored. A check nobody has watched fail is an
assertion, not a check.

## Candidates I considered and did not build

- **Comp → section.** `website/mocks/` is the design source; a built section is a claim that it
  matches. Comps change rarely, so the noise would be low — but they are gitignored (107MB), so
  the hash would have to live without its file, and nothing would ever re-derive from it
  automatically. **Worth it only when Press and Contact are actually being built from `page-7.png`.**
- **Everything else.** Per §Cost, no. `sections.json` status is argued against above, and the
  live-plugin version is already covered by the deploy Action's `VCC_VERSION` grep — which is
  itself an existing instance of this rule, and worth naming as one.

## Asks

| Ask | Owner | Outcome |
|---|---|---|
| Promote the rule into `kit/README.md` | conti | ✅ **done** `ac38f45` — placed above the pointer rule as the general case both it and the blind-instrument rule are instances of |
| §2 — `STATUS.md` verification lines name the artifact | conti | ✅ **done** — two date-only claims now name plugin v2.5.0 / ACF Pro 6.8.7. **He did not quietly refresh the stale one:** it says the plugin has since moved to v2.6.x, the claim probably still holds, and it was not re-tested. That is the rule applied to itself |
| §3 — the `sections.json` stamp | conti | ❌ **not built**, agreed — it would fire on every ordinary edit |
| §1 — spec headers carry `Verified against:` | expo | ✅ done |
| The first real identity check outside `kit/` | expo | ✅ `derive-centrelines.py --check`, above |

**Conti's open flag, and he is right to leave it flagged:** nothing *enforces* the README rule or
the `STATUS.md` stamps — both are prose, which is exactly the kind of claim this rule says to make
executable. The shortcode contract hash and now the centreline check are the only two places it
actually runs. **That gap is correct rather than unfinished.** A rule that fires on every edit
gets muted; a rule people apply by hand when it matters keeps its meaning. The test for promoting
one to executable stays the same: **re-stamping must BE re-testing**, and for a prose rule it
never is.
