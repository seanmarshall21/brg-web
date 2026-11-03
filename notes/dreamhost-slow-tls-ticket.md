# Support note for DreamHost: blacktoprestaurantgroup.com takes ~11 seconds to open

Written 3 Nov 2026 by the BRG Controller chat. Everything below was measured, nothing guessed.

**Subject:** Secure (HTTPS) connection to blacktoprestaurantgroup.com takes about 11 seconds to complete

**Message to send:**

Our site blacktoprestaurantgroup.com (server IP 205.196.208.104) is very slow to open. The delay is in the
secure-connection step (the TLS handshake), before any page code runs, so it is not WordPress or a plugin.

What we measured on 3 Nov 2026:

1. From one Mac, with curl, for the plain static file https://blacktoprestaurantgroup.com/robots.txt:
   connection opened in 0.05 s, then the TLS handshake took 12.5 s, first byte at 12.6 s.
   Repeated for the home page: 11.0 s, 12.6 s, 12.9 s to first byte.
2. From six public test locations (check-host.net, report https://check-host.net/check-report/554c10e7k992),
   the HTTPS check took 11.1 to 11.3 seconds from every one: Barcelona, Nyiregyhaza, Karaganda, Viana,
   Moscow and Maribor. The near-identical time from everywhere suggests a fixed wait on the server,
   not load or distance.
3. A plain-HTTP request to port 80 answers in 0.4 s (that is only the redirect to HTTPS).
4. The certificate presented is for www.blacktoprestaurantgroup.com (TLS 1.3). Our other hosting
   (Netlify) answers its own TLS handshakes in well under a second from the same Mac.

Could you check why the HTTPS handshake on this server waits about 11 seconds? Things we would look at:
OCSP stapling or certificate status lookups timing out, the certificate itself (re-issuing the Let's Encrypt
certificate for the domain), web-server worker or resource limits on this account, and any firewall or
rate limit in front of the site. Thank you.

**Where it goes:** DreamHost panel → Support → Contact Support (or the live chat).
