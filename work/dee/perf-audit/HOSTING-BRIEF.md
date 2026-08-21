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

## Once the site is public

The response headers show a Cloudflare WordPress integration is already present
(`cf-edge-cache: cache,platform=wordpress`) but every page currently sends
`cache-control: no-cache, must-revalidate` because the site is password-gated. **When
the gate comes off, ask them to confirm full-page edge caching is actually active** —
that alone will hide most of the remaining server time from real visitors.

It will not help wp-admin, and it will not help the first visitor after each cache
purge. The server fixes above are still worth doing.
