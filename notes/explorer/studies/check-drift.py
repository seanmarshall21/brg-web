#!/usr/bin/env python3
"""Check every registered duplicate pair. SPEC-011.

    python3 check-drift.py            report
    python3 check-drift.py --strict   exit 1 on any divergence

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
    bad = 0
    print(f"{'PAIR':<16}{'MODE':<12}{'OWNER':<8}STATUS")
    for p in reg["pairs"]:
        st, detail = status(p)
        if st == "DIVERGED": bad += 1
        note = ("  — " + detail) if detail else ""
        print("  " + p["id"].ljust(16) + p["mode"].ljust(12) + p["owner"].ljust(8) + st + note)
    print()
    if bad:
        print(f"{bad} pair(s) diverged. A divergence is not a merge — one side is the source; see the register.")
    else:
        print("All registered pairs agree.")
    print("NOTE: only REGISTERED pairs are checked. Unregistered duplication is invisible here.")
    return 1 if (bad and "--strict" in sys.argv) else 0

if __name__ == "__main__":
    sys.exit(main())
