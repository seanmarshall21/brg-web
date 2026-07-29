# BRG Website — Build Spec

Blueprint for the full Blacktop Restaurant Group marketing site, derived from
`BRG_Website_260617.ai` (7 artboards, 1920px desktop comps). This document drives
two things: (1) your **Figma responsive** pass, and (2) my **Oxygen + ACF** build.

Page renders for reference live next to this file: `page-1.png` … `page-7.png`.

> **Pages 5 and 6 are the same page** (Careers). Page 6 just shows the "Open
> Positions" state expanded, with the designer note *"OPEN POSITIONS button
> accordion opens LinkedIn posts."* So there are **6 designed pages** + a
> **Contact** page (in the nav, not yet designed).

---

## 1. Global / site-wide

### Design tokens (reuse from the coming-soon build)
- **Colors:** yellow `#FCE200`, teal `#19C7C2`(approx), magenta/pink `#EC0F8D`(approx),
  orange `#F5821F`(approx), black `#000`, off-black `#231F20`, white `#FFF`.
  (Sampled from comps — confirm exact hex from the `.ai` swatches.)
- **Fonts:** **Blanco Cavelary** (brush display — all the big script headlines),
  **Montserrat** (body + nav + buttons; Thin/Regular/Medium/SemiBold/Bold).
  Both already loaded on the site.
- **Recurring motifs:** hand-drawn "marker" underline/highlight under headlines
  (teal, magenta, orange, purple, yellow — color varies per page); highlight-box
  behind key words; brand doodles scattered as accents (⚡ bolt, ✳ asterisk,
  ☻ x-eye smiley, BRG spray badge); faint graffiti texture on dark sections.

### Header (all pages) — mostly static
- Left: **Blacktop / Restaurant Group** logo (links home).
- Nav (WP menu): **Our Story · Brands · Team · Community · Careers · Press & Gallery · Contact**.
- Active item underlined in teal. Sticky. Thin yellow bar across the very top.
- → **WP Menu** + Oxygen header template. Not ACF.

### Footer (all pages) — static
- Centered **Blacktop / Restaurant Group** logo on black. (Expand later w/ links.)

### Reusable components (build once, use everywhere)
| Component | Where it repeats | Notes |
|---|---|---|
| **Section heading** | every page | Blanco Cavelary + marker underline/highlight; color param |
| **CTA button** | Explore, Apply Today, Open Positions, Visit Us, Reach Out, Say Hello | yellow-fill or black-fill or outline variants; some are `[contact_cta]` (mailto) |
| **Brand doodles** | everywhere | bolt / asterisk / smiley / BRG — the SVGs already in `assets/svg/` |
| **Stat block** | Community | big number + label |
| **Card** | Brands, Team, Press | image + heading + text + button |
| **Coming-soon splash** | (already built) | separate — the current live page |

### Global data → **ACF Options ("BRG Brand" options page — already exists)**
- `contact_emails` (repeater, exists) — already wired to `[contact_cta source="option"]`.
- Add: social links, primary phone, HQ blurb, footer nav, default "Reach out" email.

---

## 2. Pages (sections top → bottom)

### 2.1 Our Story (Home) — `page-1.png`
1. **Hero** (static) — "WE'RE IN THE BUSINESS OF MAKING **YOUR DAY GREAT.**"
   sub "From a classic Board & Brew sandwich to a slice at Odie's — we're here for
   the moments that matter." · "GOOD FOOD. REAL PEOPLE. RAD EXPERIENCE." ·
   button **EXPLORE OUR RESTAURANTS** → Brands. Dark skate/surf photo bg.
