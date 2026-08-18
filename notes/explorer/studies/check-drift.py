#!/usr/bin/env python3
"""Check every registered duplicate pair. SPEC-011.

    python3 check-drift.py                     report
    python3 check-drift.py --strict            exit 1 on any divergence
    python3 check-drift.py --strict --owner X  exit 1 only on pairs owned by X

--owner exists because the three `copy` pairs diverging is not a fault — it is the
handoff's STEADY STATE between the author building and the promoter promoting. A gate
that fires on the normal condition is noise, and an escape hatch typed reflexively on
every push is worse than no gate, because the line above it stops being read.

Divergence is only actionable by the pair's OWNER. Everything is still REPORTED, so a
divergence you cannot fix stays visible; only your own pairs can block your push.

WHAT THIS DOES NOT DO, and it is the important half: it checks pairs that are
REGISTERED. It cannot find duplication nobody wrote down. Registering a pair is the
work; checking it is the easy part. Every drift this project has had was unregistered
at the time it drifted.
"""
import json, pathlib, subprocess, sys, glob

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
REG  = HERE / "drift-register.json"

def status(p):
    if p.get("check"):
        r = subprocess.run(p["check"], shell=True, cwd=REPO, capture_output=True)
        return ("agree", "") if r.returncode == 0 else ("DIVERGED", r.stdout.decode()[:120].strip())
    a, b = REPO / p["a"], REPO / p["b"]
    if "*" in p["a"] or not a.exists() or not b.exists():
        return ("unguarded", "no mechanical comparison is possible")
    return ("agree", "") if a.read_bytes() == b.read_bytes() else ("DIVERGED", f"{a.name} != {b.name}")

def main():
    reg = json.loads(REG.read_text())
    argv = sys.argv[1:]
    owner = ""
    if "--owner" in argv:
        i = argv.index("--owner")
        owner = argv[i + 1] if i + 1 < len(argv) else ""
    bad = 0
    mine = 0
    print(f"{'PAIR':<16}{'MODE':<12}{'OWNER':<8}STATUS")
    for p in reg["pairs"]:
        st, detail = status(p)
        yours = (not owner) or p["owner"] == owner
        if st == "DIVERGED":
            bad += 1
            if yours: mine += 1
        note = ("  — " + detail) if detail else ""
        tag  = "" if yours or st != "DIVERGED" else "   (not yours — reported, will not block)"
        print("  " + p["id"].ljust(16) + p["mode"].ljust(12) + p["owner"].ljust(8) + st + note + tag)
    print()
    if bad:
        who = f" — {mine} of them yours" if owner else ""
        print(f"{bad} pair(s) diverged{who}. A divergence is not a merge — one side is the source; see the register.")
        if owner and not mine:
            print(f"None are owned by '{owner}', so this does not block you. The owner promotes.")
    else:
        print("All registered pairs agree.")
    print("NOTE: only REGISTERED pairs are checked. Unregistered duplication is invisible here.")
    blocking = mine if owner else bad
    return 1 if (blocking and "--strict" in argv) else 0

if __name__ == "__main__":
    sys.exit(main())
