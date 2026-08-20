#!/usr/bin/env node
/**
 * perfcheck — measure BRG site speed, and fail when it SLIPS from a recorded baseline.
 *
 * Why a baseline rather than a fixed budget: a hardcoded "TTFB < 2s" either passes forever
 * or fails forever, and tells you nothing on the day someone drops a 4MB hero in. Comparing
 * against a committed baseline catches the CHANGE, which is what "say when it slips" asks for.
 *
 * Why median and not mean: one cold-start outlier (I measured 3.69s against a 1.3s typical)
 * drags a mean badly. The median of N tracks the visitor, not the unluckiest request.
 *
 * Repo metrics need no network and are deterministic — they catch a regression at commit time.
 * Live metrics need the network; --offline skips them so this still runs on a plane.
 *
 *   node perfcheck.mjs                 compare against baseline.json, exit 1 on a slip
 *   node perfcheck.mjs --baseline      record current numbers as the new baseline
 *   node perfcheck.mjs --offline       repo metrics only, no network
 *   node perfcheck.mjs --json          machine-readable
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const WEB  = join(REPO, 'website');
const BASELINE = join(HERE, 'baseline.json');
const LIVE = 'https://blacktoprestaurantgroup.com/';
const CDN  = 'https://blacktoprg.netlify.app';

/* How much worse than baseline before we call it a slip. Tuned so ordinary
 * network jitter stays quiet: TTFB on a live WP box moved 1.19-1.40s across a
 * 9-sample run with no deploy at all, so anything under ~25% is noise. */
const TOL = { ttfbPct: 25, bytesPct: 10, countAbs: 0 };

const SAMPLES = 7;

/* ── repo metrics (deterministic, no network) ─────────────────────────────── */

function mediaIndex() {
  const idx = new Map();
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (!idx.has(e.name)) idx.set(e.name, p);
    }
  })(join(WEB, 'assets', 'media'));
  return idx;
}

function sizeOf(idx, url) {
  const f = basename(String(url).split('?')[0].split('#')[0]);
  const p = idx.get(f);
  return p ? statSync(p).size : 0;
}

function repoMetrics() {
  const idx = mediaIndex();
  const secjson = JSON.parse(readFileSync(join(WEB, 'sections.json'), 'utf8'));
  const stacks = secjson.stacks || {};
  const pages = {};
  let imgTotal = 0, eager = 0, withSrcset = 0, withDims = 0;

  for (const [page, ids] of Object.entries(stacks)) {
    let phone = 0, desktop = 0, n = 0, pe = 0;
    for (const id of ids) {
      const f = join(WEB, 'sections', id, 'embed.html');
      if (!existsSync(f)) continue;
      const html = readFileSync(f, 'utf8');
      // [\s\S] not . — img tags in this repo span newlines, and a single-line
      // regex silently reported "0 srcset" on a page that had it. Kept explicit.
      for (const m of html.matchAll(/<img\b[\s\S]*?>/g)) {
        const tag = m[0];
        n++; imgTotal++;
        if (!/loading=/.test(tag)) { pe++; eager++; }
        if (/width=/.test(tag) && /height=/.test(tag)) withDims++;
        const ss = tag.match(/srcset="([\s\S]*?)"/);
        if (ss) {
          withSrcset++;
          const cands = ss[1].split(',')
            .map(s => s.trim().split(/\s+/))
            .filter(a => a.length === 2)
            .map(([u, w]) => ({ u, w: parseInt(w) }))
            .sort((a, b) => a.w - b.w);
          if (cands.length) { phone += sizeOf(idx, cands[0].u); desktop += sizeOf(idx, cands.at(-1).u); continue; }
        }
        const src = tag.match(/src="([^"]+)"/);
        const s = src ? sizeOf(idx, src[1]) : 0;
        phone += s; desktop += s;
      }
    }
    pages[page] = { imgs: n, phoneKB: Math.round(phone / 1024), desktopKB: Math.round(desktop / 1024), eager: pe };
  }
  return { pages, totals: { imgTotal, eager, withSrcset, withDims } };
}

/* ── live metrics (network) ───────────────────────────────────────────────── */

