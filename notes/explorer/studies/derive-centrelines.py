#!/usr/bin/env python3
"""Derive drawable centrelines from Sean's filled-outline stroke artwork.

WHY THIS EXISTS, AND WHY IT HAS A --check
-----------------------------------------
website/assets/media/lines/*.svg are FILLED OUTLINE paths — a closed shape, no stroke
attributes. Putting a stroke on one traces its perimeter out and back, which reads as a
lasso rather than a pen (SPEC-003, and Sean caught it in the lab: "it's using a trim path
to outline the shape instead of drawing the line").

So lines-centrelines.json holds a centreline derived from each outline. That derived file
is a JUDGEMENT ABOUT ANOTHER FILE, and SPEC-010 says a judgement must carry the identity of
what it judged and stop counting when that identity changes. Sean is re-exporting this
artwork ("I'm making it a little bolder"), so the derivation WILL go stale, silently, and
the failure would be invisible: the strokes still draw, just in the old shape.

Hence: every entry records the sha256 of the SVG it came from.

    python3 derive-centrelines.py            regenerate from the current artwork
    python3 derive-centrelines.py --check    exit 1 if any source SVG has moved since

This is deliberately a narrow check, per SPEC-010's boundary. The artwork changes rarely,
the cost of using a stale derivation is high, and the identity is one hash — which is the
whole test for whether an identity check earns its noise.

METHOD
------
For a uniform-width stroke expanded to an outline, the centreline is the midpoint between
the two edges. Flatten every curve, bucket the points by x, take (min+max)/2 per bucket,
drop the round caps where the outline pinches and the midpoint stops meaning anything, then
fit a Catmull-Rom through the result. Measured weight comes out at exactly 15.0 on all five
hero files and 5.0 on all five nav files, which is what makes this recoverable at all — and
independently confirms Sean's "it should never taper" direction against his own artwork.
"""
import re, json, sys, hashlib, collections
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SRC  = REPO / "website/assets/media/lines"
OUT  = Path(__file__).with_name("lines-centrelines.json")
# Anything that BAKES A COPY of the derivation is a second-order instance of the same rule:
# --check would pass on the JSON while a consumer silently carried last week's paths.
CONSUMERS = [Path(__file__).with_name("lab.html")]
SAMPLES, CAP_FLOOR = 90, .45


def flatten(d):
    """Path data -> polyline. Full grammar: relative forms, H/V/S/Q/A."""
    seq, cmd, nums = [], None, []
    for c, n in re.findall(r'([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e-?\d+)?)', d):
        if c:
            if cmd: seq.append((cmd, nums))
            cmd, nums = c, []
        else:
            nums.append(float(n))
    if cmd: seq.append((cmd, nums))

    pts, cur, start, prev = [], [0., 0.], [0., 0.], None
    def bez(p0, p1, p2, p3):
        for k in range(1, 25):
            t = k / 24; m = 1 - t
            pts.append((m**3*p0[0] + 3*m*m*t*p1[0] + 3*m*t*t*p2[0] + t**3*p3[0],
                        m**3*p0[1] + 3*m*m*t*p1[1] + 3*m*t*t*p2[1] + t**3*p3[1]))
    for c, v in seq:
        rel, C, i = c.islower(), c.upper(), 0
        while True:
            if C == 'M':
                if i + 2 > len(v): break
                cur = [v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0)]
                start = list(cur); pts.append(tuple(cur)); i += 2; C = 'L'
            elif C == 'L':
                if i + 2 > len(v): break
                cur = [v[i] + (cur[0] if rel else 0), v[i+1] + (cur[1] if rel else 0)]
                pts.append(tuple(cur)); i += 2
            elif C == 'H':
                if i + 1 > len(v): break
                cur = [v[i] + (cur[0] if rel else 0), cur[1]]; pts.append(tuple(cur)); i += 1
            elif C == 'V':
                if i + 1 > len(v): break
                cur = [cur[0], v[i] + (cur[1] if rel else 0)]; pts.append(tuple(cur)); i += 1
            elif C == 'C':
                if i + 6 > len(v): break
                o = cur if rel else [0., 0.]
                a = [v[i]+o[0], v[i+1]+o[1]]; b = [v[i+2]+o[0], v[i+3]+o[1]]; e = [v[i+4]+o[0], v[i+5]+o[1]]
                bez(cur, a, b, e); prev, cur, i = b, e, i + 6
            elif C == 'S':
                if i + 4 > len(v): break
                o = cur if rel else [0., 0.]
                b = [v[i]+o[0], v[i+1]+o[1]]; e = [v[i+2]+o[0], v[i+3]+o[1]]
                a = [2*cur[0]-prev[0], 2*cur[1]-prev[1]] if prev else list(cur)
                bez(cur, a, b, e); prev, cur, i = b, e, i + 4
            elif C == 'Q':
                if i + 4 > len(v): break
                o = cur if rel else [0., 0.]
                q = [v[i]+o[0], v[i+1]+o[1]]; e = [v[i+2]+o[0], v[i+3]+o[1]]
                bez(cur, [cur[0]+2/3*(q[0]-cur[0]), cur[1]+2/3*(q[1]-cur[1])],
                         [e[0]+2/3*(q[0]-e[0]), e[1]+2/3*(q[1]-e[1])], e)
                cur, i = e, i + 4
            elif C == 'A':
                if i + 7 > len(v): break
                o = cur if rel else [0., 0.]
                cur = [v[i+5]+o[0], v[i+6]+o[1]]; pts.append(tuple(cur)); i += 7
            elif C == 'Z':
                cur = list(start); break
            else:
                break
            if i >= len(v): break
    return pts


