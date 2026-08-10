#!/usr/bin/env node
/* shot.mjs — deterministic screenshots of a composed page. Zero dependencies:
 * drives a local Chrome over the DevTools Protocol using Node's built-in WebSocket.
 *
 * Why not the in-app browser pane: its captures go stale when the pane is hidden, and
 * it can't be scripted per-turn. This can, so "screenshot before DONE" is one command.
 *
 * Usage (server from compose.mjs --serve must be running):
 *   node notes/finesser/shot.mjs home                     # desktop 1440 + mobile 390, full page
 *   node notes/finesser/shot.mjs home team community      # several pages
 *   node notes/finesser/shot.mjs home --fold              # above-the-fold only (no full-page)
 *   node notes/finesser/shot.mjs home --no-reveal         # don't force reveals; capture as-loaded
 *   node notes/finesser/shot.mjs home --port=8787
 *
 * --reveal (default ON for full-page): after load, adds .is-in to every .reveal section so
 * below-the-fold content sits in its FINAL state. IntersectionObserver never fires for
 * off-screen sections in a single capture, so without this a full-page shot is mostly blank.
 * It sets the same class the engine sets — it does not modify the shared engine.
 *
 * Output: notes/finesser/.out/shots/<slug>-<device>.png
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, '.out', 'shots');

const argv = process.argv.slice(2);
const slugs = argv.filter((a) => !a.startsWith('--'));
const has = (f) => argv.includes(f);
const PORT = Number((argv.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 8787);
const FOLD = has('--fold');
const REVEAL = !has('--no-reveal');
// Budget for the readiness poll below (not a fixed sleep) — must clear brgw.js's 3.5s
// hard fallback plus font fetch on a cold profile.
const SETTLE = Number((argv.find((a) => a.startsWith('--settle=')) || '').split('=')[1] || 12000);

/* Devices: mirrors what we actually check — a 1440 desktop and a small-phone width.
   390 is above the 560px doodle-hide breakpoint's target, so it exercises that rule. */
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dsf: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dsf: 2, mobile: true },
];

function chromeBinary() {
  const cands = [
    process.env.BRGW_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // puppeteer's cached Chrome-for-Testing is a fallback only: on this machine it is
    // present but fails to launch, so the system Chrome is tried first.
    join(homedir(), '.cache/puppeteer/chrome/mac-148.0.7778.97/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  ].filter(Boolean);
  const hit = cands.find((p) => existsSync(p));
  if (!hit) throw new Error('no Chrome found — set BRGW_CHROME=/path/to/chrome');
  return hit;
}

/* ── minimal CDP client over the built-in WebSocket (Node 22+) ─────────────────── */
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].method === msg.method) { waiters[i].resolve(msg.params); waiters.splice(i, 1); }
      }
    }
  });
  const open = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', () => rej(new Error('CDP socket failed')));
  });
  return {
    open,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method, timeout = 15000) {
      return new Promise((resolve) => {
        waiters.push({ method, resolve });
        setTimeout(resolve, timeout);
      });
    },
    close: () => ws.close(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Poll the page until the reveal engine has actually run (every .anim-head un-hidden)
   and the display font has resolved. Returns what it saw so a shot taken with a
   fallback font, or before the engine ran, is reported instead of quietly shipped. */
const PROBE = `(function(){
  var root = document.querySelector('.brgw');
  var heads = [].slice.call(document.querySelectorAll('.anim-head'));
  return JSON.stringify({
    init: !!(root && root.dataset.animInit === '1'),
    heads: heads.length,
    shown: heads.filter(function(e){ return getComputedStyle(e).opacity === '1'; }).length,
    blanco: !!(document.fonts && document.fonts.check("1em 'Blanco Cavelary'"))
  });
})()`;

/* --probe: dump reveal-engine state after the gate has had time to run. Answers
   "which root failed to init, and which heading is still hidden" without guessing. */
const DIAG = `new Promise(function(res){ setTimeout(function(){
  var roots = [].slice.call(document.querySelectorAll('.brgw')).filter(function(r){
    return !(r.parentElement && r.parentElement.closest('.brgw'));
  });
  res(JSON.stringify({
    topLevelRoots: roots.length,
    inited: roots.map(function(r){ return r.dataset.animInit === '1'; }),
    blanco: document.fonts.check("1em 'Blanco Cavelary'"),
    reveals: document.querySelectorAll('.reveal').length,
    isIn: document.querySelectorAll('.reveal.is-in').length,
    heads: [].map.call(document.querySelectorAll('.anim-head'), function(e){
      return { txt: e.textContent.trim().slice(0,24), op: getComputedStyle(e).opacity,
               split: !!e.querySelector('.ln'), h: Math.round(e.getBoundingClientRect().height) };
    })
  }, null, 1));
}, 6000); })`;

async function until(c, budget) {
  const t0 = Date.now();
  let last = { ready: false, blanco: false };
  while (Date.now() - t0 < budget) {
    const r = await c.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    const s = JSON.parse(r.result.value || '{}');
    last = { ready: !!s.init && s.shown === s.heads, blanco: !!s.blanco, ...s };
    if (last.ready && last.blanco) break;
    await sleep(250);
  }
  await sleep(1200); // transitions/stagger land after the engine flips them on
  return last;
}

async function waitForPort(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await sleep(150);
  }
  throw new Error('Chrome did not expose its debug port');
}

