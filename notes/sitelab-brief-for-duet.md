# BRG and SiteLab: brief for the Duet chat (2026-11-22)

Written by BRG Controller (the Claude Code chat on `brg-web`) for Sean to paste into the Duet chat. Nothing in it changes anything on the BRG site.

## What Sean wants

Connect blacktoprestaurantgroup.com to SiteLab and see whether it can work, **with a way back to exactly how it is now**. In his words: "right now it's done." The live site stays as it is until BRG's team gives a final approval, and BRG's team should be able to try SiteLab without anything that exists today being touched.

## The two rules

1. **The live site is never at risk.** SiteLab only ever works on a separate staging copy. The current site is the permanent fallback.
2. **BRG's team can test.** They use the staging copy. Going live is one deliberate step, taken only after their approval.

## How BRG is built (checked 2026-11-22)

- WordPress with Oxygen, hosted on DreamHost, with Cloudflare in front.
- Pages are made of shortcodes: the menu, then one shortcode per section, then the footer.
- It does **not** use the BKSTG plugin. It uses its own plugin, `vc-clients-embed.php` (version 2.16.0).
- Each section is an HTML file plus a list of editable slots, kept in the repo `seanmarshall21/brg-web` (folder `website/sections/<name>/`) and served from `blacktoprg.netlify.app`. The plugin fills them in when a page is drawn.
- What the client edits (words, photos, settings) is saved inside WordPress, on the "Section Content" admin page. **A saved value always beats the default in the code**, so the real content lives in the WordPress database, not only in git.
- Updates: pushing to git updates the Netlify files; a GitHub Action ships the plugin file.

## What would have to be true for a connection

- SiteLab (or a small piece on the WordPress side) would need to write to the same saved values the plugin already reads, or replace what the plugin draws. Either way it needs an adapter; BRG is not a BKSTG-plugin site.
- The fallback needs to be real: the current plugin and the current saved values stay in place and untouched, and the staging copy is the only place the connection exists.
- Cache: the live site has a roughly ten-minute page cache plus Cloudflare. Whether a SiteLab push clears both has not been tested.

## What is not known (from the BRG side)

- Whether a BRG staging copy exists. SiteLab's rule would give `blacktoprestaurantgroupcom.stage.site`; I have not checked it.
- Whether BRG is one of SiteLab's 14 domains.
- Which plugin shape SiteLab settles on, and which copy of SiteLab is "the home". The SiteLab chat and the Duet app disagree on that today.
- Who installs anything on the staging WordPress. Sean holds the WordPress admin.

## Questions for Duet

1. Is BRG a good second test site after Majestic, or should it wait?
2. Can SiteLab publish into an existing plugin's saved values, or only through its own plugin?
3. What is the smallest staging setup that proves it works without touching the live site?

## Where BRG's own notes are

`/Users/seanmarshall/Documents/GitHub/brg-web`: `STATUS.md`, `notes/roundtable.md`, `notes/site-audit-2026-11-19.md`. The SiteLab and Structure chats have been sent the facts above.
