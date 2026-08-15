#!/usr/bin/env node
/* verify-wiring.mjs — prove a wired section renders EXACTLY what it rendered before wiring.
 *
 *   node notes/finesser/verify-wiring.mjs              # every section with a slots.json
 *   node notes/finesser/verify-wiring.mjs community-give
 *
 * WHY THIS EXISTS AS A COMMAND. The bar for an ACF wiring is "the page is unchanged until
 * someone edits it in WordPress". I checked that by hand for four sections and got the method
 * WRONG twice — I composed with --live, which reads slots.json from the CDN. For a section
 * not yet pushed there is no slots.json there, so slots came back empty AND the fragment came
 * from the CDN too: both sides of my diff were the old file and it reported identical for the
 * one reason that proves nothing. Same failure shape as every other one on 2026-08-13 — a
 * stale copy carrying the authority of having been measured. So the rule that came out of
 * that day gets applied to the check itself: if a claim matters, make something run it.
 *
 * WHAT IT DOES. Composes LOCALLY (never --live, deliberately — local files are the change
 * under test), fills slots exactly as the plugin does by importing compose.mjs's primitives,
 * then diffs each section against the SAME fragment as it stood immediately before its
 * slots.json was added — `git show <commit-that-added-slots.json>^:<fragment>`, or HEAD when
 * the wiring is still uncommitted.
 *
 * TWO NORMALISATIONS, both narrow and both justified:
 *   1. compose's local() rewrites CDN asset URLs to /assets/ so a local shot is faithful.
 *      That is the harness, not the change. Undone before comparing.
 *   2. esc_html turns ' into &#039; and lets a literal em dash through where the source had
 *      &mdash;. Same glyphs, different bytes, so entities are decoded on BOTH sides. This is
 *      the ONLY licence taken: it means the check proves RENDER-identical, not byte-identical.
 *      Anything else — a moved tag, a lost attribute, a dropped word — still fails.
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fillSlots } from './compose.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SITE = join(REPO, 'website');
const BASE = 'https://blacktoprg.netlify.app';

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const read = (p) => readFile(join(SITE, p.replace(/^\//, '')), 'utf8');

/* Decode the entity forms esc_html introduces, and nothing else. */
const decode = (s) => s
  .replaceAll('&#039;', "'").replaceAll('&mdash;', '—').replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

/* Compare the ELEMENT, not the file. Wiring a section also updates the leading HTML comment
   to record what is editable and what deliberately isn't — an intended change that ships as
   an invisible comment. Diffing whole files makes that shift every following line and buries
   the thing we actually care about. So: from <section to the last </section>. */
const element = (s) => {
  const a = s.indexOf('<section'), b = s.lastIndexOf('</section>');
  return a < 0 || b < 0 ? s : s.slice(a, b + '</section>'.length);
};
const norm = (s) => decode(element(s).replaceAll('/assets/', `${BASE}/assets/`)
  .replaceAll(`${BASE}${BASE}`, BASE));

/* The fragment as it stood immediately BEFORE this section was wired — or, once a section has
   had an APPROVED copy change since, as it stood at the rev that change landed.

   Re-baselining exists because without it this check goes permanently red the first time
   anyone deliberately edits a default, and a gate that is always red is one everyone learns to
   skip. That is not hypothetical: Sean's "Odie's Pizza Co." ruling and my own odd-count CSS fix
   both changed a wired section on purpose, and both are correct.

   To re-baseline, add to the section's slots.json (the `_` prefix means build-acf.py ignores it):
     "_baseline": { "rev": "<sha of the approved change>", "why": "<who approved it and why>" }
   Both sides are then filled with the slots.json of their own rev, so a post-wiring baseline
   compares like for like. Pre-wiring baselines have no slots.json, where filling is a no-op. */
function baseline(id) {
  const frag = `website/sections/${id}/embed.html`;
  const declared = JSON.parse(readFileSync(join(SITE, 'sections', id, 'slots.json'), 'utf8'));
  const pinned = declared._baseline && declared._baseline.rev;
  const added = git('log', '--diff-filter=A', '--format=%H', '--', `website/sections/${id}/slots.json`)
    .trim().split('\n').filter(Boolean).pop();
  // No commit yet => the wiring is uncommitted, so HEAD still holds the pre-wiring fragment.
  const rev = pinned || (added ? `${added}^` : 'HEAD');
  let slotsAtRev = null;
  try { slotsAtRev = JSON.parse(git('show', `${rev}:website/sections/${id}/slots.json`)); }
  catch { /* pre-wiring rev has no slots.json — filling is then a no-op, as intended */ }
  try {
    return { rev, html: git('show', `${rev}:${frag}`), slotsAtRev };
  } catch (e) {
    // A section BORN wired — fragment and slots.json in the same first commit — has no
    // pre-wiring state, so "renders what it rendered before" is vacuous rather than false.
    // The Contact sections are the first of these; before this, every wired section had
    // existed unwired first, and that assumption was silently baked in. It surfaced as the
    // whole verifier CRASHING on all 19, which is worse than the check not existing: a
    // verifier that dies looks like a broken command rather than an unverified change, and
    // I pushed once while it was in that state.
    if (/exists on disk, but not in/.test(String(e.stderr || e))) return { rev, html: null, slotsAtRev };
    throw e;
  }
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ids.length ? ids : readdirSync(join(SITE, 'sections'))
  .filter((d) => existsSync(join(SITE, 'sections', d, 'slots.json'))).sort();

let bad = 0, born = 0;
for (const id of targets) {
  const manifest = JSON.parse(await read('/sections.json'));
  const live = await fillSlots(await read(`/sections/${id}/embed.html`), id, manifest,
    { mode: 'local', read, onWarn: (m) => console.warn(m) });
  const { rev, html, slotsAtRev } = baseline(id);
  if (html === null) {
    born++;
    console.log(`  – ${id.padEnd(22)} ${'born wired'.padEnd(13)} no pre-wiring state to compare`);
    continue;
  }
  const was = slotsAtRev
    ? await fillSlots(html, id, manifest, { mode: 'local', read: async (p) =>
        p.endsWith(`/sections/${id}/slots.json`) ? JSON.stringify(slotsAtRev) : read(p),
        onWarn: () => {} })
    : html;
  const ok = norm(was) === norm(live);
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${id.padEnd(22)} vs ${rev.padEnd(10)} ${ok ? 'render-identical' : 'CHANGED'}`);
  if (!ok) {
    // Only report lines with no counterpart anywhere on the other side. An index-based diff
    // reports every line after an insertion, which drowns the actual change — that is how the
    // doc-comment shift first showed up here as "the whole file changed".
    const a = norm(was).split('\n'), b = norm(live).split('\n');
    const bSet = new Set(b), aSet = new Set(a);
    a.filter((l) => !bSet.has(l)).forEach((l) => console.log(`      - ${l}`));
    b.filter((l) => !aSet.has(l)).forEach((l) => console.log(`      + ${l}`));
  }
}
console.log(bad
  ? `\n${bad} section(s) CHANGED. A wiring must leave the page identical until someone edits it in WP.`
  : `\n${targets.length - born} of ${targets.length} section(s): every section that HAD a pre-wiring `
    + `state renders exactly what it rendered before wiring.`
    + (born ? `\n${born} born wired — nothing to compare, so this check says nothing about them. `
            + `Their slot↔token match still needs build-acf.py --check, and their appearance still `
            + `needs a look.` : ''));
process.exit(bad ? 1 : 0);