async function main() {
  if (!slugs.length) { console.error('usage: node notes/finesser/shot.mjs <slug> [...]'); process.exit(1); }
  await mkdir(SHOTS, { recursive: true });

  /* Reap orphans from earlier crashed runs. They hold their debug port and compete for
     CPU; once ~9 had piled up, new launches stopped binding a port at all ("Chrome did
     not expose its debug port") and readiness polls got starved.
     Matched on OUR profile path only — never a bare "Google Chrome" pattern, which would
     kill the user's real browser. `pkill -f` is wrong here: its own `sh -c` command line
     contains the pattern, so it matches itself and dies before killing anything. */
  try {
    const mine = execSync('ps -eo pid,command', { encoding: 'utf8' })
      .split('\n')
      .filter((l) => l.includes(`user-data-dir=${tmpdir()}`) && l.includes('brgw-shot-'))
      .map((l) => Number(l.trim().split(/\s+/)[0]))
      .filter((pid) => pid && pid !== process.pid);
    for (const pid of mine) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    if (mine.length) console.log(`reaped ${mine.length} orphaned headless Chrome(s)`);
  } catch {}

  const dbg = 9333 + (process.pid % 400);
  const profile = join(tmpdir(), 'brgw-shot-' + process.pid);
  const chrome = spawn(chromeBinary(), [
    '--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-color-profile=srgb', '--disable-gpu',
    // Without these, a headless tab is treated as backgrounded: timers are throttled and
    // the webfont never resolves, so brgw.js's font gate never fires and every .anim-head
    // stays at opacity 0. Shots came back with the headlines missing until these went in.
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (b) => { chromeErr += b; });

  try {
    await waitForPort(`http://127.0.0.1:${dbg}/json/version`)
      .catch((e) => { throw new Error(e.message + (chromeErr ? '\nchrome said: ' + chromeErr.split('\n')[0] : '')); });

    for (const slug of slugs) {
      for (const dev of DEVICES) {
        const tab = await (await fetch(`http://127.0.0.1:${dbg}/json/new?about:blank`, { method: 'PUT' })).json();
        const c = cdp(tab.webSocketDebuggerUrl);
        await c.open;
        await c.send('Page.enable');
        await c.send('Emulation.setDeviceMetricsOverride', {
          width: dev.width, height: dev.height, deviceScaleFactor: dev.dsf, mobile: dev.mobile,
        });

        const loaded = c.once('Page.loadEventFired');
        await c.send('Page.navigate', { url: `http://localhost:${PORT}/${slug}.html` });
        await loaded;

        // Assert readiness rather than guessing with a sleep: brgw.js gates the reveal on
        // the Blanco font (1.8s race / 3.5s hard fallback) and only IT clears .anim-head's
        // opacity:0 — so a shot taken early silently loses every display headline.
        if (has('--probe')) {
          const r = await c.send('Runtime.evaluate', { expression: DIAG, returnByValue: true, awaitPromise: true });
          console.log(`\n── ${slug} @ ${dev.width}px ──\n${r.result.value}`);
          await c.send('Target.closeTarget', { targetId: tab.id }).catch(() => {});
          c.close(); continue;
        }
        const state = await until(c, SETTLE);
        if (!state.ready) console.warn(`  ⚠ ${slug}/${dev.name}: reveal engine never ran — shot is not trustworthy · ${JSON.stringify(state)}`);
        if (!state.blanco) console.warn(`  ⚠ ${slug}/${dev.name}: Blanco Cavelary did NOT load — headlines are Montserrat fallback`);

        if (REVEAL && !FOLD) {
          await c.send('Runtime.evaluate', {
            expression: "document.querySelectorAll('.reveal').forEach(function(s){s.classList.add('is-in')})",
          });
          await sleep(1600); // let the staggered transitions land
        }
        if (!FOLD) {
          // loading="lazy" images below the fold never enter the viewport during a
          // captureBeyondViewport shot, so they photograph blank. Force them eager and wait
          // for decode. Production keeps lazy — this is a capture-only adjustment.
          await c.send('Runtime.evaluate', {
            awaitPromise: true, returnByValue: true,
            expression: `(function(){
              var imgs=[].slice.call(document.images);
              imgs.forEach(function(i){ i.loading='eager'; if(!i.complete&&i.dataset.src) i.src=i.dataset.src; });
              return Promise.all(imgs.map(function(i){
                return i.decode ? i.decode().catch(function(){}) : Promise.resolve();
              }));
            })()`,
          });
          await sleep(500);
        }
        if (!FOLD) {
          // captureBeyondViewport renders position:sticky against the EXPANDED viewport, which
          // ghosts the sticky header down the page — it looked like a duplicated logo bug for a
          // while. Pin it static for the capture only; --fold captures the real sticky behaviour.
          await c.send('Runtime.evaluate', {
            expression: "document.querySelectorAll('.brgw-header').forEach(function(h){h.style.position='static'})",
          });
        }

        const shot = await c.send('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: !FOLD, optimizeForSpeed: false,
        });
        const file = join(SHOTS, `${slug}-${dev.name}${FOLD ? '-fold' : ''}.png`);
        await writeFile(file, Buffer.from(shot.data, 'base64'));
        console.log(`shot  ${slug}  ${dev.name.padEnd(7)}  ${dev.width}px  →  ${file.replace(HERE + '/', '')}`);

        await c.send('Target.closeTarget', { targetId: tab.id }).catch(() => {});
        c.close();
      }
    }
  } finally {
    chrome.kill();
  }
}

main().catch((e) => { console.error('shot failed:', e.message); process.exit(1); });
