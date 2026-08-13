# Notes — DEE (side tasks / prep)

**Single writer: the Dee chat only.** Others READ this; they write their own `notes/*.md`.
Newest first. Format: `TYPE: <YYYY-MM-DD> · note`  (TYPE = DONE / PLAN / NEED / QUESTION).

You own `notes/dee.md` and `work/dee/` — nothing in production. Build in `work/dee/`, then hand
finished work to whoever owns the destination via `notes/roundtable.md`; **they** promote it.
See [`work/README.md`](../work/README.md) for why it works that way.

---

DONE: 2026-08-13 · **Dee's seat is live.** Clone verified from git config, not from the path:
`fc.chat=dee`, `core.hooksPath=.githooks`, `fc.enforce=warn`, `--git-common-dir` = `.git` (a real
clone, not a worktree). On local disk — `~/Documents` resolves to itself, no `CloudStorage`
redirect. Read `CLAUDE.md`, `MANIFESTO.md`, `STATUS.md`, `notes/roundtable.md`,
`notes/tasks.json`, `work/README.md`, `HANDOFF.md`. `work/dee/` is empty apart from `.gitkeep`,
and no board task is owned by `dee`, so I'm idle and waiting on an assignment.

DONE: 2026-08-13 · **Tested the territory guard rather than trusting the config.** Staged a new
file at `kit/.dee-guard-test` (conti's), ran `.githooks/pre-commit` directly, and it named the
file, the owner and the matching rule (`kit/`), then exited 0 with `(warn mode — commit
proceeding)`. Unstaged and deleted it; nothing committed, tree clean. So the guard is wired and
it is genuinely advisory right now — `territory-block-mode` is the task that closes that, and it
wants all clones flipped together.

NEED: 2026-08-13 · **The chat session driving this clone runs from a `git worktree` of it, not
from the clone itself.** Session cwd is
`~/Documents/Claude/_Code/brg-web-dee/brg-dee-helper-setup-5678b3`, on branch
`claude/brg-dee-helper-setup-5678b3`, whose `--git-common-dir` is
`~/Documents/GitHub/brg-web-dee/.git`. Benign in itself — it's *my own* clone, so the shared
`fc.chat=dee` is telling the truth, which is exactly the case `CLAUDE.md` warns can lie. Two
things follow and they're the reason this is logged rather than shrugged off: the two trees share
one git dir, so a commit made in either is visible to both; and the worktree sits on a side branch
while the clone sits on `main`. **I work in the clone (`~/Documents/GitHub/brg-web-dee`, on
`main`) and push `HEAD:main` from there** — the worktree is left alone. Saying it out loud per
`CLAUDE.md` so nobody later reads a commit from this seat and wonders which tree it came from.
