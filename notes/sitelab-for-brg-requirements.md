# SiteLab for BRG: the five things to write down (started 2026-11-22)

Status 22 Nov: the five-point document is on the BKSTG board as item 0bd1c0c6, assigned to Structure, **proposed, not yet approved** (Structure is confirming Sean's answer with him). The BRG facts section (point 2) is complete as far as known.

Sean's rule (22 Nov): before BRG goes on SiteLab's list and before a BRG staging copy is made, these five things must be figured out and **in writing**. Sean's words: "how the client-facing site lab structure is going to work; how their side needs to be set up and their requirements; how our setup works; how they're able to use SiteLab and get updates; what add-ons they have available, especially when we have things like the Bones, Fresco, and Kit options available."

**What this file is:** the five headings, with only what is already known and where it came from. Anything marked **BLANK** is not written anywhere I could find. I have not filled any blank with a guess. BKSTG product decisions (points 1, 3, 4, 5) are Structure's to write; the BRG facts (point 2) are mine.

**Standing rules from Sean:** the live site is never touched; the current setup is the permanent fallback; BRG's team can test SiteLab without anything existing being changed; going live is one deliberate step after BRG's final approval.

## 1. How the client-facing SiteLab will work

**BLANK.** SiteLab's own notes (sitelab-direction-2026-11-19, master spec, package, phase-lab spec in bkstg-extd) cover BKSTG's own event sites only. No outside-client concept is written. Structure's note of 22 Nov: SiteLab is a plan only, nothing built, and "whether an outside client's site such as BRG should run on it is not written anywhere."

What Sean has already required of it (his direction, 19 Nov): one button; live and cached in under five minutes; anyone he permits can push; simple; a fallback exists; a small piece stays on each WordPress site.

## 2. The client's side: set-up and requirements (BRG facts, checked 22 Nov)

- WordPress with Oxygen on DreamHost, Cloudflare in front.
- Does **not** run the BKSTG plugin. Runs its own plugin, `vc-clients-embed.php` v2.16.0.
- Sections are HTML fragments in the repo `seanmarshall21/brg-web` (`website/sections/<id>/`), served from `blacktoprg.netlify.app`, filled by the plugin when a page draws.
- Client-edited words and photos are saved in WordPress (ACF options, "Section Content"); a saved value always beats the code default. So real content lives in the WordPress database.
- Updates: git push to Netlify for files; a GitHub Action for the plugin file.
- Page cache about ten minutes, plus Cloudflare.
- No staging copy confirmed. SiteLab's naming rule would give `blacktoprestaurantgroupcom.stage.site`; not checked.
- Who holds WordPress admin: Sean.
- **BLANK:** what a client must install or allow for SiteLab (not defined by BKSTG).

## 3. How BKSTG's own setup works

From Structure's note: SiteLab is planned on the BKSTG Hub's systems (CRSSD's company hub). The Hub withholds data before reveal times; sites pull from the Hub feed. The BKSTG plugin (3.4.3 on underthebigskyfest.com as of 24 Oct) plus per-site add-ons exist.
**BLANK:** whether an outside client's site could use the Hub, or would need its own.

## 4. How a client uses SiteLab and gets updates

**BLANK** for outside clients. Written only for BKSTG's own sites: add-ons update themselves through "channels" (direction note); the manual update is "validate, staging, smoke checks, promote" (master spec 4.3).

## 5. Add-ons available to a client (BONES, FRESCO, KIT)

Names as Sean listed them (BKSTG Stack names list, 21 Nov):
- **BONES™**: design system builder (was "Design Systems"), under BRNDS.
- **FRESCO**: branding tool, under BRNDS.
- **KIT™**: brand discovery questionnaires (was "Brand Kit").
(Structure, 22 Nov, from `docs/app-names/app-names.md` in bkstg-extd: BONES = Design Systems, KIT = Brand Kit, FRESCO = the branding tool, all under BRNDS; FRESCO has no logo yet.)
- SiteFlow (page-to-page transitions on sites) and SiteGlow (animated site background) are named as site systems.

**BLANK:** which of these a client site can use, what each does to a WordPress site, how a client gets them, and how they are updated. SiteLab's files do not connect BONES, FRESCO or KIT to sites. (One line in the direction note says Majestic was named the first WordPress tester "bones only", meaning the plugin with minimal parts, not necessarily the BONES tool; not checked.)

## Where each blank goes

| Point | Who writes it |
|---|---|
| 1, 3, 4, 5 | Structure (BKSTG product), after Sean's say-so |
| 2 | BRG Controller (this file), BLANK part from Structure |
| Whether BRG goes live on it | Sean, after BRG's team approves |
