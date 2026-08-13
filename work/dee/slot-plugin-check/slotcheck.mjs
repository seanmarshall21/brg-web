#!/usr/bin/env node
/* slotcheck.mjs — will the DEPLOYED plugin actually fill this section's {{tokens}}?
 *
 * `kit/build-acf.py --check` asks whether the REPO agrees with ITSELF: every slot has a
 * {{token}} and vice versa. Both halves are files in this repo, so it can be green while the
 * live page renders wrong — which is exactly what happened on 2026-08-13. The plugin does not
 * read the repo. It reads the CDN, with the code that is deployed on the server, and those are
 * three different clocks:
 *
 *     repo files  →  Netlify CDN  →  the PHP running on the WP box
 *     (--check)      (a deploy)      (a mu-plugin deploy + a TTL)
 *
 * This tool asks the other question: given what the CDN serves RIGHT NOW and the plugin version
 * that is ACTUALLY on the server, does each {{token}} get a value — and which source won.
 *
 * It is a Dee throwaway (work/dee/), not shipped code. Whether any of it graduates into kit/ or
 * .githooks/ is conti's call.
 *
 * Usage
 *   node slotcheck.mjs                        every section, live CDN, plugin auto-detected
 *   node slotcheck.mjs community-partner      just this one
 *   node slotcheck.mjs --from=local           repo files instead of the CDN
 *   node slotcheck.mjs --from=fixtures        the synthetic cases that prove the detector works
 *   node slotcheck.mjs --plugin=2.5.0         simulate the OLD fill (shows the regression)
 *   node slotcheck.mjs --drift                repo vs CDN — what is written but not deployed
 *   node slotcheck.mjs --selftest             assert this mirror still matches the real PHP
 *   node slotcheck.mjs --json                 machine-readable
 *
 * Exit code 0 = nothing found, 1 = at least one finding. (So it COULD be a hook one day.)
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const pexec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SITE = join(REPO, 'website');
const PHP = join(SITE, 'wp-mu-plugin', 'vc-clients-embed.php');
const BASE = 'https://blacktoprg.netlify.app'; // = VCC_CLIENTS['brg']['base']

/* The version at which vcc_fill_slots() learned to read sections/<id>/slots.json.
   Below this, slots come from the inline `slots` block in sections.json and NOTHING else. */
const SLOTS_JSON_SINCE = '2.6.0';

const argv = process.argv.slice(2);
const flag = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
const has = (n) => argv.includes(`--${n}`);
const ids = argv.filter((a) => !a.startsWith('--'));

