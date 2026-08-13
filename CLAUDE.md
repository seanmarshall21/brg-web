# brg-web — instructions for any Claude chat working in this repo

Read `MANIFESTO.md` (how the chats work), `STATUS.md` (where the project is), and
`notes/roundtable.md` + `notes/tasks.json` (what's live between us) before acting.

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

## Territory

One owner per file, listed in `.githooks/territory.tsv`. **Read anything, write only yours.**
`.githooks/pre-commit` warns (or blocks, per `git config fc.enforce`) on a staged file owned by
someone else.

Need a change outside your territory? Ask the owner in `notes/roundtable.md`, or open a task in
`notes/tasks.json`. Genuine emergency: say what you're doing out loud, then
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

## Verify the write landed — a success message is not evidence

A chat session's shell cwd can drift into a **worktree** of its own clone between calls. When it
does, a write can silently no-op — the anchor text doesn't exist on that older commit — while the
tool still reports success. It printed "logged" and committed nothing. Before trusting an edit:
assert the anchor exists, use absolute paths, and check `git status` in the tree you meant.

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
