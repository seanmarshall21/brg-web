# Site audit, 19 Nov 2026 — smoothness, errors, speed, SEO

**How it was measured:** the nine live pages (home, brands, team, community, careers, contact, privacy, cookies, accessibility) in headless Chrome driven from Sean's Mac, at 390px (phone) and 1280px (desktop), with no network throttling and the graphics card on. Numbers are one run each, not an average, and are the **site as served on 19 Nov (build 2026.11.19.8)**. A real phone on mobile data will be slower. Not measured: Lighthouse scores, real-phone touch, Safari/Firefox.

## The short answer

The pages are in good shape on layout and smoothness. The big costs are **where the site is hosted and what WordPress loads for every page**, not the BRG code. The site is also **hidden from Google** on purpose, and has **no page descriptions** yet.

## 1. Smoothness (jumpy animations)

| Check | Result |
|---|---|
| Scroll the seven main pages top to bottom, time every frame (graphics card OFF, the harsh case) | Six pages: 0 slow frames. Home page: 15 slow frames of 108 on desktop, 2 of 181 on a phone, all in its top section |
| Home top section again, graphics card ON (how a Mac runs it) | 0 slow frames (one 433 ms hiccup the first time, then smooth). Cause isolated with the card off: the full-screen grain layer (`.grit`, `mix-blend-mode:overlay`). **No change made** (it would change the look). Legal pages and the other pages were not re-timed with the card on |
| Layout shift while loading and scrolling (CLS) | 0 to 0.006 on every page (Google's "good" is under 0.1) |
| Elements that pop in (opacity 0→1 in one or two frames) | Only the hero headline containers, which are meant to (their lines slide in separately) |
| Horizontal scroll at 390px | None on any page |

**Open question for Sean:** which moment feels jumpy to you? Not found by measurement.

## 2. Errors in the browser console (every page)

1. **BugHerd is loaded twice** (the WordPress plugin and a second pasted copy) and reports `[AUTH] Unauthenticated Error: Cannot initialize BugHerd` plus "sidebar was already set". Fix: remove one copy. It is also visible to every visitor, so it should come off at launch. The privacy and cookie wording mentions it.
2. **Leftover splash-page scripts** log `GSAP target .vc_repeater_row not found`, `.vc_herorep_row not found`, `No .vc_repeater_row elements found`. They look for elements that do not exist on this site. Harmless but wasteful.

No failed requests (no 404s or 500s) on any page.

## 3. Speed

| Finding | Numbers | Where it lives |
|---|---|---|
| Server is slow to answer (time to first byte) | 1.0–2.9 s on every page, even small ones | Host (Apache; already ticketed in `notes/`) |
| First paint / biggest paint | 1.5–3.2 s / 1.9–5.4 s | Follows from the line above |
| **14 GSAP files load on every page** | about 99 KB compressed, 14 requests | WordPress (Code Snippets / Oxygen header). Our code uses only `gsap` and `ScrollTrigger` (about 46 KB), so about **53 KB and 12 requests** can go |
| A 27 KB "Coming Soon" splash stylesheet is written into every page | 27 KB | WordPress (Code Snippets). Only the splash at `/` needs it |
| Our stylesheet and script are written into every page, not saved by the browser between pages | about 115 KB + 25 KB CSS, 148 KB + 32 KB JS (not shrunk) | Plugin design. Shrinking them ("minifying") needs a build step that does not exist yet |
| Home page weight | 2.5–2.7 MB, 66 requests | Photos, all already WebP. Biggest: 432 KB `brg-bnb-table.webp` |
| Photos cached for only 2 days | `cache-control: max-age=172800` | Host / Cloudflare setting; a year is normal for files that never change |
| Page responses vary by browser type | `vary: User-Agent` on every page | Host. Makes shared caching (Cloudflare) less effective |

## 4. Best practices

- HTTPS and the `http://` and `www.` redirects work.
- Missing security headers: no `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. Set at the host or at Cloudflare.
- Cookies: nothing is set and no Google request is made before the visitor accepts (checked in a fresh browser). The banner shows Reject and Accept All.
- A real 404 page returns 404. Favicon and apple-touch icon present. Every image has an `alt` attribute (decorative ones empty, which is correct). One `<h1>` on every page.

## 5. SEO

**Every page says `noindex, nofollow`** (hidden from Google). That is the WordPress "discourage search engines" setting or Yoast. Turn it off only at launch.

| Item | Now | Want |
|---|---|---|
| Meta description | none on any page | one per page (draft below) |
| Canonical address | none | Yoast adds it once indexing is on |
| Page titles | "BRG Home - Blacktop Restaurant Group", "Brands - …" | Home: "Blacktop Restaurant Group — Board & Brew and Odie's Pizza, San Diego" |
| Social preview image (og:image) | `brg-seo-1200-alt` on every page | Fine |
| Structured data | Yoast: WebPage, Breadcrumb, WebSite, Organization | Add Restaurant details later if wanted |
| Sitemap | `/sitemap_index.xml` works | `robots.txt` has no `Sitemap:` line, and has `Crawl-delay: 10` (Google ignores it; some other search engines slow down) |
| Home address | real home is `/brg-home/`, `/` is the splash page | Decide which one Google should see |

**Drafted descriptions** (from the pages' own words; Sean to change anything):
- Home: "Good food. Real people. Rad experience. Blacktop Restaurant Group is behind Board & Brew sandwiches and Odie's pizza in San Diego."
- Brands: "Two brands, one standard: quality ingredients, genuine hospitality and a laid-back vibe worth coming back for."
- Team: "Meet the operators, leaders and community builders behind Blacktop Restaurant Group's restaurants."
- Community: "Local sponsorships, giveback programs and showing up for our neighborhoods."
- Careers: "Come work somewhere you actually want to be. See open roles at Blacktop Restaurant Group."
- Contact: "Partnerships, press, jobs and feedback: here is who to reach at Blacktop Restaurant Group."
- Privacy / Cookies / Accessibility: one plain sentence each.

## Not done, and why
- Lighthouse was not run (it needs a tool installed; I did not add one without asking).
- Nothing in the repo was changed for this audit. Every real cost found sits in WordPress or at the host.
