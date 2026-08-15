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
       ('status.html', 'Status'), ('builds.html', 'Builds'), ('log.html', 'Log'),
       ('list.html', 'All Shortcodes')]

STAGE = {'shipped': ('#19C7C2', 'shipped'), 'building': ('#FCE200', 'building'),
         'planned': ('rgba(244,241,234,.45)', 'planned'), 'parked': ('#F5821F', 'parked')}

KIT_JS = r"""
const $=(q,r)=>(r||document).querySelector(q), el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const state={};                                   // id -> {slots:{}, view:'desktop'}
const enc=o=>encodeURIComponent(btoa(JSON.stringify(o)));
const st=id=>state[id]||(state[id]={slots:{},view:'desktop'});

let BUMP=0;
// The cache-buster is load-bearing, not hygiene. Changing only the HASH of an iframe src
// is a fragment navigation: the browser does not re-execute the document, so the fill
// never re-runs and the preview silently keeps showing the old values while the URL
// claims otherwise. A distinct query forces a real load — which is also what makes
// replay work, since replay is just "load it again".
function srcFor(id){const s=st(id);const q=Object.keys(s.slots).length?'#'+enc(s.slots):'';return 'preview/'+id+'.html?r='+(++BUMP)+q;}

function shortcodeFor(sec){
  const s=st(sec.id), parts=[];
  for(const k of Object.keys(s.slots)){
    const v=s.slots[k], d=(sec.slots[k]||{}).default||'';
    if(v!==d) parts.push(k+'="'+String(v).replace(/"/g,'&quot;')+'"');
  }
  return '[brg_'+sec.id+(parts.length?' '+parts.join(' '):'')+']';
}

function reload(id){const f=document.querySelector('[data-frame="'+id+'"]');if(f)f.src=srcFor(id);
  const c=document.querySelector('[data-code="'+id+'"]');const sec=SECTIONS.find(x=>x.id===id);
  if(c)c.textContent=shortcodeFor(sec);
  if($('#full').classList.contains('open')&&$('#full').dataset.id===id)$('#fullframe').src=srcFor(id);}

function controls(sec,host){
  const keys=Object.keys(sec.slots);
  if(!keys.length){host.appendChild(el('p','muted','No editable variables — this section is code by design.'));return;}
  keys.forEach(k=>{
    const def=sec.slots[k]||{}, cur=st(sec.id).slots[k]!==undefined?st(sec.id).slots[k]:(def.default||'');
    const row=el('div','ctl');
    row.appendChild(el('label',null,esc(def.label||k)+' <em>'+esc(k)+'</em>'));
    const long=(def.type==='textarea')||String(cur).length>60;
    const inp=document.createElement(long?'textarea':'input');
    if(!long)inp.type='text';
    inp.value=cur; inp.spellcheck=false;
    inp.addEventListener('input',()=>{st(sec.id).slots[k]=inp.value;clearTimeout(inp._t);inp._t=setTimeout(()=>reload(sec.id),260);});
    row.appendChild(inp);
    if(def.doc)row.appendChild(el('p','hint',esc(def.doc)));
    host.appendChild(row);
  });
  const reset=el('button','btn wide','reset to defaults');
  reset.onclick=()=>{st(sec.id).slots={};host.innerHTML='';controls(sec,host);reload(sec.id);};
  host.appendChild(reset);
}

function esc(t){return String(t==null?'':t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function card(sec){
  const c=el('div','sec');c.dataset.g=sec.group;
  c.appendChild(el('h3','', '<span>'+esc(sec.title)+'</span><em>'+esc(sec.group)+(sec.on.length?' · '+esc(sec.on.join(', ')):'')+'</em>'));
  const wrap=el('div','secbody');
  // left rail
  const rail=el('div','rail');
  const codebox=el('div','codebox');
  const code=el('code','');code.dataset.code=sec.id;code.textContent=shortcodeFor(sec);
  const copy=el('button','btn','copy');
  copy.onclick=()=>{navigator.clipboard.writeText(code.textContent);copy.textContent='copied';setTimeout(()=>copy.textContent='copy',1200);};
  codebox.appendChild(code);codebox.appendChild(copy);rail.appendChild(codebox);
  const tabs=el('div','tabs');
  const tInfo=el('button','tab on','info'), tCust=el('button','tab','customize '+Object.keys(sec.slots).length);
  tabs.appendChild(tInfo);tabs.appendChild(tCust);rail.appendChild(tabs);
  const paneInfo=el('div','pane'), paneCust=el('div','pane hide');
  paneInfo.appendChild(el('p','',esc(sec.summary)));
  paneInfo.appendChild(el('p','muted','Fragment: <code>sections/'+esc(sec.id)+'/embed.html</code>'));
  controls(sec,paneCust);
  tInfo.onclick=()=>{tInfo.classList.add('on');tCust.classList.remove('on');paneInfo.classList.remove('hide');paneCust.classList.add('hide');};
  tCust.onclick=()=>{tCust.classList.add('on');tInfo.classList.remove('on');paneCust.classList.remove('hide');paneInfo.classList.add('hide');};
  rail.appendChild(paneInfo);rail.appendChild(paneCust);
  // preview
  const prev=el('div','prev');
  const bar=el('div','bar');
  const mk=(t,fn,on)=>{const b=el('button','pill'+(on?' on':''),t);b.onclick=()=>{[...bar.querySelectorAll('.pill')].forEach(x=>{if(x.dataset.grp===b.dataset.grp)x.classList.remove('on')});b.classList.add('on');fn();};return b;};
  const d=mk('desktop',()=>{stage.classList.remove('mob');},true), m=mk('mobile',()=>{stage.classList.add('mob');});
  d.dataset.grp=m.dataset.grp='v';
  const rp=el('button','pill','replay');rp.onclick=()=>reload(sec.id);
  const fu=el('button','pill','full &#8599;');fu.onclick=()=>openFull(sec);
  bar.appendChild(d);bar.appendChild(m);bar.appendChild(rp);bar.appendChild(fu);
  const stage=el('div','stage');
  const fr=document.createElement('iframe');fr.dataset.frame=sec.id;fr.loading='lazy';fr.src=srcFor(sec.id);
  stage.appendChild(fr);
  prev.appendChild(bar);prev.appendChild(stage);
  wrap.appendChild(rail);wrap.appendChild(prev);c.appendChild(wrap);
  return c;
}

function openFull(sec){
  const f=$('#full');f.classList.add('open');f.dataset.id=sec.id;
  $('#fulltitle').textContent=sec.title;
  $('#fullframe').src=srcFor(sec.id);
  const p=$('#fullpanel');p.innerHTML='';
  p.appendChild(el('h4','','customize'));
  const box=el('div','');controls(sec,box);p.appendChild(box);
  const cb=el('div','codebox');const cc=el('code','');cc.dataset.code=sec.id;cc.textContent=shortcodeFor(sec);
  const cp=el('button','btn','copy');cp.onclick=()=>{navigator.clipboard.writeText(cc.textContent);cp.textContent='copied';setTimeout(()=>cp.textContent='copy',1200);};
  cb.appendChild(cc);cb.appendChild(cp);p.appendChild(cb);
  document.body.style.overflow='hidden';
}
$('#fullclose').onclick=()=>{$('#full').classList.remove('open');document.body.style.overflow='';};
$('#fullreplay').onclick=()=>{const id=$('#full').dataset.id;$('#fullframe').src=srcFor(id);};
$('#fullnew').onclick=()=>{const id=$('#full').dataset.id;window.open(srcFor(id),'_blank');};

const host=$('#kit');
SECTIONS.forEach(s=>host.appendChild(card(s)));
document.querySelectorAll('.filters .chip').forEach(ch=>ch.onclick=()=>{
  document.querySelectorAll('.filters .chip').forEach(x=>x.classList.remove('on'));ch.classList.add('on');
  const g=ch.dataset.g;document.querySelectorAll('.sec').forEach(s=>s.style.display=(g==='*'||s.dataset.g===g)?'':'none');
});
"""

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

