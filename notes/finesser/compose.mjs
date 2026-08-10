#!/usr/bin/env node
/* compose.mjs — reproduce a WP page EXACTLY the way the plugin renders it, locally.
 *
 * Mirrors vcc_render_page() + vcc_chrome() in website/wp-mu-plugin/vc-clients-embed.php:
 *   shared CSS  →  <div class="brgw brgw-shell">  header + fragment + footer  </div>  →  shared JS
 * Nav links are built from website/pages.json, active link gets .is-active — same as PHP.
 *
 * This is a Finesser TOOL, not shipped content. It lives outside website/ on purpose
 * (website/ is the Netlify publish dir — anything in there goes to the CDN).
 *
 * Usage:
 *   node notes/finesser/compose.mjs                 # compose every slug from local files
 *   node notes/finesser/compose.mjs home team       # compose just those slugs
 *   node notes/finesser/compose.mjs --live          # compose from blacktoprg.netlify.app instead
 *   node notes/finesser/compose.mjs --serve         # compose all, then serve on :8787
 *   node notes/finesser/compose.mjs --serve --port=9000
 *
 * Output: notes/finesser/.out/<slug>.html  (gitignored) + an index listing them.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SITE = join(REPO, 'website');
const OUT = join(HERE, '.out');
const BASE = 'https://blacktoprg.netlify.app'; // matches VCC_CLIENTS['brg']['base']
const VERSION = '2.0.0';                        // matches VCC_VERSION

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const slugArgs = argv.filter((a) => !a.startsWith('--'));
const LIVE = flags.has('--live');
const PORT = Number((argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 8787);

/* ── source: local repo files, or the live CDN (to verify what actually deployed) ── */
async function src(path) {
  if (LIVE) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`${res.status} ${BASE + path}`);
    return res.text();
  }
  return readFile(join(SITE, path.replace(/^\//, '')), 'utf8');
}

/* ── vcc_chrome() — header nav from pages.json + footer ────────────────────────── */
function chrome(pages, current) {
  const links = pages
    .map((pg) => {
      const slug = String(pg.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!slug) return '';
      const title = pg.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const url = slug === 'home' ? '/' : `/${slug}/`;
      const cls = slug === current ? ' class="is-active"' : '';
      return `<a href="${url}"${cls}>${title}</a>`;
    })
    .join('');
  return [
    '<header class="brgw-header"><a class="brgw-logo" href="/"><b>BLACKTOP</b>' +
      '<span>Restaurant Group</span></a><nav class="brgw-nav">' + links + '</nav></header>',
    '<footer class="brgw__footer reveal"><div class="lockup anim-up"><b>BLACKTOP</b><br>Restaurant Group</div></footer>',
  ];
}

/* ── the host page. NOT part of the fragment — this stands in for WordPress/Oxygen
      wrapping our shortcode output. Deliberately minimal so anything we see is ours. ── */
const host = (slug, body) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRG compose-test · ${slug}${LIVE ? ' (live CDN)' : ''}</title>
<style>html,body{margin:0;padding:0;background:#131210;}</style>
</head><body>
${body}
</body></html>
`;

/* Shipped CSS/markup references assets absolutely (https://blacktoprg.netlify.app/assets/…)
   because the plugin inlines it into a page on blacktoprestaurantgroup.com, where a relative
   path would resolve against WordPress. Locally that would mean every shot shows the LIVE
   assets — or nothing at all before a push — so point them at our own server instead.
   Skipped under --live, where hitting the real CDN is the entire point. */
const local = (s) => (LIVE ? s : s.replaceAll(`${BASE}/assets/`, '/assets/'));

async function compose(slug, pages, css, js) {
  const frag = local(await src(`/${slug}/embed.html`));
  const [header, footer] = chrome(pages, slug);
  const body =
    `\n<!-- vc_embed brg/${slug} v${VERSION} -->\n` +
    `<style id="vcc-brg-css">${css}</style>` +
    `<div class="brgw brgw-shell">${header}${frag}${footer}</div>` +
    `<script id="vcc-brg-js">${js}</script>`;
  await writeFile(join(OUT, `${slug}.html`), host(slug, body));
  return slug;
}

async function main() {
  const pages = JSON.parse(await src('/pages.json'));
  const css = local(await src('/assets/brgw.css'));
  const js = local(await src('/assets/brgw.js'));
  const slugs = slugArgs.length ? slugArgs : pages.map((p) => p.slug);

  await mkdir(OUT, { recursive: true });
  for (const slug of slugs) {
    await compose(slug, pages, css, js);
    console.log(`composed  ${slug}  →  notes/finesser/.out/${slug}.html`);
  }

  await writeFile(
    join(OUT, 'index.html'),
    host('index', `<div style="font:14px/2 system-ui;padding:40px;color:#fff">` +
      `<b>BRG compose-test</b>${LIVE ? ' — from the live CDN' : ' — from local repo files'}<br>` +
      slugs.map((s) => `<a style="color:#FCE200" href="/${s}.html">${s}</a>`).join('<br>') + `</div>`)
  );

  if (flags.has('--serve')) serve();
}

/* ── tiny static server so the browser sees a real http:// origin (fonts, IO, etc.) ── */
function serve() {
  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.woff2': 'font/woff2', '.css': 'text/css', '.js': 'text/javascript',
  };
  createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // /assets/** serves the real repo assets (fonts, media) so a local shot is faithful.
    const root = path.startsWith('/assets/') ? SITE : OUT;
    const file = join(root, path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
    if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  }).listen(PORT, () => {
    console.log(`\nserving  http://localhost:${PORT}/  (Ctrl-C to stop)`);
    readdir(OUT).then((f) => f.filter((n) => n.endsWith('.html') && n !== 'index.html')
      .forEach((n) => console.log(`         http://localhost:${PORT}/${n}`)));
  });
}

main().catch((e) => { console.error('compose failed:', e.message); process.exit(1); });
