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
import { readdirSync, existsSync } from 'node:fs';
import { fillSlots } from './compose.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SITE = join(REPO, 'website');
const BASE = 'https://blacktoprg.netlify.app';

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' });
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

/* The fragment as it stood immediately BEFORE this section was wired. */
function baseline(id) {
  const frag = `website/sections/${id}/embed.html`;
  const added = git('log', '--diff-filter=A', '--format=%H', '--', `website/sections/${id}/slots.json`)
    .trim().split('\n').filter(Boolean).pop();
  // No commit yet => the wiring is uncommitted, so HEAD still holds the pre-wiring fragment.
  const rev = added ? `${added}^` : 'HEAD';
  return { rev, html: git('show', `${rev}:${frag}`) };
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ids.length ? ids : readdirSync(join(SITE, 'sections'))
  .filter((d) => existsSync(join(SITE, 'sections', d, 'slots.json'))).sort();

let bad = 0;
for (const id of targets) {
  const manifest = JSON.parse(await read('/sections.json'));
  const live = await fillSlots(await read(`/sections/${id}/embed.html`), id, manifest,
    { mode: 'local', read, onWarn: (m) => console.warn(m) });
  const { rev, html } = baseline(id);
  const ok = norm(html) === norm(live);
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${id.padEnd(22)} vs ${rev.padEnd(10)} ${ok ? 'render-identical' : 'CHANGED'}`);
  if (!ok) {
    // Only report lines with no counterpart anywhere on the other side. An index-based diff
    // reports every line after an insertion, which drowns the actual change — that is how the
    // doc-comment shift first showed up here as "the whole file changed".
    const a = norm(html).split('\n'), b = norm(live).split('\n');
    const bSet = new Set(b), aSet = new Set(a);
    a.filter((l) => !bSet.has(l)).forEach((l) => console.log(`      - ${l}`));
    b.filter((l) => !aSet.has(l)).forEach((l) => console.log(`      + ${l}`));
  }
}
console.log(bad
  ? `\n${bad} section(s) CHANGED. A wiring must leave the page identical until someone edits it in WP.`
  : `\n${targets.length} section(s): every wired section renders exactly what it rendered before wiring.`);
process.exit(bad ? 1 : 0);