const curl = (args) => execFileSync('curl', args, { encoding: 'utf8', timeout: 30000 });

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function liveMetrics() {
  const ttfbs = [];
  for (let i = 0; i < SAMPLES; i++) {
    try { ttfbs.push(parseFloat(curl(['-sS', '-o', '/dev/null', '-w', '%{time_starttransfer}', LIVE]))); }
    catch { /* one failed sample must not void the run */ }
  }
  const assets = {};
  for (const a of ['assets/brgw.css', 'assets/brgw.js', 'assets/brgw-nav.css', 'assets/brgw-nav.js']) {
    try {
      const out = curl(['-sS', '-o', '/dev/null', '-H', 'Accept-Encoding: br, gzip',
                        '-w', '%{size_download}', `${CDN}/${a}`]);
      assets[a] = Math.round(parseInt(out) / 1024 * 10) / 10;
    } catch { assets[a] = null; }
  }
  return {
    ttfbMedian: ttfbs.length ? Math.round(median(ttfbs) * 1000) / 1000 : null,
    ttfbSamples: ttfbs.length,
    ttfbMin: ttfbs.length ? Math.min(...ttfbs) : null,
    ttfbMax: ttfbs.length ? Math.max(...ttfbs) : null,
    assetsKB: assets,
  };
}

/* ── compare ──────────────────────────────────────────────────────────────── */

function compare(base, now) {
  const slips = [];
  const pct = (a, b) => b === 0 ? 0 : ((a - b) / b) * 100;

  if (base.live?.ttfbMedian && now.live?.ttfbMedian) {
    const d = pct(now.live.ttfbMedian, base.live.ttfbMedian);
    if (d > TOL.ttfbPct)
      slips.push(`TTFB median ${base.live.ttfbMedian}s -> ${now.live.ttfbMedian}s (+${d.toFixed(0)}%)`);
  }
  for (const [p, cur] of Object.entries(now.repo.pages)) {
    const b = base.repo.pages[p];
    if (!b) { slips.push(`new page "${p}" — no baseline, weighs ${cur.phoneKB}KB on phone`); continue; }
    const d = pct(cur.phoneKB, b.phoneKB);
    if (d > TOL.bytesPct)
      slips.push(`${p} phone weight ${b.phoneKB}KB -> ${cur.phoneKB}KB (+${d.toFixed(0)}%)`);
    if (cur.eager > b.eager + TOL.countAbs)
      slips.push(`${p} eager images ${b.eager} -> ${cur.eager}`);
  }
  const bt = base.repo.totals, nt = now.repo.totals;
  if (nt.withSrcset < bt.withSrcset) slips.push(`srcset images went DOWN: ${bt.withSrcset} -> ${nt.withSrcset}`);
  if (nt.withDims < bt.withDims)     slips.push(`images with width+height went DOWN: ${bt.withDims} -> ${nt.withDims} (layout shift)`);
  return slips;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const offline = argv.includes('--offline');
const wantJson = argv.includes('--json');
const record = argv.includes('--baseline');

const now = { at: new Date().toISOString(), repo: repoMetrics(), live: offline ? null : liveMetrics() };

if (wantJson) { console.log(JSON.stringify(now, null, 2)); process.exit(0); }

console.log('\nperfcheck — BRG site speed\n');
const t = now.repo.totals;
console.log(`  images: ${t.imgTotal} total · ${t.eager} eager · ${t.withSrcset} with srcset · ${t.withDims} with width+height`);
for (const [p, m] of Object.entries(now.repo.pages))
  console.log(`    ${p.padEnd(17)} ${String(m.phoneKB).padStart(5)}KB phone  ${String(m.desktopKB).padStart(5)}KB desktop  ${m.eager}/${m.imgs} eager`);
if (now.live) {
  console.log(`\n  live TTFB: median ${now.live.ttfbMedian}s  (min ${now.live.ttfbMin?.toFixed(3)}s / max ${now.live.ttfbMax?.toFixed(3)}s, n=${now.live.ttfbSamples})`);
  for (const [a, kb] of Object.entries(now.live.assetsKB)) console.log(`    ${a.padEnd(22)} ${kb}KB wire`);
} else console.log('\n  live checks skipped (--offline)');

if (record) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
  console.log(`\n  baseline recorded -> ${basename(BASELINE)}\n`);
  process.exit(0);
}
if (!existsSync(BASELINE)) {
  console.log('\n  no baseline yet — run with --baseline to record one\n');
  process.exit(0);
}
const slips = compare(JSON.parse(readFileSync(BASELINE, 'utf8')), now);
if (slips.length) {
  console.log(`\n  SLIPPED (${slips.length}):`);
  for (const s of slips) console.log(`    ✗ ${s}`);
  console.log();
  process.exit(1);
}
console.log('\n  no slip against baseline\n');