.filters{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 26px}
.chip{font:700 .66rem/1 var(--sans);letter-spacing:.11em;text-transform:uppercase;color:var(--dim);
background:var(--card);border:1px solid var(--line);border-radius:999px;padding:9px 14px;cursor:pointer}
.chip.on{background:var(--yellow);color:#231F20;border-color:var(--yellow)}
.sec{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:20px}
.sec h3{margin:0;padding:14px 18px;background:var(--bg2);border-bottom:1px solid var(--line);
display:flex;justify-content:space-between;gap:14px;align-items:baseline;font-size:1rem;font-weight:800}
.sec h3 em{font-style:normal;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);font-weight:700}
.secbody{display:grid;grid-template-columns:minmax(260px,320px) 1fr;gap:0;align-items:stretch}
@media(max-width:900px){.secbody{grid-template-columns:1fr}}
.rail{padding:16px 18px;border-right:1px solid var(--line);min-width:0}
@media(max-width:900px){.rail{border-right:0;border-bottom:1px solid var(--line)}}
.codebox{display:flex;gap:8px;align-items:stretch;margin-bottom:14px}
.codebox code{flex:1;min-width:0;font-family:var(--mono);font-size:.72rem;background:var(--bg);
border:1px solid var(--line);border-radius:7px;padding:9px 10px;color:var(--teal);overflow-x:auto;white-space:nowrap}
.btn{font:700 .64rem/1 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);
background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:9px 12px;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--teal);color:var(--teal)}.btn.on{background:var(--yellow);color:#231F20;border-color:var(--yellow)}
.btn.wide{width:100%;margin-top:12px}
.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:12px}
.tab{background:none;border:0;border-bottom:2px solid transparent;color:var(--dim);cursor:pointer;
font:700 .64rem/1 var(--sans);letter-spacing:.11em;text-transform:uppercase;padding:9px 3px;margin-right:10px}
.tab.on{color:var(--yellow);border-bottom-color:var(--yellow)}
.pane{font-size:.84rem;color:var(--dim)}.pane.hide{display:none}.pane p{margin:0 0 10px}
.muted{color:var(--dim);font-size:.76rem}
.ctl{margin-bottom:12px}
.ctl label{display:block;font:700 .6rem/1.4 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:5px}
.ctl label em{font-style:normal;font-family:var(--mono);text-transform:none;letter-spacing:0;color:rgba(244,241,234,.35)}
.ctl input,.ctl textarea{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:7px;
color:var(--ink);font:400 .8rem/1.5 var(--sans);padding:9px 10px;resize:vertical}
.ctl textarea{min-height:64px}
.ctl input:focus,.ctl textarea:focus{outline:0;border-color:var(--teal)}
.hint{margin:5px 0 0;font-size:.7rem;color:rgba(244,241,234,.4)}
.prev{min-width:0;display:flex;flex-direction:column;background:var(--bg)}
.bar{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.pill{font:700 .6rem/1 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);
background:var(--card);border:1px solid var(--line);border-radius:999px;padding:7px 12px;cursor:pointer}
.pill.on{background:var(--teal);color:#0b1a19;border-color:var(--teal)}
.pill:hover{color:var(--ink)}
.stage{padding:14px;display:flex;justify-content:center;background:repeating-linear-gradient(45deg,#121110,#121110 10px,#141312 10px,#141312 20px)}
.stage iframe{width:100%;height:560px;border:1px solid var(--line);border-radius:8px;background:#0f0e0d;transition:width .25s}
.stage.mob iframe{width:390px}
.full{position:fixed;inset:0;z-index:50;background:var(--bg);display:none;flex-direction:column}
.full.open{display:flex}
.full header{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg2)}
.full header b{font-size:.9rem;letter-spacing:.02em}
.full .live{font:700 .58rem/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--teal);
border:1px solid var(--teal);border-radius:999px;padding:5px 9px}
.full .spacer{flex:1}
.fullbody{flex:1;display:flex;min-height:0}
.fullbody iframe{flex:1;border:0;background:#0f0e0d}
#fullpanel{width:310px;border-left:1px solid var(--line);padding:16px;overflow:auto;background:var(--card)}
#fullpanel h4{margin:0 0 12px;font:800 .64rem/1 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--yellow)}
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


PREVIEW_TPL = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>%(title)s — preview</title>
<link rel="stylesheet" href="%(cdn)s/assets/brgw.css">
<style>html,body{margin:0;background:#0f0e0d}</style></head><body>
<div class="brgw" id="root"></div>
<template id="frag">%(frag)s</template>
<script>
// Fill the raw fragment exactly the way the plugin does: a literal string replace of
// {{token}} on the RAW markup, so a token inside an attribute (href="{{cta_href}}")
// works the same as one in text. Slots arrive base64 in the hash, so changing them
// reloads the frame — which doubles as the animation replay.
(function(){
  var raw = document.getElementById('frag').innerHTML;
  var slots = {};
  try { if (location.hash.length > 1) slots = JSON.parse(atob(decodeURIComponent(location.hash.slice(1)))); } catch(e){}
  var out = raw.replace(/\{\{([a-z0-9_-]+)\}\}/gi, function(m, k){
    return Object.prototype.hasOwnProperty.call(slots, k) ? slots[k] : (DEFAULTS[k] !== undefined ? DEFAULTS[k] : '');
  });
  document.getElementById('root').innerHTML = out;
  var s = document.createElement('script'); s.src = '%(cdn)s/assets/brgw.js'; document.body.appendChild(s);
})();
</script></body></html>
"""


def page_previews():
    """One standalone preview per section, same-origin so the kit can drive it.

    Not an iframe pointed at the CDN fragment: a bare fragment has no brgw.css and no
    engine, and a section extracted from a composed page is not a page — every
    split-line heading renders invisible because only brgw.js clears .anim-head.
    """
    secs = json.load(open(SECTIONS))
    outdir = os.path.join(OUTDIR, 'preview')
    os.makedirs(outdir, exist_ok=True)
    made = 0
    for s in secs['sections']:
        sid = s['id']
        frag = os.path.join(ROOT, 'website', 'sections', sid, 'embed.html')
        if not os.path.exists(frag):
            continue
        defaults = {k: v.get('default', '') for k, v in slots_of(sid).items()}
        body = PREVIEW_TPL % {'title': esc(s.get('title', sid)), 'cdn': CDN,
                              'frag': open(frag, encoding='utf-8').read()}
        body = body.replace('DEFAULTS[k]', 'D[k]').replace(
            '(function(){', '(function(){\n  var D = %s;' % json.dumps(defaults))
        open(os.path.join(outdir, sid + '.html'), 'w').write(body)
        made += 1
    return made


def slots_of(sid):
    f = os.path.join(ROOT, 'website', 'sections', sid, 'slots.json')
    if not os.path.exists(f):
        return {}
    return {k: v for k, v in json.load(open(f)).items() if not k.startswith('_')}


# ── /kit/ — what we have built ────────────────────────────────────────────────
def page_kit():
    """The Build Kit — a sandbox, not an index.

    Every section rendered live, editable, and checkable on mobile before it goes near
    the site. The variables you set build the shortcode for you, because the plugin takes
    a slot value as a shortcode attribute (attr > ACF > default), so what you copy is
    exactly what you previewed.
    """
    secs = json.load(open(SECTIONS))
    stacks = secs.get('stacks', {})
    where = {}
    for page, ids in stacks.items():
        for i in ids:
            where.setdefault(i, []).append(page)

    data = []
    for x in secs['sections']:
        sid = x['id']
        if not os.path.exists(os.path.join(ROOT, 'website', 'sections', sid, 'embed.html')):
            continue
        data.append({'id': sid, 'title': x.get('title', sid), 'group': x.get('group', 'other'),
                     'summary': x.get('summary', ''), 'on': where.get(sid, []),
                     'slots': slots_of(sid)})

    groups = sorted({d['group'] for d in data})
    chips = ''.join('<button class="chip" data-g="%s">%s</button>' % (esc(g), esc(g)) for g in groups)

    lede = ('<p class="lede">Every section rendered live — <strong>edit the variables, watch it '
            'update, check it on mobile, then copy the shortcode it builds for you.</strong> '
            'The plugin takes a slot value as a shortcode attribute, so what you copy is exactly '
            'what you previewed. Nothing here touches the site.</p>'
            '<div class="filters"><button class="chip on" data-g="*">all</button>%s</div>' % chips)

    body = ('<div id="kit"></div>'
            '<div id="full" class="full"><header><b id="fulltitle"></b>'
            '<span class="live">live</span><div class="spacer"></div>'
            '<button class="btn" id="fullreplay">replay</button>'
            '<button class="btn" id="fullnew">new tab &#8599;</button>'
            '<button class="btn on" id="fullclose">close &times;</button></header>'
            '<div class="fullbody"><iframe id="fullframe"></iframe>'
            '<aside id="fullpanel"></aside></div></div>'
            '<script>const SECTIONS=' + json.dumps(data) + ';const CDN=' + json.dumps(CDN) + ';</script>'
            '<script>' + KIT_JS + '</script>')
    return shell('index.html', 'Build Kit', lede, body)


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


# ── /kit/list — the quick view: every page, every shortcode ───────────────────
def page_list():
    """One screen answering "what exists and where does it go".

    The Shortcodes page documents the attribute surface of each shortcode TYPE.
    This is the opposite question: the actual inventory, by page, so you can see a
    whole stack at once and copy it in order.
    """
    secs = json.load(open(SECTIONS))
    reg = json.load(open(REGISTRY))
    stacks = secs.get('stacks', {})
    byid = {x['id']: x for x in secs['sections']}
    where = {}
    for page, ids in stacks.items():
        for i in ids:
            where.setdefault(i, []).append(page)

    rows = []
    for x in secs['sections']:
        sid = x['id']
        rows.append({'code': '[brg_%s]' % sid, 'id': sid, 'title': x.get('title', sid),
                     'type': x.get('group', 'other'), 'on': where.get(sid, []),
                     'built': os.path.exists(os.path.join(ROOT, 'website', 'sections', sid, 'embed.html'))})
    for c in reg['components']:
        if c['id'] in ('nav', 'footer'):
            rows.append({'code': '[%s]' % c.get('shortcode', c['id']), 'id': c['id'],
                         'title': c.get('summary') or c['id'], 'type': 'chrome',
                         'on': ['every page'], 'built': True})

    # by page — the stack in order, copyable whole
    out = ['<h2 class="sec">by page — the full stack, in order</h2>']
    for page, ids in stacks.items():
        stack = ['[brg_nav]'] + ['[brg_%s]' % i for i in ids] + ['[brg_footer]']
        lines = ''.join(
            '<tr><td><code>[brg_%s]</code></td><td>%s</td><td>%s</td></tr>'
            % (esc(i), esc(byid.get(i, {}).get('title', '')), esc(byid.get(i, {}).get('group', '')))
            for i in ids)
        out.append(
            '<div class="card"><h3>%s<em>%d sections</em></h3>'
            '<div class="body"><div class="codebox"><code>%s</code>'
            '<button class="btn" data-copy="%s">copy stack</button></div></div>'
            '<table><tr><th>shortcode</th><th>section</th><th>type</th></tr>%s</table></div>'
            % (esc(page), len(ids), esc(' '.join(stack)), esc(' '.join(stack)), lines))

    # by type
    types = {}
    for r in rows:
        types.setdefault(r['type'], []).append(r)
    out.append('<h2 class="sec">by type</h2><div class="grid">')
    for t in sorted(types):
        li = ''.join('<tr><td><code>%s</code></td><td>%s</td></tr>' % (esc(r['code']), esc(', '.join(r['on']) or '—'))
                     for r in sorted(types[t], key=lambda r: r['id']))
        out.append('<div class="card"><h3>%s<em>%d</em></h3><table>'
                   '<tr><th>shortcode</th><th>used on</th></tr>%s</table></div>' % (esc(t), len(types[t]), li))
    out.append('</div>')

    # flat A-Z, the copy-one-thing view
    out.append('<h2 class="sec">everything, A–Z</h2><div class="card"><table>'
               '<tr><th>shortcode</th><th>what</th><th>type</th><th>used on</th></tr>')
    for r in sorted(rows, key=lambda r: r['code']):
        out.append('<tr><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td></tr>'
                   % (esc(r['code']), esc(r['title'])[:70], esc(r['type']), esc(', '.join(r['on']) or '—')))
    out.append('</table></div>')

    lede = ('<p class="lede">Everything that exists and where it goes. <strong>%d section shortcodes '
            'across %d pages, plus the two chrome shortcodes.</strong> The Shortcodes tab documents '
            'what each one <em>accepts</em>; this one is the inventory. Copy a whole page stack in '
            'order, or a single shortcode. <strong>If a shortcode is not on this page it does not '
            'exist</strong> — placing it renders the raw text on the live site.</p>'
            % (len(secs['sections']), len(stacks)))
    body = ''.join(out) + ('<script>document.addEventListener("click",function(e){'
                           'var b=e.target.closest("[data-copy]");if(!b)return;'
                           'navigator.clipboard.writeText(b.dataset.copy);'
                           'var t=b.textContent;b.textContent="copied";setTimeout(function(){b.textContent=t},1200);});</script>')
    return shell('list.html', 'All Shortcodes', lede, body)


PAGES = {'index.html': page_kit, 'shortcodes.html': page_shortcodes,
         'status.html': page_status, 'builds.html': page_builds, 'log.html': page_log, 'list.html': page_list}


def main():
    refuse_if_worktree('kit/build-kit.py')
    check = '--check' in sys.argv
    os.makedirs(OUTDIR, exist_ok=True)
    if not check:
        print('  /kit/preview/       %d section previews' % page_previews())
    stale = []
    for name, fn in PAGES.items():
        new = fn()
        path = os.path.join(OUTDIR, name)  # now.html is hand-written and not in PAGES, so untouched
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
        print('\n%d pages → website/kit/  (live at %s/kit/)' % (len(PAGES), CDN))


if __name__ == '__main__':
    main()
