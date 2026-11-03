# Change log

What changed on the site, newest first. Each heading is a **build stamp** (`YYYY.MM.DD.N`),
and the same stamp is on line 1 of `website/assets/brgw.css`, which the plugin inlines into
every live page. So the number on the site maps to an entry here.

To read the stamp on the live site: add `?build` to any page URL
(`https://blacktoprestaurantgroup.com/brg-home/?build`) and a small badge shows the build
and the plugin version. Or search the page source for `brgw build`.

Written by `python3 scripts/stamp.py "what changed"`. A push that deploys without a new
stamp is refused by pre-push, so every deploy has an entry.


## 2026.11.03.10 (2026-11-03)
- core values: wait on Leadership until 60% in view; photo height can match the list

## 2026.11.03.9 (2026-11-03)
- photo layout: each photo (Photo 1, 2, 3) can be shifted on its own by a share of its own size; photos renamed Photo 1/2/3

## 2026.11.03.8 (2026-11-03)
- wp-admin tabs follow the order of the sections on the page (plugin 2.14.3)

## 2026.11.03.7 (2026-11-03)
- about slider: first and second slide take the same scroll; new section [brg_home-values-2] (a copy of core values with its own tab)

## 2026.11.03.6 (2026-11-03)
- about slider: brisker scrolling (shorter holds, about one second between slides)

## 2026.11.03.5 (2026-11-03)
- full screen option (100% or 90%) with hold-while-scrolling and gentle scroll-into-place on core values and a different kind of restaurant company

## 2026.11.03.4 (2026-11-03)
- about slider: shorter first hold, ease-out transitions, photo movement (parallax) setting

## 2026.11.03.3 (2026-11-03)
- about slider: photos load before their reveal (preload within 3 screens, reveal waits for the photo)

## 2026.11.03.2 (2026-11-03)
- about slider: longer holds (first slide locks in, each slide and the end rest), words then photo reveal, light gray #EDEDEE, Sean's own arrows

## 2026.11.03.1 (2026-11-03)
- new section [brg_home-about-slider]: full-screen What We're About with scroll or arrow slides (photo slides across, or stays and wipes); old About untouched

## 2026.11.02.3 (2026-11-02)
- photos no longer leave their frames (GSAP reveal baked a second copy of the parallax move); no colored ground behind photos unless chosen; core values heading text color; tighter gap under open value name

## 2026.11.02.2 (2026-11-02)
- core values: smoother hover (crossfade, sliding words, short hover pause); photo layout shift left/right/up/down

## 2026.11.02.1 (2026-11-02)
- core values: photo above the list on phones, section color opacity, heading spacing; tabs follow page order

## 2026.11.01.9 (2026-11-01)
- Core Values is its own section again (home-values rebuilt with the wheel, columns and list; About no longer holds them); photo scale (extra small to extra large) for the Home staircase photos

## 2026.11.01.8 (2026-11-01)
- core values list holds one height and no longer jumps on hover; core values heading marker color setting; BRG sticker in Born in San Diego no longer cut off

## 2026.11.01.7 (2026-11-01)
- core values list: words under the name (or the photo), no colored box; section background: blend mode, color on top or under, continue from the section above; photo can never leave its frame

## 2026.11.01.6 (2026-11-01)
- home about: vision and mission stacked and large (setting; side by side still available)

## 2026.11.01.5 (2026-11-01)
- kit and wp-admin: core values fields share one 'Core values' drop-down

## 2026.11.01.4 (2026-11-01)
- kit: customize panel groups fields into drop-downs, explanations moved into hover tips, previews show default repeater rows

## 2026.11.01.3 (2026-11-01)
- wp-admin: core values light/dark box renamed, color box placed directly under it

## 2026.11.01.2 (2026-11-01)
- home: photo side, shape, layout and order controls; core values get their own background color, heading and highlight; community slides stack; Switchfoot placeholder

## 2026.11.01.1 (2026-11-01)
- section color: choose a flat background color (brand roles, shades or custom) for 15 sections; words and nav flip to stay readable

## 2026.10.31.2 (2026-10-31)
- home: core values: photo only on the open item and fades in, words rise in after the column finishes widening, no pause button (hover pauses), columns become rows when the block is narrow, What We're About section background anchors to its own section

## 2026.10.31.1 (2026-10-31)
- home: core values columns: name under the number in the headline font, name width locked so it never re-wraps, soft look sits on a gray color

## 2026.10.30.2 (2026-10-30)
- home: core values columns and list layouts, photo per value, light and dark photo looks

## 2026.10.30.1 (2026-10-30)
- home: vision and mission side by side, core values wheel (hidden until switched on)

## 2026.10.29.1 (2026-10-29)
- "What We're About" can now have a highlight on the end of its heading. In wp-admin, Home, set "Heading — the marked words" and pick the animation; it is empty today, so the page is unchanged until you do.

## 2026.10.20.2 (2026-10-20)
- wp-admin sample-text notice: the deploy check misread two script functions as PHP; rewritten so it deploys.

## 2026.10.20.1 (2026-10-20)
- wp-admin: a list that is still showing the built-in sample text now says so, right above the list, until a row is added (Home values, Careers offers and posts, Community slides).

## 2026.10.15.1 (2026-10-15)
- Crew cards: the title box now takes a line break. Press Return in a crew member's title to put the rest on a second line.

## 2026.10.08.2 (2026-10-08)
- Community slider: a slide on its way out keeps its words until it has left the box.

## 2026.10.08.1 (2026-10-08)
- Community slider: the words side now wipes in with its photo and its title, text and buttons rise in behind it; the hidden slides are parked before the page paints, so the flash is gone.

## 2026.10.07.8 (2026-10-07)
- Community page: the teal banner is back (a section whose first animated element is hidden never revealed), photos no longer show-vanish-animate on load, every slide's photo opens when its slide arrives, and the dots go dark over the yellow panel.

## 2026.10.07.7 (2026-10-07)
- Crew quotes: the words now get 75% of their column on every screen (the quote mark hangs in the gutter beside them instead of eating the width). A long quote on a phone no longer runs to thirteen lines.

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
