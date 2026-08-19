# Motion Lab

Sandbox for BRG's animation work. Nothing in here is shipped to the site — it's a
place to build a technique, look at it, tune it, and *keep* it, so we can come back
and compare later instead of re-deriving it.

**Live:** https://blacktoprg.netlify.app/lab/motion.html
(Netlify publishes `/website`, so any file dropped in here is on the web after a push.
No shortcode, no WordPress involvement.)

**Local:** open `website/lab/motion.html` in a browser. Fonts and photos come from the
live WP uploads folder, so it looks right offline-ish but needs a connection.

---

## What's in `motion.html`

Controls in the sticky header: **Replay all**, a **Speed** scrub (0.25×–2.5×, for
inspecting easing frame by frame), and a **Loop** toggle. Every card also has its own
Replay. Sections 01 and 02 are the variant catalog; section 03 is a scroll rig using
the exact IntersectionObserver settings from the Home fragment.

### 01 — Marker underline

| | Variant | Verdict |
|---|---|---|
| **U1** | CSS blob, `scaleX` | What's on Home today. Uniform width, square ends, and `scaleX` stretches the shape as it grows — reads as a bar sliding out. Baseline only. |
| **U2** | SVG `stroke-dasharray` draw | Motion is right, but a stroke has one uniform width → reads as a ballpoint, not a marker. |
| **U3** | **Filled brush + angled wipe** | ★ **Recommended.** Filled shape keeps the taper (thin → thick → thin); a wipe with a ~5° slanted leading edge matches a chisel tip. Shape never moves, only the reveal. |
| **U4** | Double-stroke scribble | Base stroke + lighter return pass at 55%. Good on a big hero headline, muddy below ~2rem. Parked. |

### 02 — Marker highlight

| | Variant | Verdict |
|---|---|---|
| **H0** | Static | What's on Home today — no animation at all. Baseline. |
| **H1** | `background-size` wipe | Cheapest, and the **only one that survives a line wrap**. Square edges, no rotation. Keep as the fallback for any highlight that might break across lines. |
| **H2** | Rotated block + angled wipe | Gets the tilt. Edges still perfectly straight. |
| **H3** | **Rough SVG block + angled wipe** | ★ **Recommended** for the three hero highlights. Wobbled edges and uneven corners are what actually sell "hand-drawn" in the comps. |
| **H4** | Label pill | For OUR VISION / LEADERSHIP / etc. Clean rect in the comps → clean wipe, no rough edge, no rotation. Same easing keeps it in the family. |

### Timing

All of it is driven by four CSS custom properties at `:root`:

```
--u-dur    .62s   underline draw
--h-dur    .52s   highlight wipe
--h-delay  .12s   highlight trails the text settling
--speed    1      master multiplier (the slider)
```

`--h-delay` is the one that matters most: it makes the marker land *on top of* type
that has already settled, instead of racing it. Easing is
`cubic-bezier(.2,.7,.2,1)` throughout — quick commit, long settle, like a real stroke.

---

## Open questions for Sean

- **Sean's reference sample** — he mentioned sending one; it isn't in the repo. Once it
  lands, add it here and match against it. That's the actual spec; the four variants
  above are inferred from `website/page-1.png`.
- **U4** — do we want the double-stroke anywhere, or drop it?
- **Rotation direction** — everything's at `-1.4deg`. The comps vary per instance;
  worth deciding whether to alternate.
- **Exact brand hex** — still using sampled approximations pending the `.ai` swatches.

## Decision log

Append here as calls get made — one line each, so the reasoning survives.

- *(2026-08-16)* Lab created. U3 + H3 proposed as the defaults, H1 kept as the
  line-wrap fallback, H4 for small labels. Nothing merged into a page fragment yet.
