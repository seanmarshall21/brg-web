# brg-web — instructions for any Claude chat working in this repo

Read `MANIFESTO.md` (how the chats work), `STATUS.md` (where the project is), and
`notes/roundtable.md` (what's live between us), and **your queue on the Atlas board** before acting.

## First: know which clone you're in

Every chat gets its own clone, and each clone is labelled in its own git config. **Verify your
identity from git config — never infer it from the working directory or the branch name.** A
path can be renamed and a branch can be anything; `fc.chat` is the fact.

```bash
git rev-parse --git-common-dir     # . = a normal clone; a path ending /.git of ANOTHER repo = you're in a worktree
git config fc.chat                 # who you are: conti | finn | (empty = unconfigured)
git config core.hooksPath          # must be .githooks — empty means the guard is not installed
```

Read that as:
- **`fc.chat` empty** → this clone isn't set up. Run `./.githooks/install.sh <chat> warn`.
  Until you do, the territory hook is inert and nothing is protecting the other chat's files.
- **`core.hooksPath` not `.githooks`** → same, the hooks aren't wired. Re-run `install.sh`.
- **`--git-common-dir` pointing into another repo** → you're in a *worktree*, not a clone. Say
  so before committing: worktrees share one git config, so `fc.chat` may describe a different
  chat than the one you are.

## The board is in Atlas, not in this repo

**What's next, who's blocked, what shipped → the Atlas board**, project `brg-web`. Read it before
you start anything and work the order it returns; that order is Sean's answer to "what next", so
don't ask him and don't reorder it.

```bash
curl -s -X POST localhost:8000/queue -H 'Content-Type: application/json' \
  -d '{"project":"brg-web","owner":"<your seat name>"}'
```

Set `building` when you start, `shipped` when it is live **and verified**, `blocked` with
`waiting_on` when you are stuck — `waiting_on` puts that person on Sean's status board holding
your item, which is how he learns he is blocking you without being interrupted. Vocabulary is
fixed: `idea · designing · building · blocked · almost · package · shipped · parked`. Full
contract in `~/atlas/docs/QUEUE.md`.

**Known gap (2026-08-13):** `/queue` filtered by `owner` returns **0** for items filed under a
`path`, because it reads root-level items only. Your items are still there and correct — fetch
them with `/item` by id, or read the tree with `/explorer`. Don't conclude your queue is empty.

*(`notes/tasks.json` is retired. It duplicated the board and drifted from it inside a day —
calling the monoliths "blocked" hours after they were deleted.)*

## Territory

One owner per file, listed in `.githooks/territory.tsv`. **Read anything, write only yours.**
`.githooks/pre-commit` warns (or blocks, per `git config fc.enforce`) on a staged file owned by
someone else.

Need a change outside your territory? Ask the owner in `notes/roundtable.md`, or put it on the
Atlas board with `owner` set to them. Genuine emergency: say what you're doing out loud, then
`FC_ALLOW_CROSS=1 git commit …`.

## Committing

```bash
git pull                                    # rebase; install.sh sets pull.rebase true
git add <your explicit pathspec>            # never `git add -A`, never `git add notes/`
git commit                                  # pre-commit checks territory
git push origin HEAD:main                   # pre-push runs kit --check, node --check, php -l
```

End every commit message with:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Join Atlas first — one call, and it tells you what's left

```bash
curl -s -X POST localhost:8000/join -H 'Content-Type: application/json' \
  -d '{"cwd":"/Users/seanmarshall/Documents/GitHub/brg-web","name":"<your seat name>"}'
```

It registers you, returns your `@handle`, and reports each system as `done: true/false` with what
to do next. **Call it at the start of every session** — it is idempotent and it is how you find
out about anything added since. Skip whatever reads `done: true`.

**Pass the CLONE path, not `$(pwd)`.** A seat running inside a git worktree resolves to a project
named after the worktree — *"not a build yet"* — and files everything into a junk project. Verify
with `resolved_by`: it should read *folder name matched a build*.

**Your registered name is canonical.** It keys the board, the `@handle` and your queue items. If
it differs from what you have been posting in the channel, **post once under the registered name
saying it is the same seat** — the rule against renaming exists because a silent rename fragments
your history, and the fix for an unavoidable one is to announce it. (Conti posted as
"Conti (BRG Controller)" before `/join` existed and reconciled to "Conti" this way.)

## The channel — Sean watches here, so post here

There is a live feed in Atlas. **Project slug: `brg-web`** — lowercase, never a display label.
Full doc: `~/atlas/docs/CHANNEL.md`. Two loopback calls, no token (you are a process on his Mac):

```bash
curl -s -X POST localhost:8000/channel-say -H 'Content-Type: application/json' \
  -d '{"project":"brg-web","from":"<your seat name>","kind":"done","text":"..."}'
curl -s -X POST localhost:8000/channel-read -H 'Content-Type: application/json' \
  -d '{"project":"brg-web","limit":30}'
```

**Post yourself in when you start.** Until a seat posts, Sean cannot tag it from his phone.

**Use your seat's existing name exactly — never invent a new one.** The `from` field is how Sean
recognises you, and a seat that renames itself fragments its own history in the feed.

**Read it from the feed rather than from this file** — a hand-kept list of names is a copy, and
copies rot:

```bash
curl -s -X POST localhost:8000/channel-read -H 'Content-Type: application/json' \
  -d '{"project":"brg-web","limit":50}' | python3 -c \
  "import json,sys; print(sorted({m['from'] for m in json.load(sys.stdin)['messages']}))"
```

If your seat is in that list, use that string verbatim. If it isn't, you're first — pick a name
Sean would recognise and keep it forever. The same call with `project` omitted returns every
room, which is how you verify the slug rather than trusting this file for that either.

- `kind`: `note` (default) · `done` · `blocked` · `question`.
- **`needs_you:true` pushes to his phone.** Only when you are genuinely stopped and *only he* can
  unstick you. Never to announce you finished, and never to say you are waiting on a pause **he**
  chose — that is how the alert that matters gets missed.
- **An `@` in your text does nothing.** He can tag; you cannot. `/chat-ask` is the real mechanism
  and it is hop-limited (two passes) and rate-limited (12 per project per 15 min, rejects count).
- It is **what a colleague would say out loud, not a log.** Something landed, you are blocked, or
  you are starting something big enough that a parallel seat shouldn't duplicate it.

**Chat-to-chat working detail stays on direct messages** — no hop limit, and it is what has caught
most of our real errors. The channel is for Sean's visibility, not for the argument.

## The disclosure guard — the one check that never warns

`pre-commit` refuses (never warns, and **`FC_ALLOW_CROSS` does not bypass it**) any staged file
that is new at the repo root, or that looks like a captured WordPress page outside `website/`.

It exists because on 2026-08-13 a `cd` failed silently, a scratch run wrote a dump of the **live
password-gated page** into the clone, and nothing structural would have stopped it: the `git add -A`
ban lives in this file and relies on recall, and the territory hook only checks *ownership* — an
untracked file in your own territory passes cleanly.

**Every other check here is about a wrong answer, which can be corrected. This one is about a
disclosure, which cannot.** Scratch output belongs outside the repo entirely; this repo publishes
to a public CDN.

## Verify the write landed — a success message is not evidence

A chat session's shell cwd can drift into a **worktree** of its own clone between calls. When it
does, a write can silently no-op — the anchor text doesn't exist on that older commit — while the
tool still reports success. It printed "logged" and committed nothing. Before trusting an edit:
assert the anchor exists, use absolute paths, and check `git status` in the tree you meant.

**The drift happens BETWEEN calls, so a `cd` at the top of one command does not protect the calls
after it.** Only absolute paths do. And **the `kit/` generators are the dangerous case, because
they write** — a drifted invocation produces generated output from a stale tree's inputs and
leaves both trees clean and self-consistent, so nothing looks wrong afterwards. They now refuse
to run outside the clone (`kit/_guard.py`, override `BRG_ALLOW_WORKTREE=1`); that guard exists
because this happened ten times in one day and was caught by luck the tenth.

This generalises past the cwd case, and it was the most common failure of 2026-08-13: **the thing
that reports success is not the thing that did the work.** A green check, a "composed" line, a
clean diff — each is a claim about the work, and claims go stale. See `kit/README.md`,
"If a claim matters, make something run it".

## Things that will bite you

- **`SHORTCODES.md` and `docs/shortcode-index.html` are generated.** Edit `kit/registry.json`,
  then run `python3 kit/build.py` in the same commit. `--check` runs on push.
- **Netlify deploy ≠ WordPress plugin update.** Pushing updates the CDN fragments. The PHP in
  `website/wp-mu-plugin/` reaches the site only via the deploy Action or a manual drop.
- **The plugin inlines `brgw.css`/`brgw.js` into the WP page.** Asset URLs inside fragments must
  be absolute CDN URLs, and a JS syntax error takes down the page, not just the script.
- **One reveal engine.** `brgw.js` self-inits every `.brgw` root. Never add a second init script
  or a parallel slider.
- **Clones must live on local disk** — never Dropbox/iCloud/Google Drive/OneDrive. Sync daemons
  corrupt `.git`, and it surfaces long after the damage.
- **Don't put the site gate password in the repo.** Sean supplies it per chat when a live check
  needs it.
