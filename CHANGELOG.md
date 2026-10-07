# Change log

What changed on the site, newest first. Each heading is a **build stamp** (`YYYY.MM.DD.N`),
and the same stamp is on line 1 of `website/assets/brgw.css`, which the plugin inlines into
every live page. So the number on the site maps to an entry here.

To read the stamp on the live site: add `?build` to any page URL
(`https://blacktoprestaurantgroup.com/brg-home/?build`) and a small badge shows the build
and the plugin version. Or search the page source for `brgw build`.

Written by `python3 scripts/stamp.py "what changed"`. A push that deploys without a new
stamp is refused by pre-push, so every deploy has an entry.


## 2026.10.07.6 (2026-10-07)
- Reveal trigger: a section now reveals when the first thing in it that moves is half on screen, so a banner that is on screen after load animates on load, and a headline starts rising the moment its first line is visible.

## 2026.10.07.5 (2026-10-07)
- Community slider: "As two columns" replaces the bouncing "As two halves". Two boxes side by side that never move; the words and the photo slide up inside their own box, in step. Phones keep the single strip.

## 2026.10.07.4 (2026-10-07)
- New button size, Extra small (6px 10px padding, 10 to 12px type). Available at every level: site-wide, section, and each button.

## 2026.10.07.3 (2026-10-07)
- Every button now has its own five controls (size, color, hover color, filled or outline, hover effect). The two buttons inside each Community slide and the Contact box buttons were the ones missing them.
- The help text on every Buttons list now explains the three levels: site-wide, section, and each button's own row.

## 2026.10.07.2 (2026-10-07)
- Reveal timing: a section now reveals once about 110px of it has cleared the bottom of the screen, so the headline starts its rise on screen instead of below it. Crew cards keep their early trigger.
- Highlights (the yellow marks in headlines) now start after their own line has risen, instead of alongside it.

## 2026.10.07.1 (2026-10-07)
- Build stamp and change log: every deploy now carries `brgw build YYYY.MM.DD.N` on line 1 of brgw.css, inlined into every live page. Add `?build` to any page URL to see it as a badge with the plugin version.
- pre-push refuses a push that deploys without a new stamp, or whose brgw.css stamp and CHANGELOG.md entry disagree (scripts/stamp.py --check).
- CLAUDE.md: pull the clone first and check for stranded edits; Atlas is out of commission, skip its calls.
