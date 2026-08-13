# PREPARED CHANGE — point `careers-posts`' two `View job` links at the LinkedIn jobs page

**Status: PAUSED BY SEAN, PREPARED AND READY.** *"Let's pause on the jobs links. Just prepare it
so that we can do that when we are ready."* Nothing here has been applied. `careers-posts` is
live and unchanged: both `/careers/` self-links and both stamps stay until Sean says go.

**Owner of the destination: @finn** (`website/sections/` is his). Dum prepared it; Finn applies it
in his own clone under his own review. See `FINDINGS.md` for the evidence behind it.

**This is change 1 of 2, and it is deliberately standalone** — see §5.

---

## 1. Run it

```bash
./work/dum/careers-posts-urls/apply.sh
```

From the repo root, in Finn's clone. It asserts every precondition in §2 first and **refuses
rather than half-applying** if any fails; it changes nothing else, stages nothing, and commits
nothing. Re-running after a successful apply is a no-op, so it's safe to run twice.

Prefer to do it by hand? The whole change is one exact string, appearing **twice**, replaced
identically both times:

```
FIND  (×2, exact, leading whitespace included)
        <a class="view" href="/careers/">View job</a>

REPLACE
        <a class="view" href="https://www.linkedin.com/company/blacktop-restaurant-group/jobs/" target="_blank" rel="noopener">View job</a>
```

**Anchored on the string, not on line numbers,** so it survives anything moving above it. At the
baseline below those were lines 63 and 78 — recorded as a cross-check, not as the locator.

## 2. Preconditions the script asserts (and why each one exists)

| # | Assertion | Why it can fail, and what it means if it does |
|---|---|---|
| 1 | Exactly **2** occurrences of the FIND string | Finn edited the cards, or added/removed one. **Stop and re-read the section** — the change is still probably right, but "2" is what makes a blind replace-all safe. |
| 2 | The file contains **zero `{{`** | **The likely one.** ACF wiring is sweeping through `website/sections/` right now — three sections got a `slots.json` on 2026-08-13 alone. If `careers-posts` has been wired since, the `href` may now be a slot, and **the fix moves out of the fragment into `slots.json`** — a different change with a different owner path and a priming rule attached. Do not force this patch onto a wired file. |
| 3 | **No `slots.json`** in the section dir | Same cause as #2, caught from the other side. |
| 4 | No `target="_blank"` already in the file | Idempotency — someone already applied it. |
| 5 | `git status` clean for that one file | So the resulting diff is unambiguously this change. |

**Baseline this was verified against — quote these when checking drift:**

| | |
|---|---|
| Repo HEAD at preparation | `c8046f5` |
| `embed.html` blob hash | `b1bb10b072f1a8eb7a4ef842203222d1be55e699` |
| Last commit touching the section | `8c9d4ff` ("Build careers-posts — 18/18 sections complete") |

If the blob hash still matches at apply time, nothing has drifted and §2 is a formality.

## 3. `target="_blank" rel="noopener"` — decided, not flagged

I left this open as Finn's call in my first pass, which would have turned the go-ahead into
another round trip. **Closed: write it in.** @conti ruled it the house pattern, and I checked the
claim rather than taking it — it's stronger than stated:

- `our-restaurants-brands/embed.html:41` and `:54` (the Visit Us buttons) use exactly
  `target="_blank" rel="noopener"`.
- Those are the **only** two `target="_blank"` in all of `website/sections/`, and there are
  **zero** external `href="http…"` links anywhere in `website/sections/` that lack it.

So it isn't merely *a* precedent — it's every external link in the section tree, unanimously.
This link is the third. **@finn can still override when applying**; it's his file, and this is
recorded so the decision doesn't have to be made twice.

## 4. Re-verify at apply time — and note *what* actually needs re-verifying

A link verified a week ago is a claim, and claims go stale. But the two halves have different
consequences, and only one of them blocks:

**(a) Blocks the patch — does the URL still work?** Re-fetch
`https://www.linkedin.com/company/blacktop-restaurant-group/jobs/` and confirm it resolves **and
renders openings to a logged-out visitor**. That second half is the one that matters: a link
dead-ending at a login wall would be no better than the `/careers/` self-link it replaces. If
this fails, **do not apply.**

**(b) Does NOT block the patch — are the two named roles still open?** Worth checking, but a
closed role is *not* a reason to hold the link. **The whole virtue of the company jobs URL is
that it stays correct when individual roles churn** — that's the argument in `FINDINGS.md` §1.
If either role has closed, the link is still right; what's now wrong is the **card copy**, which
names those roles in its body text. That's a separate content problem for Sean, and it does not
travel with this patch.

I'm deliberately not re-verifying now — it would only have to be redone. The check belongs at
apply time.

## 5. Keep this separable from the stamp deletion

Sean paused **both** the jobs links and the `834 followers` / `2mo` / `5mo` stamps without ruling
on either individually. They are different decisions:

- **This patch** fixes a **live dead control** — a button that navigates to the page it's already
  on. That's a defect, and it's the half with an argument behind it.
- **The stamp deletion** is a content/design judgement (Expo's SPEC-007 §4 recommends deleting;
  `FINDINGS.md` §3 supplies the evidence that the follower count can't be verified at all).

**Nothing in this folder touches the stamps**, on purpose — so a "yes" to one can't drag the
other along, and neither can only be taken whole. The stamp change isn't prepared here because it
wasn't asked for; say the word and it's a few minutes, and it stays a separate file when it is.

## 6. After applying

Not mine to do, listed so nothing is missed:

- **Update the header comment at the top of the fragment.** It currently reads *"The 'View job'
  links point at /careers/ until the real LinkedIn job URLs are supplied."* Left as-is, the
  company link reads as an unfinished placeholder and someone later "fixes" it into per-post
  URLs — which `FINDINGS.md` §2 argues against on evidence. Suggested replacement:

  > · The "View job" links point at BRG's LinkedIn **company jobs page**, deliberately — it stays
  >   correct as individual postings open and close. Per-post URLs were ruled out on 2026-08-13;
  >   see `work/dum/careers-posts-urls/FINDINGS.md`.

- **No ACF interaction, no priming.** Section has no `slots.json` and no `{{tokens}}`, so the
  `vcc_fetch` `_stale` priming rule does not apply here.
- **Netlify deploy is enough.** Fragment-only change; no plugin version bump, no Action, no
  wp-admin step.
- **Verify live behind the gate:** both `View job` buttons open the LinkedIn jobs page in a new
  tab, and neither navigates to `/careers/`.
