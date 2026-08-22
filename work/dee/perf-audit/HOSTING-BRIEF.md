# Hosting brief — blacktoprestaurantgroup.com

Written to be forwarded to the host. Measured 2026-08-21 from a residential
connection in San Diego. Every number is a median of 5 interleaved samples taken in
the same window, so they are comparable to each other rather than to a different hour.

---

## The one measurement that matters

| what was requested | what it exercises | median TTFB |
|---|---|---|
| a static `.js` file | network + Apache, **no PHP** | **0.368s** |
| `/wp-json/` | WordPress PHP boot, **renders no content** | **1.648s** |
| a page with no custom sections | WP + theme | 1.586s |
| a page with 3 custom sections | WP + theme + our plugin | 2.481s |

**Same server. Same connection. Same TLS handshake. The only difference between rows
one and two is PHP executing.**

That isolates roughly **1.2 seconds of pure PHP/MySQL execution before a single byte
of site content exists**. It is not the network (DNS 5ms, TCP 116ms, TLS 170ms), not
the theme, and not the CDN — a static file off the same box is already back in 0.37s.

Google's Core Web Vitals guidance puts a "good" TTFB at **under 800ms**. An empty REST
response here is **1.65s** — roughly twice the threshold before the site does any work.

## What to ask them — in this order

**First, ask what it is today.** They may fix half of it on the spot, and the answers
decide which of the rest is worth paying for:

1. What **PHP version** is the site on?
2. Is **OPcache** enabled, and what is `opcache.memory_consumption`?
3. Is there a **persistent object cache** (Redis or Memcached)?
4. What is `memory_limit`?
5. Is this **shared hosting**, and how many **PHP workers** does the plan get?

**Then the specific asks:**

| ask for | why it is worth it |
|---|---|
| **PHP 8.2 or 8.3** | Typically 30–50% faster than 7.4 on WordPress. Free — it is a toggle. This site already needs 8.2 for the page builder. |
| **OPcache on, 256MB** | Without it PHP recompiles every file on every request. This is the single most common cause of a ~1s floor. Free. |
| **Redis object cache** | The biggest real win, and see the note below — it is currently working *against* us. |
| **`memory_limit` 512M** | The page builder needs it; low memory causes swapping and fatals. |
| **≥4 PHP workers, or move off shared** | On 1–2 workers, concurrent requests queue behind each other. This is usually where "sometimes it's fine, sometimes it's 4 seconds" comes from. |
| **MySQL slow query log + autoloaded options size** | A bloated `wp_options` autoload is a classic 500ms+ tax on every single request. |

## The argument that usually lands

> Our own plugin caches its work using WordPress transients. **Without a persistent
> object cache, every transient read and write is a MySQL query against `wp_options`.**
> So the caching we wrote to make the site faster is currently being served by disk
> and the database. Turning on Redis makes our existing caching actually cache.

That reframes it from "your server is slow" — which invites a defensive answer — to
"a setting on your side is cancelling out optimisation work already done on ours",
which is specific, checkable, and has an obvious fix.

## What we are fixing on our side — say this too

Do not let this land as pure blame; roughly a third of the time is ours and it is
already being worked:

- Our plugin fetches each page section over HTTP **sequentially**, adding ~0.175s per
  section. Being batched/parallelised.
- Its cache expires every 120 seconds, so about every two minutes one visitor pays a
  cold render — **measured at 4.29s against a ~1.4s warm one**. TTL is being raised.
- Two remote fetches currently run on *every* WordPress request, including wp-admin.
  Being guarded so they only run when a page actually needs them.

**Note this last one for them specifically:** it means the admin is paying for it too,
so if the client says wp-admin feels slow, that is partly ours and it is being fixed.

## Tested publicly on 2026-08-22 — there is no CDN and no page cache

The gate was dropped for a live test, so this is measured rather than assumed. It
changes the conclusion, so read this before the section above.

**1. Cloudflare is not in front of this site at all.** The responses carry a
`cf-edge-cache: cache,platform=wordpress` header, which is what made it look like a CDN
was configured. It is not — that header is emitted by a Cloudflare *WordPress plugin*
and nothing is consuming it. There is **no `cf-ray` and no `cf-cache-status` header**,
the nameservers are `ns1/ns2/ns3.dreamhost.com`, and the A record `205.196.208.104` is
not a Cloudflare address. Cloudflare is not merely unproxied — it is absent.

**2. Nothing is caching pages.** Requesting each page with a unique query string, which
forces the origin to do real work, costs the **same** as a normal request:

| page | normal request | cache-busted |
|---|---|---|
| home-solo | 2.232s | 2.722s |
| team | 2.949s | 3.870s |
| community | 3.726s | 2.836s |

If a page cache existed, the normal column would be dramatically faster. It is not. Every
request runs full PHP. (The origin does now send `cache-control: max-age=600` once public,
but with no CDN that only helps a repeat visitor's own browser — never a first view.)

**3. This is shared hosting.** The serving IP reverse-resolves to
`apache2-daisy.pdx1-shared-a2-09.dreamhost.com` — DreamHost shared, Portland. That is
consistent with the variance: the same page measured 1.3s and 4.7s on different runs,
which is what CPU contention from other tenants looks like.

### What this means for the decision

The hoped-for escape hatch is gone. There is no edge cache to hide the server time, so
**every visitor pays the full ~2–3s**, and the upgrade is not optional polish.

Two fixes, and the first is nearly free:

- **Put Cloudflare in front.** The WordPress plugin is already installed; the DNS simply
  never moved. Even the free tier would cache pages at the edge and take most of this off
  the origin. This is the highest value per pound available here **by a wide margin**.
- **Get off shared hosting.** DreamHost's own VPS or managed WordPress ends the CPU
  contention. The PHP/OPcache/Redis asks above apply either way, and on shared hosting
  some of them may simply not be available — worth asking before paying for anything.