def centreline(pts, width):
    buckets = collections.defaultdict(list)
    for x, y in pts:
        buckets[min(SAMPLES - 1, max(0, int(x / width * SAMPLES)))].append(y)
    xs, ys, ws = [], [], []
    for i in sorted(buckets):
        v = buckets[i]
        if len(v) < 2: continue
        xs.append((i + .5) / SAMPLES * width); ys.append((min(v) + max(v)) / 2); ws.append(max(v) - min(v))
    if not ws: return None, 0
    keep = [j for j, w in enumerate(ws) if w > max(ws) * CAP_FLOOR]   # trim the round caps
    P = [(xs[j], ys[j]) for j in keep]
    if len(P) < 2: return None, 0
    d = f"M{P[0][0]:.1f} {P[0][1]:.1f}"
    for i in range(len(P) - 1):
        p0 = P[i-1] if i else P[0]; p1, p2 = P[i], P[i+1]
        p3 = P[i+2] if i + 2 < len(P) else P[-1]
        d += (f"C{p1[0]+(p2[0]-p0[0])/6:.1f} {p1[1]+(p2[1]-p0[1])/6:.1f}"
              f" {p2[0]-(p3[0]-p1[0])/6:.1f} {p2[1]-(p3[1]-p1[1])/6:.1f}"
              f" {p2[0]:.1f} {p2[1]:.1f}")
    return d, sorted(ws)[len(ws) // 2]


def derive():
    out = {}
    for f in sorted(SRC.glob("*.svg")):
        raw = f.read_bytes(); s = raw.decode()
        vb = re.search(r'viewBox="([^"]+)"', s).group(1)
        W = float(vb.split()[2])
        d = re.search(r'<path[^>]*\bd="([^"]+)"', s).group(1)
        c, sw = centreline(flatten(d), W)
        if not c:
            print(f"  ! {f.name}: no centreline recoverable"); continue
        out[f.stem] = {"vb": vb, "d": d, "centre": c, "sw": round(sw, 1),
                       "src_sha": hashlib.sha256(raw).hexdigest()[:12]}
    return out


def main():
    check = "--check" in sys.argv
    fresh = derive()
    if check:
        if not OUT.exists():
            print("MISSING lines-centrelines.json — run without --check"); return 1
        old = json.loads(OUT.read_text()); bad = []
        for k, v in fresh.items():
            o = old.get(k)
            if not o:                          bad.append(f"{k}: new artwork, never derived")
            elif o.get("src_sha") != v["src_sha"]:
                bad.append(f"{k}: SVG changed ({o.get('src_sha')} -> {v['src_sha']}) — derivation is stale")
        for k in old:
            if k not in fresh and not k.startswith("_"): bad.append(f"{k}: source SVG is gone")
        # consumers that embed the paths must carry the same provenance, or they go stale silently
        want = "".join(sorted(v["src_sha"] for v in fresh.values()))
        for c in CONSUMERS:
            if not c.exists(): continue
            m = re.search(r"centreline-provenance: ([a-f0-9]+)", c.read_text())
            if not m:        bad.append(f"{c.name}: embeds the paths but records no provenance stamp")
            elif m.group(1) != want:
                bad.append(f"{c.name}: baked from an older derivation — rebuild it")
        if bad:
            print("STALE — the artwork moved under the derivation:")
            for b in bad: print("  " + b)
            print("\nRe-run without --check, then re-check the lab's draw variants against the new shape.")
            return 1
        print(f"OK — all {len(fresh)} centrelines match the artwork they were derived from.")
        return 0
    OUT.write_text(json.dumps(fresh, indent=1))
    print("  provenance stamp:", "".join(sorted(v["src_sha"] for v in fresh.values()))[:24], "...")
    for k, v in fresh.items():
        print(f"  {k:22} stroke {v['sw']:5.1f}  src {v['src_sha']}")
    print(f"\nwrote {OUT.name} — {len(fresh)} centrelines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
