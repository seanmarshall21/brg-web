"""Refuse to generate from the wrong checkout.

A chat session's shell cwd can drift into a git **worktree** of its own clone between
tool calls — ten recorded instances on 2026-08-13. For a script that only *reads* that
produces a wrong answer, which is recoverable. For the generators in this directory it
is worse: they **write**, so a drifted invocation silently produces generated output
from a stale tree's inputs, and both trees end up clean and self-consistent.

That happened. It was a no-op by luck — the worktree's `website/acf/` already matched
its own stale `slots.json` — and the tell was `--check` reporting failures that had been
fixed hours earlier, which is impossible in the clone. Contradiction caught it; nothing
structural did.

The test is not "is the path `.git`" (that varies with the working directory). A worktree
is exactly the case where the per-worktree git dir differs from the shared common dir.

Override with BRG_ALLOW_WORKTREE=1 when you genuinely mean to generate in a worktree.
"""
import os
import subprocess
import sys


def _git(*args):
    return subprocess.run(
        ["git", *args], capture_output=True, text=True
    ).stdout.strip()


def refuse_if_worktree(script_name):
    if os.environ.get("BRG_ALLOW_WORKTREE") == "1":
        return
    git_dir = _git("rev-parse", "--absolute-git-dir")
    common = _git("rev-parse", "--path-format=absolute", "--git-common-dir")
    if not git_dir or not common:
        return  # not a git checkout at all — nothing to protect
    if os.path.realpath(git_dir) != os.path.realpath(common):
        sys.exit(
            "%s: refusing to run — this is a git WORKTREE, not the clone.\n"
            "  worktree git dir : %s\n"
            "  clone git dir    : %s\n"
            "\n"
            "  This script WRITES generated output. Run from a worktree and it produces\n"
            "  files from that tree's inputs, which are usually at an older commit — and\n"
            "  both trees end up clean, so nothing looks wrong afterwards.\n"
            "\n"
            "  Shell cwd drifts BETWEEN calls, so a `cd` at the top of one command does\n"
            "  not protect the calls after it. Use absolute paths, or re-run from the clone.\n"
            "  Deliberate? BRG_ALLOW_WORKTREE=1 python3 %s"
            % (script_name, git_dir, common, script_name)
        )
