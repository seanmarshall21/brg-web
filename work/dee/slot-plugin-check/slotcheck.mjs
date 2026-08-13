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
/* Source resolution is @finn's, imported not copied (compose.mjs 6aa0722 exports it for this).
   It is one PHP function — vcc_fill_slots()'s slots lookup — and it should have one mirror;
   two would drift silently, which is the thing this tool exists to catch. The split: Finn owns
   "what are this section's slots", this file owns "at what plugin version, from which source,
   and is that a problem". His escaping stays his — byte-parity is compose.mjs's job, not mine. */
import { slotsFor, TOKEN_ANY, TOKEN_STRIPPABLE, TOKEN_SLOT_NAME } from '../../../notes/finesser/compose.mjs';

const pexec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SITE = join(REPO, 'website');
const PHP = join(SITE, 'wp-mu-plugin', 'vc-clients-embed.php');
const BASE = 'https://blacktoprg.netlify.app'; // = VCC_CLIENTS['brg']['base']

/* The version at which vcc_fill_slots() learned to read sections/<id>/slots.json.
   Below this, slots come from the inline `slots` block in sections.json and NOTHING else. */
const SLOTS_JSON_SINCE = '2.6.0';

/* The version at which the strip grammar widened to include `-` (v2.6.1, 04a03a8). This makes
   the GRAMMAR version-dependent, which a single exported constant cannot express — so it is
   derived from the version here rather than imported wholesale. The behavioural difference is
   real and it inverts the symptom of the same typo:
     ≤2.6.0   {{cta-label}} undeclared → outside the strip class → RENDERS LITERALLY (visible)
     ≥2.6.1   {{cta-label}} undeclared → inside it → STRIPPED (silent copy loss)
   @finn has since split the export in two (3d417f7) because the single name meant two things
   after 2.6.1, so this uses the explicit ones: TOKEN_STRIPPABLE = what the plugin's strip can
   match; TOKEN_SLOT_NAME = what a slot may legally be NAMED, since the name becomes an ACF
   field name. Identical sets until 2.6.1, different questions always.
   The pre-2.6.1 strip class is defined locally and deliberately NOT borrowed from
   TOKEN_SLOT_NAME: the two coincide as sets but mean different things, and conflating them is
   the exact mistake the split was made to prevent. It describes a retired version, so it is
   frozen history and cannot drift. */
const HYPHEN_STRIPPED_SINCE = '2.6.1';
const STRIPPABLE_PRE_261 = /^[a-z0-9_]+$/i;
const grammarFor = (v) => (cmp(v, HYPHEN_STRIPPED_SINCE) >= 0 ? TOKEN_STRIPPABLE : STRIPPABLE_PRE_261);

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

  const rawJson = await fetchOne(`/sections/${encodeURIComponent(id)}/slots.json`);
  const jsonPresent = rawJson !== '';

  /* THE resolution — Finn's mirror, not a second one. `mode:'local'` means "prefer
     sections/<id>/slots.json"; any other value skips it, which is exactly what a pre-2.6.0
     plugin does, so the version gate is expressed as the mode rather than as a fork of his
     logic. `read` is our own origin resolver (CDN / repo / fixtures). */
  const slots = await slotsFor(id, manifest, {
    mode: canReadSlotsJson ? 'local' : 'inline-only',
    read: fetchOne,
    onWarn: (m) => notes.push(String(m).trim()),
  });

  /* Diagnostics only — why the resolution came out that way. Deliberately NOT a second
     decision: `source` is derived from what Finn's slotsFor actually returned, by comparing
     it to the candidates, so this can never disagree with the resolution it is describing. */
  let fromJson = {};
  if (canReadSlotsJson && jsonPresent) {
    let d = null;
    try { d = JSON.parse(rawJson); } catch { notes.push('slots.json is not valid JSON — the plugin json_decodes to null and falls through'); }
    if (d && typeof d === 'object') {
      if (Array.isArray(d)) notes.push('slots.json is a JSON ARRAY, not an object — PHP is_array() accepts it and the keys become 0,1,2…, so the slots are numbered, not named');
      const kept = Object.entries(d).filter(([k]) => !String(k).startsWith('_'));
      if (kept.length !== Object.keys(d).length) notes.push(`${Object.keys(d).length - kept.length} \`_\`-prefixed key(s) correctly ignored as documentation`);
      fromJson = Object.fromEntries(kept);
      if (!kept.length) notes.push('slots.json declares no non-`_` keys, so $slots stays empty and the plugin falls back — and with no inline block left anywhere, that fallback now finds NOTHING, so every token strips and the section renders blank');
    }
  }
  const keys = Object.keys(slots);
  const sameAsJson = keys.length && keys.length === Object.keys(fromJson).length
    && keys.every((k) => k in fromJson);
  const source = !keys.length ? null : sameAsJson ? 'slots.json' : 'sections.json (inline)';

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
/* The grammar is @finn's, imported (compose.mjs a52675f) — it was hard-coded in four places
   that all shared its blind spot, which is precisely why the hyphen case was invisible to every
   guard we own. TOKEN_ANY is a factory because a /g regex carries lastIndex between calls.
   The looseness is load-bearing: ANY matches what a human can TYPE, GRAMMAR matches what the
   plugin / build-acf.py / compose.mjs can SEE, and the gap between them IS the bug class — so
   these are tested against each other, never assumed to agree. */
