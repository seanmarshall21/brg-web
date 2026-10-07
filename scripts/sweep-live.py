#!/usr/bin/env python3
"""Sweep every live page for the defects that hide in plain sight.

Each check answers a question the eye cannot answer reliably across 7 pages and
21 sections. A clean run prints the success token on the last line and nothing
else claims success, so the token cannot be produced by a partial pass.
"""
import json, re, sys, urllib.request, glob, os

BASE = "https://blacktoprestaurantgroup.com"
PAGES = ["/brg-home/", "/brands/", "/team/", "/community/", "/careers/", "/contact/"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fetch(path):
    req = urllib.request.Request(BASE + path + "?sweep=1",
                                 headers={"User-Agent": "brg-sweep"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

# the design-time fallback copy, per section, so we can spot it rendering live
fallbacks = {}
for f in sorted(glob.glob(os.path.join(ROOT, "website/sections/*/embed.html"))):
    sec = os.path.basename(os.path.dirname(f))
    s = open(f, encoding="utf-8").read()
    for m in re.finditer(r"<!--brg:repeat (\w+)-->.*?<!--brg:empty-->(.*?)<!--/brg:repeat-->", s, re.S):
        name, fb = m.groups()
        words = re.sub(r"<[^>]+>", " ", fb)
        words = re.sub(r"\{\{[^}]+\}\}", " ", words)
        words = [w for w in re.split(r"\s+", words) if len(w) > 6 and w.isalpha()]
        if len(words) >= 4:
            fallbacks.setdefault(sec, []).append((name, words[:6]))

findings = []
for page in PAGES:
    try:
        html = fetch(page)
    except Exception as e:
        findings.append(f"{page}: FETCH FAILED: {e}")
        continue

    # The inlined stylesheet and script carry documentation comments that quote
    # tokens verbatim. Searching the whole document finds those and reports a bug on
    # every page that has never had one. Strip both before looking at anything: a
    # checker that cries wolf gets ignored, which is worse than not having it.
    visible = re.sub(r"<(script|style)\b[\s\S]*?</\1>", " ", html, flags=re.I)

    # 1. a token that never got filled is visible text on a live page
    for t in sorted(set(re.findall(r"\{\{[a-zA-Z_.0-9]+\}\}", visible))):
        findings.append(f"{page}: unreplaced token {t} in rendered markup")

    # 2. a button with no words is a button nobody can read
    for m in re.finditer(r'<a class="btn[^"]*"[^>]*>(.*?)</a>', visible, re.S):
        if not re.sub(r"<[^>]+>", "", m.group(1)).strip():
            findings.append(f"{page}: empty button rendered")

    # 3. an empty src or href requests the page itself in some browsers
    for attr in ("src", "href"):
        n = len(re.findall(r'<(?:img|a|source)[^>]*\b%s=""' % attr, visible))
        if n:
            findings.append(f"{page}: {n} element(s) with {attr}=\"\"")

    # 4. placeholder copy rendering as if it were content
    for sec, reps in fallbacks.items():
        if ("brgw-sec--" + sec) not in html:
            continue
        for name, words in reps:
            if sum(1 for w in words if w in visible) >= 4:
                findings.append(f"{page}: {sec} is showing PLACEHOLDER copy for '{name}'")

    # 5. a section that renders nothing but its own wrapper
    for m in re.finditer(r'<section[^>]*brgw-sec--([a-z-]+)[^>]*>(.*?)</section>', visible, re.S):
        sec, body = m.group(1), m.group(2)
        text = re.sub(r"<(script|style)[\s\S]*?</\1>", "", body)
        text = re.sub(r"<[^>]+>", " ", text)
        if len(" ".join(text.split())) < 15:
            findings.append(f"{page}: {sec} renders almost no text")

print(f"swept {len(PAGES)} pages, {len(fallbacks)} sections carry fallback copy")
for f in findings:
    print("  FINDING:", f)
if findings:
    print(f"{len(findings)} finding(s)")
    sys.exit(1)
print("live sweep clean")