2. **Born in San Diego / Built for Community** (static) — heading + 3 body paras +
   image block + BRG doodle. *(text likely lives in Options or page ACF so it's editable)*
3. **What We're About** (static) — Our Vision "MAKE YOUR DAY GREAT!" / Our Mission
   "To amp up our communities by creating real connections and rad experiences." + boardwalk photo.
4. **A Different Kind of Restaurant Company** (static) — heading + 3 paras + color blocks.
5. **Our Core Values** → **DYNAMIC (repeater)** — 5 values: Leadership, Culture,
   Advocate, Stay Stoked, Community — each {title, description}. Teal highlight titles.
6. Footer.

**Dynamic:** Core Values (repeater). Vision/Mission strings (Options, so easy to tweak).

### 2.2 Brands — `page-3.png` (comp pg 2)
1. **Hero** (static) — "TWO BRANDS. ONE STANDARD. ZERO COMPROMISES." + intro.
2. **Brand rows** → **DYNAMIC (CPT: `brand`)** — Board & Brew, Odie's Pizza (repeatable):
   fields: brand card image/logo, name, description (rich), **Visit Us** URL, location count.
3. Footer.

**Dynamic:** `brand` CPT (2 now, room to grow).

### 2.3 Team — `page-4.png`
1. **Hero** (static) — "MEET THE CREW" + intro "…strong opinions about **sandwiches**."
2. **Intro band** (static) — "WE WORK HARD, WE HAVE FUN, AND WE TAKE CARE OF OUR PEOPLE".
3. **Team grid** → **DYNAMIC (CPT: `team_member`)** — 9 shown, repeatable:
   fields: photo, name, title, quote, **panel color** (the colored swatch behind each
   headshot cycles teal/orange/blue/purple/yellow/magenta/red/green), optional accent doodle.
   (Placeholder images are Ron Burgundy stand-ins.)
4. **"Want to be part of the team?"** CTA band (static) → **APPLY TODAY** → Careers.
5. Footer.

**Dynamic:** `team_member` CPT (photo, name, title, quote, color, order).

### 2.4 Community — `page-4.png`(comp pg 4)
1. **Hero** (static) — "GREAT FOOD, GREAT PEOPLE, EPIC COMMUNITIES." + intro (orange underline).
2. **"It's in our DNA"** intro paragraph (static).
3. **How We Give Back** → **DYNAMIC (repeater/CPT: `giveback_program`)** —
   e.g. "Urban Surf 4 Kids", "Other Contributions" — each {title, body, **image gallery**
   (the slider dots = a carousel of photos per program)}.
4. **Stats** → **DYNAMIC (repeater)** — 4 stats {number, label}: "12 / locations embedded
   in SD & OC communities", "XX / local organizations supported annually",
   "XX / meals·dollars donated", "XX / giveback events per year".
5. **Partner CTA** (static) — "Want to partner with us?" + intro.
6. Footer.

**Dynamic:** `giveback_program` (title, body, gallery) + Stats repeater.

### 2.5 Careers — `page-5.png` / `page-6.png`
1. **Hero** (static) — "COME WORK SOMEWHERE YOU ACTUALLY WANT TO BE" + intro "…**LET'S TALK.**"
2. **What it's like to work here** (static body) + **WE OFFER** bullets →
   **DYNAMIC (repeater)** {bullet text} (4 now). **APPLY TODAY** button.
3. **"Ready to join the crew?"** yellow band (static) + **OPEN POSITIONS** button.
4. **Open positions** → **DECISION NEEDED (see §4)** — designer note: the button
   "accordion opens **LinkedIn posts**." Comp shows LinkedIn job-post cards
   {brand avatar, follower count, post text, job title, location, **View job** URL}.
5. Footer.

**Dynamic:** "We offer" bullets (repeater) + Jobs (LinkedIn — see decision).

### 2.6 Press & Gallery — `page-7.png`
1. **Hero** (static) — "IN THE PRESS & BEHIND THE SCENES" (purple underline) + intro.
2. **Articles** → **DYNAMIC (CPT: `press_article`)** — repeatable rows:
   {thumbnail image, title, outlet, external URL}. (2 shown, "ARTICLE" placeholders.)
3. **Media Inquiries** band (static, teal) — **REACH OUT** button → `[contact_cta]` (mailto).
4. **"The food speaks for itself"** → **DYNAMIC (Gallery field)** — image grid (9 shown).
5. Footer.

**Dynamic:** `press_article` CPT + Gallery (ACF gallery field or a `gallery_image` set).

### 2.7 Contact — *not yet designed*
In the nav but no comp. Needs a design pass (or a simple template): heading, the
`contact_emails` CTA, maybe address/map/hours. Flagging as an open item.

---

## 3. Content model (ACF) — consolidated

**Options ("BRG Brand" page):** `contact_emails` (exists) · social links · phone ·
vision/mission strings · footer content.

**Custom Post Types:**
- **`brand`** — title, card_image, logo, description, visit_url, location_count, brand_color.
- **`team_member`** — photo, name(title), role, quote, panel_color, order.
- **`giveback_program`** — title, body, gallery.
- **`press_article`** — thumbnail, title, outlet, url, date.

**Page-level repeaters (simpler than a CPT):**
- Home → `core_values` (title, description).
- Community → `stats` (number, label).
- Careers → `we_offer` (bullet).

**Media:** Press "food speaks for itself" grid → ACF **Gallery** field (or a
`gallery_image` CPT if it needs categories/ordering).

---

## 4. Open decisions (need your call)

1. **Careers "Open Positions" — LinkedIn.** Three options:
   a. **Live LinkedIn embeds** (each job = a LinkedIn post embed). Truest to the comp,
      but LinkedIn embeds are clunky/inconsistent and hard to style.
   b. **Manual `job` CPT** styled to *look* like the LinkedIn cards, each with a
      "View job" URL pointing to the real LinkedIn post. Full style control, tiny
      upkeep (add a row per job). **← my recommendation.**
   c. **LinkedIn API/feed** pull — most automated, most fragile/most setup.
2. **Contact page** — design it, or ship a simple template for now?
3. **Responsive** — this is your Figma pass: how the Team grid (3-up), Brand rows,
   Community split-panels, stats (2×2), and Press articles reflow at tablet/mobile.
4. **Gallery source** — hand-curated ACF gallery, or pull from an Instagram feed?
5. **Exact brand hex values** — pull from the `.ai` swatches so tokens are precise.

---

## 5. Suggested build order

1. **Foundations** — design tokens (CSS vars), Oxygen header + footer templates,
   reusable CTA + section-heading + doodle components. *(Reuses the coming-soon CSS.)*
2. **ACF model** — register the CPTs / repeaters / options above.
3. **Static pages first** — Our Story, then the static sections of each page (fast wins).
4. **Dynamic sections** — wire Brands, Team, Community, Press, Careers to ACF via
   Oxygen dynamic data / repeaters.
5. **Contact** + responsive polish (informed by your Figma breakpoints).

Figma's real job in this flow = **step 3–5 responsive decisions**. Everything above
I can build from these comps + your breakpoint calls; I don't need the Figma file to start.
