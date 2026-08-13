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
 *   node notes/finesser/compose.mjs --stack --slots=live     # reproduce the v2.5.0 slot-fill bug
 *
 * Output: notes/finesser/.out/<slug>.html  (gitignored) + an index listing them.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SITE = join(REPO, 'website');
const OUT = join(HERE, '.out');
const BASE = 'https://blacktoprg.netlify.app'; // matches VCC_CLIENTS['brg']['base']
const VERSION = '2.6.0';                        // matches VCC_VERSION

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const slugArgs = argv.filter((a) => !a.startsWith('--'));
const LIVE = flags.has('--live');
const PORT = Number((argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 8787);

/* --slots=local (default) mirrors the DEPLOYED plugin, v2.6.0 onward: a section's slots come
   from website/sections/<id>/slots.json, with the inline `slots` block in sections.json as a
   fallback, and `_`-prefixed keys skipped. --slots=live is the HISTORICAL v2.5.0 fill, which
   read the inline block ONLY. Kept, not deleted: it reproduces the regression that v2.6.0
   fixed, and a fill bug is invisible unless you can render both ways and diff. */
const SLOTS_MODE = (argv.find((a) => a.startsWith('--slots=')) || '').split('=')[1] || 'local';

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

/* ── vcc_fill_slots() — {{slot}} substitution ───────────────────────────────────────
      Mirrors website/wp-mu-plugin/vc-clients-embed.php:158-197, escaping included, because
      the escaping is what decides whether a fill is render-identical to the hard-coded copy
      it replaces. There is no shortcode-attr layer here (compose has no attrs) and no ACF
      value, so every slot resolves to its DEFAULT — which is exactly the state a page is in
      before anyone edits it in WordPress, i.e. the state that must stay byte-identical. */

export const escHtml = (s) => String(s)                       // esc_html() — htmlspecialchars ENT_QUOTES
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const escUrl = (s) => String(s)                        // esc_url(), near enough for our URLs
  .replaceAll('&', '&#038;').replaceAll("'", '&#039;');

/* The token grammar, in one place because THREE layers independently hard-code it and all
   three share its blind spot: the plugin's strip (vc-clients-embed.php:217),
   kit/build-acf.py:105, and the orphan check below. All are [a-z0-9_] — no hyphen.
   Consequence, found by @dee 2026-08-13 and verified against the source: the fill is a
   literal str_replace (:215), so a HYPHENATED token fills fine when it's declared, but when
   it ISN'T declared the strip regex cannot match it, so it survives onto the live page as
   visible `{{cta-label}}` text. Same slip as a missing underscore slot, opposite symptom —
   one deletes copy silently, the other prints a token into a screenshot — and `--check` is
   blind to both. Hence GRAMMAR (what the layers can see) and ANY (what a human can type).

   Exported at @dee's ask so the grammar has one definition instead of four. TOKEN_ANY is
   deliberately LOOSER than the layers it describes — that gap IS the bug class, so anything
   consuming these should test ANY-matches against GRAMMAR rather than assume they agree. */
export const TOKEN_ANY = () => /\{\{([^{}]*)\}\}/g;   // factory: /g regexes carry lastIndex
export const TOKEN_GRAMMAR = /^[a-z0-9_]+$/i;

/* Where a section's slots come from. Deliberately two answers — see SLOTS_MODE. */
export async function slotsFor(id, manifest, opts = {}) {
  const mode = opts.mode || SLOTS_MODE;
  const read = opts.read || src;
  let slots = {};
  if (mode === 'local') {
    try {
      const raw = JSON.parse(await read(`/sections/${id}/slots.json`));
      // Keys starting `_` are documentation, not slots — matches kit/build-acf.py:44.
      slots = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
    } catch { /* unreadable / unparseable — same as absent, fall through */ }
  }
  // The plugin's fallback guard is `if ( ! $slots && … )` (:182) — EMPTINESS, not absence.
  // So a slots.json that parses but declares nothing real (e.g. still only a `_note` while
  // it's being drafted) falls back to the inline block exactly as a missing file would.
  // Mirroring that matters: with zero of 18 sections carrying an inline block any more, the
  // real-world outcome is that every token gets stripped — the whole section goes blank.
  if (Object.keys(slots).length) return slots;
  const s = (manifest.sections || []).find((x) => x.id === id);
  return (s && s.slots) || {};
}

export async function fillSlots(frag, id, manifest, opts = {}) {
  const mode = opts.mode || SLOTS_MODE;
  const warn = opts.onWarn || ((m) => console.warn(m));
  const slots = await slotsFor(id, manifest, opts);

  // A hyphen in a DECLARED slot name doesn't break the render (str_replace is literal) but it
  // does produce an ACF field name with a hyphen in it — brg_<id>_cta-label — so flag it here
  // rather than letting it surface as a field that won't save.
  for (const key of Object.keys(slots)) {
    if (!TOKEN_GRAMMAR.test(key)) {
      warn(`  ⚠ ${id}: slot name '${key}' is outside [a-z0-9_] — it fills, but it generates ` +
        `an invalid ACF field name (brg_… _${key}). Rename it with underscores.`);
    }
  }

  for (const [key, def] of Object.entries(slots)) {
    const type = (def && def.type) || 'text';
    let val = (def && def.default) || '';
    if (type === 'url' || type === 'image') val = escUrl(val);
    else if (type === 'html') val = String(val);          // wp_kses_post — passes our markup
    else val = escHtml(val);
    frag = frag.replaceAll(`{{${key}}}`, val);
  }

  // Two distinct failures, deliberately reported apart because the fix differs.
  const leftover = [...frag.matchAll(TOKEN_ANY())].map((m) => m[1]);
  const strippable = [...new Set(leftover.filter((t) => TOKEN_GRAMMAR.test(t)))];
  const literal = [...new Set(leftover.filter((t) => !TOKEN_GRAMMAR.test(t)))];
  if (strippable.length) {
    warn(`  ⚠ ${id}: ${strippable.map((o) => `{{${o}}}`).join(' ')} declared by no slot ` +
      `(--slots=${mode}) — the plugin STRIPS these, so that copy disappears on render`);
  }
  if (literal.length) {
    warn(`  ⚠ ${id}: ${literal.map((o) => `{{${o}}}`).join(' ')} is outside the [a-z0-9_] ` +
      `token grammar — the strip regex CANNOT match it, so if it stays undeclared it renders ` +
      `LITERALLY on the live page. Use underscores.`);
  }
  return frag.replace(/\{\{[a-z0-9_]+\}\}/gi, '');
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

/* Stacked page: the SPEC-001 target shape. Sections emit NO chrome of their own — the
   header and footer are their own shortcodes — and each shortcode emits its own
   .brgw brgw-shell root, which is what brgw.js initialises per-root (brgw.js:55-62).
   Composing it this way is what makes the parity check against the monolith meaningful. */
async function composeStack(page, stack, pages, css, js, manifest) {
  const [header, footer] = chrome(pages, page);
  const parts = [];
  for (const id of stack) {
    try { parts.push(await fillSlots(local(await src(`/sections/${id}/embed.html`)), id, manifest)); }
    catch { console.warn(`  · ${page}: section "${id}" not built yet — skipped`); }
  }
  const shell = (inner) => `<div class="brgw brgw-shell">${inner}</div>`;
  const body =
    `\n<!-- vc_embed brg/${page} STACKED v${VERSION} -->\n` +
    `<style id="vcc-brg-css">${css}</style>` +
    shell(header) + parts.map(shell).join('') + shell(footer) +
    `<script id="vcc-brg-js">${js}</script>`;
  await writeFile(join(OUT, `${page}--stacked.html`), host(`${page} (stacked)`, body));
  return parts.length;
}

async function main() {
  const pages = JSON.parse(await src('/pages.json'));
  const css = local(await src('/assets/brgw.css'));
  const js = local(await src('/assets/brgw.js'));
  const slugs = slugArgs.length ? slugArgs : pages.map((p) => p.slug);

  await mkdir(OUT, { recursive: true });
  for (const slug of slugs) {
    // A slug may be stack-only (e.g. careers-extd, an alternate state with no legacy
    // monolith). That's the normal shape now — the monoliths are the legacy form — so a
    // missing page fragment is a skip, not a failure.
    try {
      await compose(slug, pages, css, js);
      console.log(`composed  ${slug}  →  notes/finesser/.out/${slug}.html`);
    } catch {
      console.log(`composed  ${slug}  —  no monolith fragment (stack-only), skipped`);
    }
  }

  // --stack composes the same pages from section fragments, for the parity check.
  if (flags.has('--stack')) {
    const draft = JSON.parse(await readFile(join(HERE, 'sections.draft.json'), 'utf8'));
    // Slots come from the SHIPPED manifest, not the draft — the plugin reads sections.json.
    const manifest = JSON.parse(await src('/sections.json'));
    console.log(`slots     fill mode --slots=${SLOTS_MODE}` +
      (SLOTS_MODE === 'local' ? '  (DEPLOYED plugin v2.6.0+: sections/<id>/slots.json wins)'
                              : '  (HISTORICAL v2.5.0 fill: sections.json inline ONLY)'));
    for (const page of slugs) {
      const stack = draft.stacks[page];
      if (!stack) { console.warn(`  · no stack defined for "${page}"`); continue; }
      const n = await composeStack(page, stack, pages, css, js, manifest);
      console.log(`stacked   ${page}  ${n}/${stack.length} sections  →  notes/finesser/.out/${page}--stacked.html`);
    }
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

/* Run only when invoked directly, so the fill primitives above can be imported. @dee needs
   slotsFor()/fillSlots() for the slot↔plugin check and couldn't import them while main() ran
   on import — and a second mirror of the same PHP function is the drift this whole tool exists
   to catch, so importing beats copying. escHtml/escUrl/slotsFor/fillSlots are the exported
   surface; they take {mode, read, onWarn} so a caller never inherits our argv. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('compose failed:', e.message); process.exit(1); });
}