function analyse(frag, slots, grammar) {
  const declared = Object.keys(slots);
  let filled = frag;
  const used = [];
  for (const k of declared) {
    const tok = `{{${k}}}`;
    if (filled.includes(tok)) { used.push(k); filled = filled.split(tok).join('[filled]'); }
  }
  // Deduped on the inner name; `{{x}}` twice is one problem, not two.
  const leftover = [...new Set([...filled.matchAll(TOKEN_ANY())].map((m) => m[1]))];
  const stripped = leftover.filter((n) => grammar.test(n)).map((n) => `{{${n}}}`);
  const literal = leftover.filter((n) => !grammar.test(n)).map((n) => `{{${n}}}`);
  const inert = declared.filter((k) => !used.includes(k));
  /* A slot NAME is a different question from whether a token is strippable: the name becomes
     an ACF field name brg_<id>_<key>, so a hyphen is invalid there regardless of what the
     plugin's strip can match. @finn's TOKEN_SLOT_NAME, explicitly, not the strip grammar. */
  const badKeys = declared.filter((k) => !TOKEN_SLOT_NAME.test(k));
  return { declared, used, stripped, literal, inert, badKeys };
}

/* ── Findings ─────────────────────────────────────────────────────────────────────────── */
const F = {
  STRIPPED: (t) => ({ level: 'BROKEN', msg: `${t.join(' ')} — declared by no slot the plugin can see, so the plugin DELETES this copy on render. Silent and destructive: the page loses text, nothing errors.` }),
  LITERAL: (t, g) => ({ level: 'BROKEN', msg: `${t.join(' ')} — matches no slot AND falls outside the deployed plugin's strip class ${g}, so it is neither filled nor removed. It renders LITERALLY on the live page — a token printed into the design. Usually whitespace or punctuation inside the braces.` }),
  INERT: (k) => ({ level: 'INERT', msg: `slot(s) ${k.join(', ')} have no {{token}} in the fragment — WordPress shows the field, an editor types into it, and nothing changes on the page.` }),
  BLIND: (v) => ({ level: 'BROKEN', msg: `slots.json is served but the DEPLOYED plugin (${v}) reads only the inline block. This is the 2026-08-13 regression: if the inline block is then removed, every token is stripped and the copy renders empty.` }),
  NOSRC: () => ({ level: 'INFO', msg: 'has {{tokens}} but no slot source at all — every token is stripped, so this copy is currently missing from the page.' }),
  /* Single point of failure, but a narrow and closable one. vcc_fetch() caches nothing on
     failure (:79-82) and writes the week-long `_stale` copy only on SUCCESS (:85) — so a
     section whose only source is slots.json, with the inline block deleted, has no net until
     one successful fetch has happened. Any blip before that strips every token.
     PRIMING IT IS CHEAP: any server-side render of the WordPress page runs vcc_fill_slots()
     -> vcc_fetch(), and curl is as good as a browser — WordPress renders server-side, so the
     client is irrelevant. (An earlier version of this message said a curl could not prime it.
     That was wrong: it conflated curling the CDN, which warms nothing, with curling the WP
     page, which is a real render. Corrected by conti 2026-08-13, who had already primed both
     live sections that way.)
     A filled render is itself proof that `_stale` is populated, by all three paths: a fresh
     fetch writes it; a primary-transient hit is at most VCC_TTL=120s old and the write that
     created it wrote `_stale` too (120s << 1 week, so it cannot have outlived it); and the
     failure path can only return `_stale` by reading it. */
  NOFALLBACK: (n) => ({ level: 'WARN', msg: `slots.json is the ONLY source — the inline block in sections.json is gone, so there is no fallback. vcc_fetch writes its week-long \`_stale\` copy only on a successful fetch, so until this section has been rendered once, a transient CDN blip strips all ${n} token(s) and the copy renders EMPTY. Prime it by loading the WP page server-side (curl through the gate counts); after that \`_stale\` covers it for a week. This tool reads the CDN, so it cannot see whether priming has happened — check the rendered page.` }),
  /* Promoted from WARN to a failing verdict on @finn's prompt, and the reasoning is that every
     other guard passes it: the token fills (str_replace is literal), and `build-acf.py --check`
     goes GREEN because `used` matches hyphens too, so declared and used agree on both sides.
     What breaks is downstream and silent — the generated ACF field name brg_<id>_cta-label is
     not a legal field name, so the field does not save and the slot is uneditable in wp-admin.
     That is the INERT symptom reached by a different route, so it gets INERT's severity. */
  BADKEY: (k) => ({ level: 'INERT', msg: `slot name(s) ${k.join(', ')} are outside [a-z0-9_] — they FILL correctly and \`build-acf.py --check\` passes them green, but the generated ACF field name (brg_<id>_<name>) inherits the character and will not save, so the slot is uneditable in wp-admin. Rename with underscores.` }),
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
    const a = analyse(frag, r.slots, grammarFor(dep.version));
    const findings = [];
    if (a.stripped.length) findings.push(F.STRIPPED(a.stripped));
    if (a.literal.length) findings.push(F.LITERAL(a.literal, grammarFor(dep.version).source));
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
    ['strips leftover tokens with a preg_replace', /preg_replace\(\s*'\/\\\{\\\{\[[^\]]+\]\+\\\}\\\}\/i'/],
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

  /* The grammar is imported from @finn now, so the assertion that matters is no longer "does my
     copy match the PHP" but "does HIS constant still describe conti's PHP". Behavioural, not
     textual: lift the character class out of the plugin's own strip regex and check the two
     agree on probes chosen to straddle the boundary — `cta-label` is the one that matters, since
     the whole hyphen bug class lives in whether the class contains `-`. */
  const phpClass = php.match(/preg_replace\(\s*'\/\\\{\\\{\[([^\]]+)\]\+\\\}\\\}\/i'/)?.[1];
  if (!phpClass) { bad++; console.log('  \x1b[31mSTALE\x1b[0m could not find the strip regex to compare TOKEN_GRAMMAR against'); }
  else {
    const phpRe = new RegExp(`^[${phpClass}]+$`, 'i');
    const probes = ['heading', 'cta_label', 'CTA_LABEL', 'a1', 'cta-label', 'cta label', 'cta.label', ''];
    const repoV = php.match(/VCC_VERSION'\s*,\s*'([^']+)'/)?.[1] || '0';
    const mine = grammarFor(repoV);
    const dis = probes.filter((p) => phpRe.test(p) !== mine.test(p));
    if (dis.length) { bad++; console.log(`  \x1b[31mSTALE\x1b[0m grammarFor(${repoV}) disagrees with the plugin's [${phpClass}] on: ${dis.map((p) => `"${p}"`).join(', ')}`); }
    else console.log(`  \x1b[32mok  \x1b[0m grammarFor(${repoV}) matches the plugin's own [${phpClass}]`);

    /* @finn asked for this explicitly: assert HIS exported primitives against the PHP too, so
       a drift in compose.mjs fails a test rather than arriving as a message. It already caught
       one — TOKEN_GRAMMAR was the pre-2.6.1 class for a few hours after 2.6.1 shipped. These
       are hard failures now, not informational: compose.mjs is the reference mirror, and a
       reference that has silently stopped describing the plugin is worse than no reference. */
    const fdis = probes.filter((p) => phpRe.test(p) !== TOKEN_STRIPPABLE.test(p));
    if (fdis.length) { bad++; console.log(`  \x1b[31mSTALE\x1b[0m compose.mjs TOKEN_STRIPPABLE disagrees with the plugin's [${phpClass}] on: ${fdis.map((p) => `"${p}"`).join(', ')}`); }
    else console.log(`  \x1b[32mok  \x1b[0m compose.mjs TOKEN_STRIPPABLE matches the plugin's [${phpClass}]`);

    /* TOKEN_SLOT_NAME is NOT checked against the strip class — they are different questions and
       coincided only until 2.6.1. It is checked for what it actually promises: no hyphen, since
       the whole point is that a slot name becomes an ACF field name. */
    const nameOk = !TOKEN_SLOT_NAME.test('cta-label') && TOKEN_SLOT_NAME.test('cta_label');
    if (!nameOk) { bad++; console.log('  \x1b[31mSTALE\x1b[0m compose.mjs TOKEN_SLOT_NAME no longer excludes hyphens — ACF field names would pass validation they should fail'); }
    else console.log('  \x1b[32mok  \x1b[0m compose.mjs TOKEN_SLOT_NAME still excludes hyphens (ACF field-name rule)');

    /* TOKEN_ANY must stay LOOSER than the strip class. The instant they agree, a token the
       plugin cannot see also becomes one this tool cannot see, and the whole class of
       "renders literally" findings goes dark. @finn made the same point from his side. */
    const anyLooser = ['bad.name', 'cta label', 'a b'].every((probe) => {
      const m = [...`{{${probe}}}`.matchAll(TOKEN_ANY())];
      return m.length === 1 && !phpRe.test(probe);
    });
    if (!anyLooser) { bad++; console.log('  \x1b[31mSTALE\x1b[0m TOKEN_ANY is no longer looser than the strip class — out-of-grammar tokens would stop being detected'); }
    else console.log('  \x1b[32mok  \x1b[0m TOKEN_ANY is still looser than the strip class (the gap IS the bug class)');
  }
  const v = php.match(/VCC_VERSION'\s*,\s*'([^']+)'/)?.[1];
  console.log(`\n  repo plugin version ${v} · slots.json support assumed from ${SLOTS_JSON_SINCE}\n`);
  if (bad) console.log(`  \x1b[31m${bad} assumption(s) no longer hold — this tool is lying until they are fixed.\x1b[0m\n`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error('slotcheck failed:', e.message); process.exit(2); });
