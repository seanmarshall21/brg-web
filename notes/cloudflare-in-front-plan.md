# Plan: put Cloudflare in front of blacktoprestaurantgroup.com

Written 3 Nov 2026 by the BRG Controller chat, after Sean chose "also plan Cloudflare in front".
Every fact below was read from public records that day; the effect on speed is NOT yet measured.

## What it is, in plain words
Cloudflare is a free service that sits between visitors and DreamHost. A visitor's secure connection ends at a
Cloudflare server near them (fast), and Cloudflare keeps its own connection to DreamHost open and reuses it,
so the 11-second wait is paid rarely instead of by every visitor. It can also keep copies of pages so most
visits never reach DreamHost at all.

**Not guaranteed:** I cannot prove it fixes the delay for this site until it is switched on. After the switch we
re-run the same timing test (`curl -w "%{time_appconnect}"` on the home page) and compare to today's 8.5 to 12.5 s.
**Undo:** at GoDaddy, set the nameservers back to `ns1.dreamhost.com`, `ns2.dreamhost.com`, `ns3.dreamhost.com`.
DreamHost keeps all the DNS records untouched the whole time.

## Facts found today (public lookups, 3 Nov 2026)
- Domain registered at **GoDaddy** (expires 28 Aug 2027). DNS is run by **DreamHost** (ns1/ns2/ns3.dreamhost.com).
- Records on blacktoprestaurantgroup.com: `A` and `www` both -> 205.196.208.104; also `ftp` and `ssh` -> the same address.
  **No email (MX) records, no TXT records, no CAA records.** So moving DNS cannot disturb email on this domain
  (staff email is on a different domain, blacktoprg.com, which this plan does not touch).
- Certificate: Let's Encrypt, covers blacktoprestaurantgroup.com and www, valid 1 Nov 2026 to 30 Jan 2027.

## The one trap
The plugin-deploy robot (GitHub Action) logs in to DreamHost over SSH using a stored hostname (secret `WP_SSH_HOST`,
documented as `ssh.blacktoprestaurantgroup.com`). Cloudflare only carries web traffic, not SSH. So in Cloudflare the
`ssh` and `ftp` records must be set to **DNS only (grey cloud)**, never proxied (orange cloud), or plugin deploys stop
working. Only the root and `www` records get the orange cloud.

## Steps (who does what)
1. **Sean:** create a free Cloudflare account and choose "Add a site" -> blacktoprestaurantgroup.com -> Free plan. (I cannot create accounts.)
2. **Together:** check that Cloudflare imported exactly these records: root `A`, `www`, `ftp`, `ssh` -> 205.196.208.104. Set root and `www` to orange cloud; `ftp` and `ssh` to grey.
3. **Together:** in Cloudflare set SSL/TLS to **Full (strict)** (works because the DreamHost certificate covers both names).
4. **Sean:** at GoDaddy, change the domain's nameservers from the three DreamHost ones to the two Cloudflare gives you.
5. **Wait** (minutes to a few hours). **Claude:** re-time the site and check the home, community and team pages, the admin login and a plugin deploy.
6. **Caching rules (second pass, only after step 5 looks good):** never cache `/wp-admin`, `/wp-login.php` or anyone logged in; then decide whether to cache public pages. Page changes made in wp-admin must show up, so this is done carefully.

## Risks
- A wrong caching rule can show old content or cache a logged-in page. Mitigation: start with NO page caching (connection benefit only), add rules after.
- If `ssh` is accidentally orange-clouded, plugin deploys fail. Mitigation: step 2 check; a deploy test in step 5.
- DNS propagation can make the site flicker between old and new for a short while. Mitigation: do it at a quiet hour.
