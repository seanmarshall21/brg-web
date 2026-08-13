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
