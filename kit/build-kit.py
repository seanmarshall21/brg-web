#!/usr/bin/env python3
"""Generate the BRG kit — the five pages at blacktoprg.netlify.app/kit/.

Structure mirrors temper/kit (fc-brands), per Sean 2026-08-13:

  /kit/            Build Kit   what we have built      <- website/sections.json + kit/registry.json
  /kit/shortcodes  Shortcodes  how to place it         <- kit/registry.json
  /kit/status      Status      what is live right now  <- the manifests (see the note below)
  /kit/builds      Builds      what we are making      <- notes/builds.json
  /kit/log         Log         what we learned         <- notes/log/*.json

  python3 kit/build-kit.py           regenerate all five
  python3 kit/build-kit.py --check   exit 1 if the committed pages are stale

WHERE OURS DIVERGES FROM TEMPER, AND WHY. Temper's Status page renders
notes/tasks.json — "who is holding the ball". BRG retired that file on
2026-08-13: the board moved to Atlas, and reviving a second board here would
recreate the exact drift we removed. A static page also cannot read Atlas, which
is loopback-only. So our Status answers the question a static page CAN answer
truthfully — what is live right now — and points at the board for the rest.

Pages are written under website/ because that is the Netlify publish dir. The
shortcode index lived outside it for its whole life and 404'd the entire time.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _guard import refuse_if_worktree

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(ROOT, 'kit', 'registry.json')
SECTIONS = os.path.join(ROOT, 'website', 'sections.json')
BUILDS   = os.path.join(ROOT, 'notes', 'builds.json')
LOGDIR   = os.path.join(ROOT, 'notes', 'log')
OUTDIR   = os.path.join(ROOT, 'website', 'kit')
CDN      = 'https://blacktoprg.netlify.app'

NAV = [('index.html', 'Build Kit'), ('shortcodes.html', 'Shortcodes'),
       ('status.html', 'Status'), ('builds.html', 'Builds'), ('log.html', 'Log')]

STAGE = {'shipped': ('#19C7C2', 'shipped'), 'building': ('#FCE200', 'building'),
         'planned': ('rgba(244,241,234,.45)', 'planned'), 'parked': ('#F5821F', 'parked')}

CSS = """
:root{--yellow:#FCE200;--teal:#19C7C2;--pink:#EC0F8D;--bg:#0f0e0d;--bg2:#17150f;--card:#1c1a16;
--line:rgba(255,255,255,.10);--ink:#f4f1ea;--dim:rgba(244,241,234,.58);
--mono:"SFMono-Regular",Menlo,Consolas,monospace;--sans:"Montserrat",system-ui,sans-serif;}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
-webkit-font-smoothing:antialiased;line-height:1.55}
a{color:var(--teal)}
header.top{position:sticky;top:0;z-index:5;background:rgba(15,14,13,.94);backdrop-filter:blur(8px);
border-top:5px solid var(--yellow);border-bottom:1px solid var(--line);padding:18px clamp(20px,4vw,56px);
display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.brand b{background:var(--yellow);color:#231F20;font-weight:800;padding:.1em .4em}
.brand span{font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--dim);margin-left:8px}
nav.kit{display:flex;gap:6px;flex-wrap:wrap}
nav.kit a{font:700 .68rem/1 var(--sans);letter-spacing:.13em;text-transform:uppercase;color:var(--dim);
text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:9px 15px;background:var(--card)}
nav.kit a.on{background:var(--yellow);color:#231F20;border-color:var(--yellow)}
.ver{margin-left:auto;font-family:var(--mono);font-size:.7rem;color:var(--dim);
border:1px solid var(--line);border-radius:999px;padding:7px 13px;white-space:nowrap}
main{padding:26px clamp(20px,4vw,56px) 72px;max-width:1500px}
.lede{max-width:70ch;color:var(--dim);font-size:.94rem;margin:0 0 26px}
.lede strong{color:var(--ink)}
h1{font-size:1.6rem;margin:0 0 6px;font-weight:800;letter-spacing:-.01em}
h2.sec{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--yellow);
margin:38px 0 14px;padding-bottom:9px;border-bottom:1px solid var(--line);font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr));gap:16px;align-items:start}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.card h3{margin:0;font-family:var(--mono);font-size:.9rem;font-weight:600;color:var(--yellow);
padding:14px 16px;background:var(--bg2);border-bottom:1px solid var(--line);word-break:break-word;
display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.card h3 em{font-style:normal;font-size:.6rem;letter-spacing:.09em;color:var(--dim);
font-family:var(--sans);text-transform:uppercase;white-space:nowrap}
.card .body{padding:14px 16px;font-size:.86rem;color:var(--dim)}
.card .body p{margin:0 0 10px}.card .body p:last-child{margin:0}
code,.mono{font-family:var(--mono);font-size:.8rem;background:rgba(255,255,255,.05);
border:1px solid var(--line);border-radius:5px;padding:.15em .45em;color:var(--ink);word-break:break-all}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;vertical-align:top;padding:10px 16px;font-size:.84rem;border-bottom:1px solid var(--line)}
th{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:700;white-space:nowrap}
tr:last-child td{border-bottom:0}
.pill{display:inline-block;font:700 .58rem/1 var(--sans);letter-spacing:.11em;text-transform:uppercase;
padding:5px 10px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.entry{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:14px}
.entry h3{margin:0 0 4px;font-size:1rem;font-weight:700;color:var(--ink)}
.entry .when{font-family:var(--mono);font-size:.7rem;color:var(--dim)}
.entry .what{margin:10px 0 0;font-size:.9rem}
.entry .why{margin:10px 0 0;font-size:.88rem;color:var(--dim);border-left:2px solid var(--teal);padding-left:12px}
.foot{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);color:var(--dim);font-size:.76rem;max-width:78ch}
"""


def esc(t):
    return html.escape(str(t if t is not None else ''), quote=False)


def plugin_version():
    """Stamp the pages with the PLUGIN version, never the commit hash.

    A hash makes the output change on every commit, so --check compares the freshly
    generated page against one built at the previous HEAD and always reports stale —
    a check that can never pass. Caught on the first push after wiring it in: I had
    proved it fails on a hand-edit but never that it passes straight after a commit.
    Half a test.
    """
    f = os.path.join(ROOT, 'website', 'wp-mu-plugin', 'vc-clients-embed.php')
    if os.path.exists(f):
        m = re.search(r"VCC_VERSION',\s*'([0-9.]+)'", open(f).read())
        if m:
            return 'plugin v' + m.group(1)
    return 'BRG'


def shell(page, title, lede, body):
    nav = ''.join(
        '<a href="%s"%s>%s</a>' % (h, ' class="on"' if h == page else '', esc(t))
        for h, t in NAV)
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>BRG kit — %s</title>\n'
        '<!-- GENERATED by kit/build-kit.py — do not edit by hand. Edit the source it names and re-run. -->\n'
        '<style>%s</style></head><body>\n'
        '<header class="top"><div class="brand"><b>BLACKTOP</b><span>kit</span></div>'
        '<nav class="kit">%s</nav><div class="ver">%s</div></header>\n'
        '<main><h1>%s</h1>%s%s\n'
        '<p class="foot">Generated by <code>kit/build-kit.py</code>. '
        'Edit the source, never this page — a hand-edit is overwritten by the next build. '
        'The kit is published from <code>website/kit/</code> because that is the Netlify publish dir.</p>'
        '</main></body></html>\n'
        % (esc(title), CSS, nav, esc(plugin_version()),
           esc(title), lede, body))


# ── /kit/ — what we have built ────────────────────────────────────────────────
def page_kit():
    secs = json.load(open(SECTIONS))
    reg = json.load(open(REGISTRY))
    stacks = secs.get('stacks', {})
    where = {}
    for page, ids in stacks.items():
        for i in ids:
            where.setdefault(i, []).append(page)

    groups = {}
    for s in secs['sections']:
        groups.setdefault(s.get('group', 'other'), []).append(s)

    out = []
    for g in sorted(groups):
        out.append('<h2 class="sec">%s — %d</h2><div class="grid">' % (esc(g), len(groups[g])))
        for s in sorted(groups[g], key=lambda x: x['id']):
            sid = s['id']
            slots = os.path.join(ROOT, 'website', 'sections', sid, 'slots.json')
            n = 0
            if os.path.exists(slots):
                n = len([k for k in json.load(open(slots)) if not k.startswith('_')])
            pages = ', '.join(where.get(sid, [])) or '—'
            out.append(
                '<div class="card"><h3>[brg_%s]<em>%s</em></h3><div class="body">'
                '<p>%s</p><p><strong style="color:var(--ink)">on:</strong> %s &nbsp;·&nbsp; '
                '<strong style="color:var(--ink)">editable fields:</strong> %s</p>'
                '<p><a href="%s/sections/%s/embed.html">fragment</a></p>'
                '</div></div>'
                % (esc(sid), esc(s.get('title', '')), esc(s.get('summary', '')),
                   esc(pages), n if n else 'none yet', CDN, esc(sid)))
        out.append('</div>')

    chrome = [c for c in reg['components'] if c['id'] in ('nav', 'footer')]
    out.append('<h2 class="sec">chrome — on every page</h2><div class="grid">')
    for c in chrome:
        out.append('<div class="card"><h3>[%s]<em>v%s</em></h3><div class="body"><p>%s</p></div></div>'
                   % (esc(c.get('shortcode', c['id'])), esc(c.get('version', 1)),
                      esc(c.get('summary') or c.get('description') or '')))
    out.append('</div>')

    out.append('<h2 class="sec">shared systems</h2><div class="grid">')
    for f, d in [('assets/brgw.css', 'Brand tokens, the reveal engine, the shared slider, doodle loops.'),
                 ('assets/brgw.js', 'Self-inits every .brgw root. One engine only — never add a second.'),
                 ('assets/brgw-nav.css', 'The .bnav component: white bar, yellow rule, marker underline.'),
                 ('assets/brgw-nav.js', 'Distributes items per layout, builds the More drawer and the mobile takeover.')]:
        out.append('<div class="card"><h3>%s</h3><div class="body"><p>%s</p>'
                   '<p><a href="%s/%s">source</a></p></div></div>' % (esc(f), esc(d), CDN, f))
    out.append('</div>')

    lede = ('<p class="lede">Everything built for Blacktop, and where it is used. Each section is one '
            'shortcode; a page is a stack of them between <code>[brg_nav]</code> and '
            '<code>[brg_footer]</code>. <strong>Generated from <code>website/sections.json</code></strong>, '
            'so this page cannot drift from what is actually deployed.</p>')
    return shell('index.html', 'Build Kit', lede, ''.join(out))


# ── /kit/shortcodes — how to place it ─────────────────────────────────────────
def page_shortcodes():
    reg = json.load(open(REGISTRY))
    out = ['<div class="grid">']
    for c in reg['components']:
        rows = ''.join(
            '<tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr>'
            % (esc(a.get('name')), esc(a.get('default', '') or '—'), esc(a.get('doc', '')))
            for a in c.get('attrs', []))
        out.append(
            '<div class="card"><h3>[%s]<em>v%s · %s</em></h3>'
            '<div class="body"><p>%s</p></div>%s</div>'
            % (esc(c.get('shortcode', c['id'])), esc(c.get('version', 1)),
               esc((c.get('contract') or '')[:12]),
               esc(c.get('summary') or c.get('description') or ''),
               ('<table><tr><th>attribute</th><th>default</th><th>what it does</th></tr>%s</table>' % rows)
               if rows else ''))
    out.append('</div>')
    lede = ('<p class="lede">Every BRG shortcode and its attributes. <strong>Generated from '
            '<code>kit/registry.json</code></strong>, which is the source of truth — each component '
            'carries a <code>version</code> and a <code>contract</code> hash of its attribute surface, '
            'so a doc generated from v1 can never quietly be v2\'s markup. Place these in an Oxygen '
            '<em>Shortcode</em> element or a WP Shortcode block, never a Text element.</p>')
    return shell('shortcodes.html', 'Shortcodes', lede, ''.join(out))


# ── /kit/status — what is live right now ──────────────────────────────────────
def page_status():
    secs = json.load(open(SECTIONS))
    plugin = os.path.join(ROOT, 'website', 'wp-mu-plugin', 'vc-clients-embed.php')
    ver = ''
    if os.path.exists(plugin):
        m = re.search(r"VCC_VERSION',\s*'([0-9.]+)'", open(plugin).read())
        ver = m.group(1) if m else ''
    acf = os.path.join(ROOT, 'website', 'acf', 'all.acf.json')
    groups = fields = 0
    if os.path.exists(acf):
        g = json.load(open(acf))
        groups = len(g)
        fields = sum(len([f for f in x['fields'] if f.get('name')]) for x in g)
    wired = sum(1 for s in secs['sections']
                if os.path.exists(os.path.join(ROOT, 'website', 'sections', s['id'], 'slots.json')))

    cards = [('plugin', 'v%s' % ver if ver else '—', 'Deployed by the Action on every push that touches it; the run verifies the version that landed on the server.'),
             ('sections', str(len(secs['sections'])), 'Each one a shortcode. Pages are stacks of them.'),
             ('editable sections', '%d of %d' % (wired, len(secs['sections'])), 'The rest are code on purpose — see Builds for why repeaters are the gap.'),
             ('ACF field groups', str(groups), 'Fetched from Netlify by brg-acf.php. No import step, ever.'),
             ('editable fields', str(fields), 'Change one in wp-admin under Section Content and it is live.')]
    out = ['<div class="grid">']
    for k, v, d in cards:
        out.append('<div class="card"><h3>%s<em>%s</em></h3><div class="body"><p>%s</p></div></div>'
                   % (esc(k), esc(v), esc(d)))
    out.append('</div>')

    out.append('<h2 class="sec">pages</h2><table>'
               '<tr><th>page</th><th>sections</th><th>composition</th></tr>')
    for page, ids in secs.get('stacks', {}).items():
        out.append('<tr><td><code>%s</code></td><td>%d</td><td>%s</td></tr>'
                   % (esc(page), len(ids), esc(' · '.join(ids))))
    out.append('</table>')

    lede = ('<p class="lede">What is live right now, generated from the manifests so it cannot drift. '
            '<strong>This page does not track who is holding the ball</strong> — that is the Atlas '
            'board, which is where work is assigned, ordered and blocked. Temper\'s Status page renders '
            'a task file; BRG retired that file when the board moved to Atlas, and a second board here '
            'would recreate exactly the drift we removed.</p>')
    return shell('status.html', 'Status', lede, ''.join(out))


# ── /kit/builds — what we are making ──────────────────────────────────────────
def page_builds():
    d = json.load(open(BUILDS))
    out = ['<div class="grid">']
    for b in d.get('builds', []):
        col, label = STAGE.get(b.get('stage', 'planned'), STAGE['planned'])
        out.append(
            '<div class="card"><h3>%s<em style="color:%s">%s</em></h3><div class="body">'
            '<p style="color:var(--ink)">%s</p><p>%s</p></div></div>'
            % (esc(b.get('title')), col, esc(label), esc(b.get('what', '')), esc(b.get('note', ''))))
    out.append('</div>')
    lede = ('<p class="lede">Everything we are making and how far along it is. '
            '<strong>Generated from <code>notes/builds.json</code></strong> — edit the JSON, not this '
            'page. Status answers what is live; Log answers what we learned.</p>')
    return shell('builds.html', 'Builds', lede, ''.join(out))


# ── /kit/log — what we learned ────────────────────────────────────────────────
def page_log():
    entries = []
    for f in sorted(os.listdir(LOGDIR)) if os.path.isdir(LOGDIR) else []:
        if not f.endswith('.json'):
            continue
        d = json.load(open(os.path.join(LOGDIR, f)))
        for e in d.get('entries', []):
            e = dict(e)
            e['writer'] = d.get('writer', f[:-5])
            entries.append(e)
    entries.sort(key=lambda e: e.get('date', ''), reverse=True)
    out = []
    for e in entries:
        out.append('<div class="entry"><div class="when">%s · %s</div><h3>%s</h3>'
                   '<p class="what">%s</p><p class="why">%s</p></div>'
                   % (esc(e.get('date')), esc(e.get('writer')), esc(e.get('title')),
                      esc(e.get('what', '')), esc(e.get('why', ''))))
    if not entries:
        out.append('<p class="lede">No entries yet.</p>')
    lede = ('<p class="lede">Discoveries, fixes and decisions that would otherwise only exist in a commit '
            'message nobody re-reads. <strong>Generated from <code>notes/log/&lt;writer&gt;.json</code></strong> '
            '— one file per writer, so two chats writing on the same day never touch the same file.</p>')
    return shell('log.html', 'Log', lede, ''.join(out))


PAGES = {'index.html': page_kit, 'shortcodes.html': page_shortcodes,
         'status.html': page_status, 'builds.html': page_builds, 'log.html': page_log}


def main():
    refuse_if_worktree('kit/build-kit.py')
    check = '--check' in sys.argv
    os.makedirs(OUTDIR, exist_ok=True)
    stale = []
    for name, fn in PAGES.items():
        new = fn()
        path = os.path.join(OUTDIR, name)
        old = open(path).read() if os.path.exists(path) else None
        if check:
            if old != new:
                stale.append(name)
        else:
            open(path, 'w').write(new)
            print('  /kit/%-16s %6d bytes' % (name.replace('index.html', ''), len(new)))
    if check:
        if stale:
            print('  ✗ stale: %s — run: python3 kit/build-kit.py' % ', '.join(stale))
            sys.exit(1)
        print('kit pages: up to date')
    else:
        print('\n5 pages → website/kit/  (live at %s/kit/)' % CDN)


if __name__ == '__main__':
    main()
