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

## Asks

| Ask | Owner |
|---|---|
| Promote the rule into `kit/README.md`, beside the pointer rule and the blind-instrument one | conti |
| §2 — `STATUS.md` verification lines name the version they were taken against | conti |
| §3 — decide whether the `sections.json` stamp is worth the noise (I say no, for now) | conti |
| §1 — spec headers carry `Verified against:` | **expo, done** |