const FROM = flag('from', 'live');           // live | local | fixtures
const JSONOUT = has('json');
const cmp = (a, b) => {                       // semver-ish compare, enough for x.y.z
  const p = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

/* ── Establishing the deployed plugin version ──────────────────────────────────────────
   This is the fact the whole exercise turns on, and it is NOT the repo's version. The repo
   can be ahead of the server (that was the state all through 2026-08-12: repo 2.5.0, live
   2.4.0). Without the site gate password the only non-guess evidence available to a chat is
   the deploy Action, which SSHes back in after the copy and greps VCC_VERSION out of the file
   that actually landed. That grep is the measurement; everything else is inference. */
async function deployedVersion() {
  const explicit = flag('plugin', 'auto');
  if (explicit !== 'auto') return { version: explicit, source: 'given on the command line' };
  try {
    const { stdout: runs } = await pexec('gh', [
      'run', 'list', '--workflow=deploy-mu-plugins.yml', '-L', '10',
      '--json', 'databaseId,conclusion',
      '--jq', '[.[]|select(.conclusion=="success")][0].databaseId',
    ], { cwd: REPO });
    const id = runs.trim();
    if (!id) throw new Error('no successful deploy run');
    const { stdout: log } = await pexec('gh', ['run', 'view', id, '--log'], {
      cwd: REPO, maxBuffer: 64 * 1024 * 1024,
    });
    // The verify step echoes the deployed line: ... define( 'VCC_VERSION', '2.6.0' );
    const m = log.match(/out:.*VCC_VERSION'\s*,\s*'([0-9][^']*)'/);
    if (!m) throw new Error(`run ${id} has no VCC_VERSION line`);
    return { version: m[1], source: `deploy Action run ${id}, verified on the server` };
  } catch (e) {
    const repoV = (await readFile(PHP, 'utf8')).match(/VCC_VERSION'\s*,\s*'([^']+)'/)?.[1] || '?';
    return {
      version: repoV,
      source: `UNVERIFIED — fell back to the repo's own value (${e.message})`,
      unverified: true,
    };
  }
}

/* ── vcc_fetch(), honestly mirrored ────────────────────────────────────────────────────
   The real one returns '' on any non-200 (:79), so a 404 does NOT poison the JSON parse —
   Netlify's 404 body is an HTML page and would otherwise be truthy at :173. Worth mirroring
   exactly, because "does a missing file fall back or explode" is half the question here. */
async function fetchOne(path) {
  if (FROM === 'live') {
    const res = await fetch(BASE + path);
    return res.ok ? res.text() : '';           // non-200 → '' , same as the plugin
  }
  const root = FROM === 'fixtures' ? join(HERE, 'fixtures') : SITE;
  const file = join(root, path.replace(/^\//, ''));
  return existsSync(file) ? readFile(file, 'utf8') : '';
}

/* ── vcc_fill_slots() source resolution, at a given plugin version ─────────────────────
   Mirrors vc-clients-embed.php:159-190. The version branch is the point: the SAME repo state
   resolves to a different source depending on what is running on the server. */
async function resolveSlots(id, manifest, version) {
  const canReadSlotsJson = cmp(version, SLOTS_JSON_SINCE) >= 0;
  const notes = [];
  let slots = {};
  let source = null;

  const rawJson = await fetchOne(`/sections/${encodeURIComponent(id)}/slots.json`);
  const jsonPresent = rawJson !== '';

  if (canReadSlotsJson && jsonPresent) {
    let d = null;
    try { d = JSON.parse(rawJson); } catch { notes.push('slots.json is not valid JSON — the plugin json_decodes to null and falls through to the inline block'); }
    if (d && typeof d === 'object') {
      if (Array.isArray(d)) notes.push('slots.json is a JSON ARRAY, not an object — PHP is_array() accepts it and the keys become 0,1,2…, so the slots are numbered, not named');
      // `_`-prefixed keys are documentation, not slots (php :178, build-acf.py:44).
      const kept = Object.entries(d).filter(([k]) => !String(k).startsWith('_'));
      if (kept.length !== Object.keys(d).length) notes.push(`${Object.keys(d).length - kept.length} \`_\`-prefixed key(s) correctly ignored as documentation`);
      if (kept.length) { slots = Object.fromEntries(kept); source = 'slots.json'; }
      else notes.push('slots.json declares no non-`_` keys, so $slots stays empty and the plugin FALLS BACK to the inline block');
    }
  }

  // php :182 — `if ( ! $slots && ... )`. The fallback is on EMPTINESS, not on absence.
  if (!Object.keys(slots).length) {
    const inline = (manifest.sections || []).find((s) => s.id === id)?.slots;
    if (inline && Object.keys(inline).length) { slots = inline; source = 'sections.json (inline)'; }
  }

  if (jsonPresent && !canReadSlotsJson) {
    notes.push(`slots.json is on the CDN but the deployed plugin is ${version} — it cannot read it (needs ${SLOTS_JSON_SINCE}+)`);
  }
  const hasInline = !!(manifest.sections || []).find((s) => s.id === id)?.slots;
  return { slots, source, notes, jsonPresent, canReadSlotsJson, hasInline };
}

/* ── What the fill actually does to the fragment ───────────────────────────────────────
   php :191-217: str_replace every declared slot, THEN preg_replace away anything still
   matching /\{\{[a-z0-9_]+\}\}/i. Order matters, and so does that character class — it has
   no hyphen, which produces two DIFFERENT silent failures rather than one. */
const STRIP_RE = /\{\{[a-z0-9_]+\}\}/gi;
const TOKENISH_RE = /\{\{[^}\s]{1,64}\}\}/g;   // anything token-SHAPED, hyphens and all

function analyse(frag, slots) {
  const declared = Object.keys(slots);
  let filled = frag;
  const used = [];
  for (const k of declared) {
    const tok = `{{${k}}}`;
    if (filled.includes(tok)) { used.push(k); filled = filled.split(tok).join('[filled]'); }
  }
  const leftover = [...new Set([...filled.matchAll(TOKENISH_RE)].map((m) => m[0]))];
  const stripped = leftover.filter((t) => new RegExp(`^${STRIP_RE.source}$`, 'i').test(t));
  const literal = leftover.filter((t) => !stripped.includes(t));
  const inert = declared.filter((k) => !used.includes(k));
  const badKeys = declared.filter((k) => !/^[a-z0-9_]+$/.test(k));
  return { declared, used, stripped, literal, inert, badKeys };
}

/* ── Findings ─────────────────────────────────────────────────────────────────────────── */
const F = {
  STRIPPED: (t) => ({ level: 'BROKEN', msg: `${t.join(' ')} — declared by no slot the plugin can see, so the plugin DELETES this copy on render. Silent and destructive: the page loses text, nothing errors.` }),
  LITERAL: (t) => ({ level: 'BROKEN', msg: `${t.join(' ')} — matches no slot AND does not match the strip regex /{{[a-z0-9_]+}}/, so it is neither filled nor removed. It renders LITERALLY on the live page. (Almost always a hyphen where an underscore belongs.)` }),
  INERT: (k) => ({ level: 'INERT', msg: `slot(s) ${k.join(', ')} have no {{token}} in the fragment — WordPress shows the field, an editor types into it, and nothing changes on the page.` }),
  BLIND: (v) => ({ level: 'BROKEN', msg: `slots.json is served but the DEPLOYED plugin (${v}) reads only the inline block. This is the 2026-08-13 regression: if the inline block is then removed, every token is stripped and the copy renders empty.` }),
  NOSRC: () => ({ level: 'INFO', msg: 'has {{tokens}} but no slot source at all — every token is stripped, so this copy is currently missing from the page.' }),
  /* Single point of failure. vcc_fetch() caches nothing on failure (:79-82) and writes the
     week-long `_stale` copy only on SUCCESS (:85) — so a section whose only source is
     slots.json, with the inline block deleted, has no fallback at all until the PLUGIN itself
     has fetched that file successfully once. Before that, any blip means every token is
     stripped and the copy renders empty. A curl from a chat does not warm WP's transient. */
  NOFALLBACK: (n) => ({ level: 'WARN', msg: `slots.json is the ONLY source — the inline block in sections.json is gone, so there is no fallback. vcc_fetch writes its week-long \`_stale\` copy only after a successful fetch, so until the PLUGIN (not a curl) has fetched this file once, a transient CDN blip strips all ${n} token(s) and the copy renders EMPTY. After one successful plugin fetch, \`_stale\` covers it for a week.` }),
  BADKEY: (k) => ({ level: 'WARN', msg: `slot key(s) ${k.join(', ')} are not [a-z0-9_]+ — the generated ACF field name (brg_<id>_<key>) inherits the odd character, and a hyphenated token is outside the plugin's strip regex.` }),
};

async function main() {
  if (has('selftest')) return selftest();

  const dep = await deployedVersion();
  const manifest = JSON.parse((await fetchOne('/sections.json')) || '{"sections":[]}');
  let list = ids.length ? ids : (manifest.sections || []).map((s) => s.id);
  if (FROM === 'fixtures' && !ids.length) {
    list = (await readdir(join(HERE, 'fixtures', 'sections'), { withFileTypes: true }))
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  }

  const out = [];
  for (const id of list) {
    const frag = await fetchOne(`/sections/${encodeURIComponent(id)}/embed.html`);
    if (frag === '') { out.push({ id, findings: [{ level: 'INFO', msg: 'no fragment served at this origin — skipped' }], skipped: true }); continue; }
    const r = await resolveSlots(id, manifest, dep.version);
    const a = analyse(frag, r.slots);
    const findings = [];
    if (a.stripped.length) findings.push(F.STRIPPED(a.stripped));
    if (a.literal.length) findings.push(F.LITERAL(a.literal));
    if (r.jsonPresent && !r.canReadSlotsJson) findings.push(F.BLIND(dep.version));
    if (a.inert.length) findings.push(F.INERT(a.inert));
    if (a.badKeys.length) findings.push(F.BADKEY(a.badKeys));
    if (r.source === 'slots.json' && !r.hasInline && a.used.length) findings.push(F.NOFALLBACK(a.used.length));
    if (a.stripped.length && !r.source) findings.push(F.NOSRC());
    out.push({ id, source: r.source, notes: r.notes, ...a, findings });
  }

  if (JSONOUT) { console.log(JSON.stringify({ deployed: dep, from: FROM, sections: out }, null, 2)); }
  else report(dep, out);

  if (has('drift')) await drift(list);
  process.exit(out.some((s) => s.findings.some((f) => f.level === 'BROKEN' || f.level === 'INERT')) ? 1 : 0);
}

function report(dep, out) {
  const C = { BROKEN: '\x1b[31m', INERT: '\x1b[33m', WARN: '\x1b[33m', INFO: '\x1b[2m', off: '\x1b[0m', dim: '\x1b[2m', b: '\x1b[1m' };
  console.log(`\n${C.b}slotcheck${C.off} — will the deployed plugin fill these tokens?`);
  console.log(`  origin          ${FROM === 'live' ? BASE + '  (what the plugin actually fetches)' : FROM === 'local' ? 'local repo files  (NOT what the plugin reads)' : 'fixtures  (synthetic, to prove the detector)'}`);
  console.log(`  plugin          ${dep.version}   ${C.dim}${dep.source}${C.off}`);
  if (dep.unverified) console.log(`  ${C.WARN}!${C.off} the version above is a guess; the repo can be ahead of the server`);
  console.log('');

  /* "Which source won" is reported for EVERY section, not just the broken ones — a section
     that is fine today because it silently fell back to the inline block is one `sections.json`
     edit away from being broken, and that is invisible if only findings are printed. */
  let clean = 0;
  for (const s of out) {
    if (s.skipped) continue;
    const src = s.source ? s.source : 'nowhere';
    const wired = (s.used?.length || 0) + '/' + ((s.declared?.length) || 0);
    if (!s.findings.length) {
      clean++;
      console.log(`  ${C.b}${s.id}${C.off}  ${C.dim}slots from ${src} · ${wired} filled${C.off}  \x1b[32mok\x1b[0m`);
      for (const n of s.notes || []) console.log(`    ${C.dim}note   ${n}${C.off}`);
      continue;
    }
    console.log(`  ${C.b}${s.id}${C.off}  ${C.dim}slots from ${src} · ${wired} filled${C.off}`);
    for (const f of s.findings) console.log(`    ${C[f.level]}${f.level.padEnd(6)}${C.off} ${f.msg}`);
    for (const n of s.notes || []) console.log(`    ${C.dim}note   ${n}${C.off}`);
    console.log('');
  }
  console.log('');
  const nTok = out.filter((s) => !s.skipped && (s.declared?.length || s.used?.length || s.stripped?.length));
  console.log(`  ${clean} section(s) clean · ${out.filter((s) => s.findings.length && !s.skipped).length} with findings · ` +
    `${out.filter((s) => s.skipped).length} not served here`);
  if (!nTok.length) console.log(`  ${C.dim}nothing is wired yet: no section at this origin has a {{token}} or a slot source.${C.off}`);
  console.log('');
}

/* ── drift: what is in the repo but not on the CDN. The plugin sees only the right column. ── */
async function drift(list) {
  console.log('  \x1b[1mdrift — repo vs CDN\x1b[0m  (the plugin reads the CDN; --check reads the repo)');
  let n = 0;
  for (const id of list) {
    for (const p of [`/sections/${id}/slots.json`, `/sections/${id}/embed.html`]) {
      const local = existsSync(join(SITE, p.replace(/^\//, '')));
      const res = await fetch(BASE + p);
      if (local && !res.ok) { console.log(`    \x1b[31mundeployed\x1b[0m ${p} — in the repo, ${res.status} on the CDN. The plugin cannot see it.`); n++; }
      else if (!local && res.ok) { console.log(`    \x1b[33mstale\x1b[0m      ${p} — served by the CDN, absent from the repo.`); n++; }
    }
  }
  if (!n) console.log('    \x1b[2mnone — repo and CDN agree on every slots.json and fragment.\x1b[0m');
  console.log('');
}

/* ── selftest: does this mirror still describe the real PHP? ───────────────────────────
   A simulator of someone else's code rots the moment they edit it, and it rots SILENTLY —
   which is the exact failure this whole tool exists to catch, so it would be indefensible
   not to guard against it here. These assertions are deliberately about behaviour I depend
   on. If conti changes any of them, this fails loudly instead of quietly lying. */
async function selftest() {
  const php = await readFile(PHP, 'utf8');
  const checks = [
    ['fetches sections/<id>/slots.json', /'\/sections\/'\s*\.\s*rawurlencode\(\s*\$id\s*\)\s*\.\s*'\/slots\.json'/],
    ['skips `_`-prefixed keys', /strpos\(\s*\(string\)\s*\$k,\s*'_'\s*\)\s*!==\s*0/],
    ['falls back only when $slots is empty', /if\s*\(\s*!\s*\$slots\s*&&/],
    ['strips leftovers with [a-z0-9_] and no hyphen', /preg_replace\(\s*'\/\\\{\\\{\[a-z0-9_\]\+\\\}\\\}\/i'/],
    ['vcc_fetch returns empty on non-200', /wp_remote_retrieve_response_code\(\s*\$res\s*\)\s*!==\s*200/],
    ['fills with str_replace on a flat key', /str_replace\(\s*'\{\{'\s*\.\s*\$key\s*\.\s*'\}\}'/],
  ];
  let bad = 0;
  console.log('\n\x1b[1mselftest\x1b[0m — does this mirror still match vc-clients-embed.php?\n');
  for (const [what, re] of checks) {
    const ok = re.test(php);
    if (!ok) bad++;
    console.log(`  ${ok ? '\x1b[32mok  \x1b[0m' : '\x1b[31mSTALE\x1b[0m'} ${what}`);
  }
  const v = php.match(/VCC_VERSION'\s*,\s*'([^']+)'/)?.[1];
  console.log(`\n  repo plugin version ${v} · slots.json support assumed from ${SLOTS_JSON_SINCE}\n`);
  if (bad) console.log(`  \x1b[31m${bad} assumption(s) no longer hold — this tool is lying until they are fixed.\x1b[0m\n`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error('slotcheck failed:', e.message); process.exit(2); });
