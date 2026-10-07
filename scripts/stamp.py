#!/usr/bin/env python3
"""Build stamp — the one number that says which version the live site is running.

WHY. The only version on a live page used to be VCC_VERSION, the PHP plugin's. It
moves when the PHP moves, which is rarely; it does not move when brgw.css, brgw.js
or a fragment changes, which is almost everything. Sean, 2026-10-07: "we need to
start versioning things so I can know what version we're on on the site... I have
to keep track of what you're doing because I don't see your changes."

SHAPE. One stamp, `YYYY.MM.DD.N`, carried in TWO places that this script keeps in
step and pre-push refuses to let drift:

  website/assets/brgw.css   line 1:  /* brgw build 2026.10.07.1 */
                            The plugin inlines this stylesheet into every WordPress
                            page, so the stamp reaches every page at no extra request
                            and is in the page source. brgw.js reads it from there:
                            <html data-brgw-build="…">, and `?build` on any page URL
                            draws a small badge with the build and the plugin version.
  CHANGELOG.md              newest entry first; its heading IS the stamp, its bullets
                            are what changed. The map from the number on the site to
                            the work behind it.

GATE. .githooks/pre-push refuses a push that would deploy (anything under website/,
netlify/, netlify.toml, package.json) unless the stamp moved, and refuses any push
where the two carriers disagree. A deploy without a new stamp cannot happen by
forgetting.

USE (from the clone, nothing to edit):
  python3 scripts/stamp.py "What changed, one line"  ["Another line" ...]
  python3 scripts/stamp.py --check            # carriers agree? exit 1 if not (pre-push)
  python3 scripts/stamp.py --current          # print the repo's stamp
  python3 scripts/stamp.py --live [path]      # stamp the LIVE site serves vs the repo's
"""
import datetime
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "website", "assets", "brgw.css")
LOG = os.path.join(ROOT, "CHANGELOG.md")
LIVE = "https://blacktoprestaurantgroup.com"
STAMP_RE = re.compile(r"^/\* brgw build (\d{4}\.\d{2}\.\d{2}\.\d+) \*/\s*$")
HEAD_RE = re.compile(r"^## (\d{4}\.\d{2}\.\d{2}\.\d+)\b", re.M)

LOG_HEADER = """# Change log

What changed on the site, newest first. Each heading is a **build stamp** (`YYYY.MM.DD.N`),
and the same stamp is on line 1 of `website/assets/brgw.css`, which the plugin inlines into
every live page. So the number on the site maps to an entry here.

To read the stamp on the live site: add `?build` to any page URL
(`https://blacktoprestaurantgroup.com/brg-home/?build`) and a small badge shows the build
and the plugin version. Or search the page source for `brgw build`.

Written by `python3 scripts/stamp.py "what changed"`. A push that deploys without a new
stamp is refused by pre-push, so every deploy has an entry.

"""


def css_stamp():
    with open(CSS, encoding="utf-8") as fh:
        first = fh.readline()
    m = STAMP_RE.match(first)
    return m.group(1) if m else None


def log_stamps():
    if not os.path.exists(LOG):
        return []
    with open(LOG, encoding="utf-8") as fh:
        return HEAD_RE.findall(fh.read())


def current():
    return css_stamp()


def check():
    css, log = css_stamp(), log_stamps()
    problems = []
    if not css:
        problems.append("brgw.css line 1 carries no stamp (expected `/* brgw build YYYY.MM.DD.N */`)")
    if not log:
        problems.append("CHANGELOG.md has no `## <stamp>` entry")
    if css and log and css != log[0]:
        problems.append("carriers disagree: brgw.css says %s, CHANGELOG.md's newest entry is %s" % (css, log[0]))
    if log:
        with open(LOG, encoding="utf-8") as fh:
            body = fh.read()
        top = body.split("\n## ", 2)
        entry = top[1] if len(top) > 1 else ""
        if not re.search(r"^\s*- \S", entry, re.M):
            problems.append("CHANGELOG.md's newest entry (%s) has no bullet saying what changed" % log[0])
    if problems:
        for p in problems:
            print("stamp: " + p)
        print("stamp: run  python3 scripts/stamp.py \"what changed\"")
        return 1
    print("stamp %s (brgw.css and CHANGELOG.md agree)" % css)
    return 0


def bump(lines):
    sys.path.insert(0, os.path.join(ROOT, "kit"))
    from _guard import refuse_if_worktree   # writes, so the generator rule applies
    refuse_if_worktree("scripts/stamp.py")

    today = datetime.date.today()
    prefix = today.strftime("%Y.%m.%d")
    n = 1 + max([int(s.rsplit(".", 1)[1]) for s in log_stamps() if s.startswith(prefix)] or [0])
    stamp = "%s.%d" % (prefix, n)

    with open(CSS, encoding="utf-8") as fh:
        css = fh.read()
    line = "/* brgw build %s */\n" % stamp
    if STAMP_RE.match(css.split("\n", 1)[0] + "\n"):
        css = line + css.split("\n", 1)[1]
    else:
        css = line + css
    with open(CSS, "w", encoding="utf-8") as fh:
        fh.write(css)

    body = open(LOG, encoding="utf-8").read() if os.path.exists(LOG) else LOG_HEADER
    entry = "## %s (%s)\n%s\n\n" % (stamp, today.isoformat(), "\n".join("- " + l.strip() for l in lines))
    head, sep, rest = body.partition("\n## ")
    body = head + "\n" + entry + ((sep + rest).lstrip("\n") if sep else "")
    with open(LOG, "w", encoding="utf-8") as fh:
        fh.write(body.rstrip("\n") + "\n")

    print("stamped %s" % stamp)
    print("  website/assets/brgw.css  line 1")
    print("  CHANGELOG.md             new entry, %d line(s)" % len(lines))
    print("  now: git add website/assets/brgw.css CHANGELOG.md <your files> && git commit && git push origin HEAD:main")
    return 0


def live(path):
    url = LIVE + path + ("&" if "?" in path else "?") + "brg_refresh=1&stamp=1"
    req = urllib.request.Request(url, headers={"User-Agent": "brg-stamp"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")
    m = re.search(r"brgw build (\d{4}\.\d{2}\.\d{2}\.\d+)", html)
    p = re.search(r"<!-- vc_embed \S+ v([0-9.]+) -->", html)
    got, repo = (m.group(1) if m else None), css_stamp()
    print("fetched  %s" % url)
    print("live     build %s · plugin v%s" % (got or "NONE", p.group(1) if p else "?"))
    print("repo     build %s" % repo)
    if got == repo:
        print("MATCH: the live site is serving the repo's build")
        return 0
    print("MISMATCH: the live site is not on the repo's build (WordPress caches for %s s; Netlify may still be deploying)" % "120")
    return 1


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if a else 2)
    if a[0] == "--check":
        sys.exit(check())
    if a[0] == "--current":
        print(current() or "NONE")
        sys.exit(0)
    if a[0] == "--live":
        sys.exit(live(a[1] if len(a) > 1 else "/brg-home/"))
    sys.exit(bump(a))
