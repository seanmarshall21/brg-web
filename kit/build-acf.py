#!/usr/bin/env python3
"""Generate the ACF field groups that make sections editable in WordPress.

Slots are declared per section in **website/sections/<id>/slots.json** (beside the fragment
that uses them), and this generates website/acf/brg-<id>.acf.json plus the combined
all.acf.json. brg-acf.php fetches that combined file from Netlify and registers it — so
there is NO manual import: declare a slot, run this, push.

  python3 kit/build-acf.py           regenerate
  python3 kit/build-acf.py --check   every slot has a {{token}} and vice versa

  Field name convention (must match the plugin): brg_<section-id with _>_<slot>
  Location: options_page == brg-section-content  (registered by wp-mu-plugin/brg-acf.php)
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _guard import refuse_if_worktree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS = os.path.join(ROOT, 'website', 'sections.json')
OUTDIR   = os.path.join(ROOT, 'website', 'acf')
OPTIONS_PAGE = 'brg-section-content'

# slot type -> ACF field type
# slot type -> ACF FIELD type. Note `url` maps to ACF `text`, deliberately.
#
# ACF's `url` field validates for an absolute URL with a scheme and REFUSES to save
# anything else — and one invalid field blocks the whole options page, so a single
# relative href makes every section on it uneditable. Our hrefs are legitimately
# relative (`/careers/`), in-page anchors (`#open-positions`) and mailtos: 9 of the
# 11 link slots fail that rule. The widget was simply the wrong one.
#
# Nothing about rendering changes. The PLUGIN escapes on the slot's declared type
# from slots.json (`$def['type']`, :53 esc_url), not on the ACF field type — so a
# slot stays `"type": "url"`, still goes through esc_url(), and mailto/relative/
# anchor all survive that. Only the admin widget changes.
TYPE = {'text': 'text', 'textarea': 'textarea', 'url': 'text', 'image': 'image', 'html': 'wysiwyg'}

# TWO grammars, identical until plugin v2.6.1 and not since. See kit/README.md.
#   STRIPPABLE  what the plugin removes, and what --check must SEE to report it.
#   SLOT_NAME   what a slot may legally be CALLED. Narrower, because the name becomes the ACF
#               field name (brg_<id>_<slot>) and a hyphen there is a hyphen in a meta key.
# Widening STRIPPABLE to catch hyphenated typos removed the disagreement that used to expose a
# hyphenated slot NAME — so the name has to be checked directly now. (Finn spotted the gap.)
TOKEN_STRIPPABLE = re.compile(r'[a-z0-9_-]+$', re.I)
SLOT_NAME        = re.compile(r'[a-z0-9_]+$')


def bad_slot_names(slots):
    return [k for k in slots if not SLOT_NAME.match(k)]


def slots_for(section):
    """Where a section's slots are declared.

    PREFERRED: website/sections/<id>/slots.json — sits beside the fragment, in the SAME
    territory, so whoever writes the {{token}} declares the slot in the same commit. That
    is the property the whole --check exists to protect, and it is impossible to hold when
    the two halves live in two people's files.

    LEGACY: a `slots` object on the section in website/sections.json (conti's file). Still
    read, so nothing breaks, but it makes every wiring a cross-territory request.
    """
    sid = section['id']
    local = os.path.join(ROOT, 'website', 'sections', sid, 'slots.json')
    inline = section.get('slots') or {}
    if os.path.exists(local):
        with open(local, encoding='utf-8') as fh:
            declared = json.load(fh) or {}
        # Strip a leading "_note"-style key so the file can document itself.
        declared = {k: v for k, v in declared.items() if not k.startswith('_')}
        return declared, ('both' if inline else 'local')
    return inline, ('inline' if inline else 'none')

def admin_html(text):
    """ACF renders instructions and message fields as HTML — markdown is not processed.

    The generator wrote `**bold**` and `backticks`, so 37 fields showed literal asterisks and
    backticks in wp-admin. Found by reading Temper's write-up of the same bug (their 8abb37f)
    and checking ours rather than assuming we differed. esc_html is 0 and new_lines is wpautop
    on these fields, so real tags are the correct thing to emit.
    """
    import re as _re
    if not text:
        return text
    t = _re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    t = _re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t

def assert_options_page_agrees():
    """OPTIONS_PAGE here must equal menu_slug in the loader.

    Two homes for one string: this constant, and 'menu_slug' => '...' in
    website/wp-mu-plugin/brg-acf.php. A mismatch attaches every group to a page that does not
    exist, so the whole Section Content screen renders EMPTY with no error anywhere. This is the
    one coupling Temper says actually fired for them, twice, and cost an hour each time.

    Cannot be deleted — one side is Python, the other PHP — so it is derived-and-asserted
    instead, which is the next tier down.
    """
    php = os.path.join(ROOT, 'website', 'wp-mu-plugin', 'brg-acf.php')
    if not os.path.exists(php):
        return
    import re as _re
    src = open(php, encoding='utf-8').read()
    # Read the CONSTANT, not the menu_slug line: menu_slug is now BRG_ACF_PAGE, so a
    # literal search would find nothing and the check would silently stop checking.
    m = _re.search(r"define\(\s*'BRG_ACF_PAGE'\s*,\s*'([^']+)'\s*\)", src)
    if not m:
        sys.exit(f"refusing to run: no BRG_ACF_PAGE constant in {php} — the options page may "
                 f"have moved, and every group's location points at '{OPTIONS_PAGE}'.")
    if m.group(1) != OPTIONS_PAGE:
        sys.exit(f"refusing to run: options page mismatch.\n"
                 f"  kit/build-acf.py OPTIONS_PAGE = '{OPTIONS_PAGE}'\n"
                 f"  brg-acf.php BRG_ACF_PAGE     = '{m.group(1)}'\n"
                 f"Groups would attach to a page that does not exist and the Section Content "
                 f"screen would render empty, with no error.")

def field(section_id, slot, defn):
    name = 'brg_' + section_id.replace('-', '_') + '_' + slot

    # A repeater is a list of rows, each row a set of sub-fields. The plugin reads it with
    # get_field(name,'option') and renders the fragment's <!--brg:repeat slot--> block once
    # per row, so sub-field NAMES are the contract — they key each row and they are what
    # {{slot.sub}} matches. They are deliberately unprefixed: prefixing would make the
    # token {{members.brg_team_members_photo}}, which nobody would write correctly twice.
    if defn.get('type') == 'repeater':
        subs = defn.get('sub') or {}
        illegal = bad_slot_names(subs)
        if illegal:
            sys.exit(f"refusing to generate {section_id}.{slot}: sub-field name(s) {illegal} "
                     f"are not [a-z0-9_]. They become ACF meta keys and template tokens.")
        return {
            'key': 'field_' + name, 'label': defn.get('label', slot.replace('_', ' ').title()),
            'name': name, 'type': 'repeater',
            'instructions': admin_html(defn.get('doc', '')), 'required': 0,
            'conditional_logic': 0, 'wrapper': {'width': '', 'class': '', 'id': ''},
            'layout': defn.get('layout', 'block'),
            'button_label': defn.get('button', 'Add row'),
            'min': 0, 'max': 0,
            # Collapse each row to ONE named line. With nine people the difference between
            # a scrollable wall of open rows and a list you can read is this setting, and it
            # has to name a sub-field key: ACF shows that field's value as the row label.
            # Defaults to the first text sub-field, which is 'name' in practice.
            'collapsed': ('field_' + name + '_' + defn['collapse']) if defn.get('collapse') else (
                next(('field_' + name + '_' + k for k, v in subs.items()
                      if (v or {}).get('type') in (None, 'text')), '')),
            'sub_fields': [
                dict(field(section_id, sk, sv), key='field_' + name + '_' + sk, name=sk)
                for sk, sv in subs.items()
            ],
        }

    t = TYPE.get(defn.get('type', 'text'), 'text')
    # Short fields pair two to a row; anything that needs room takes the whole row.
    # A label and its link side by side is how they are actually edited — the
    # alternative is 62 full-width boxes stacked, which is the screen fc-brands
    # describes as unusable by the third section. Presentation only: wrapper.width
    # is a CSS width on the field's container and touches nothing about storage.
    wide = t in ('textarea', 'wysiwyg', 'image')
    f = {
        'key': 'field_' + name, 'label': defn.get('label', slot.replace('_', ' ').title()),
        'name': name, 'type': t, 'instructions': admin_html(defn.get('doc', '')), 'required': 0,
        'conditional_logic': 0, 'wrapper': {'width': '' if wide else '50', 'class': '', 'id': ''},
        'default_value': defn.get('default', ''),
    }
    if t == 'image':
        f.update({'return_format': 'url', 'preview_size': 'medium', 'library': 'all'})
        f.pop('default_value', None)
    return f

CHROME_DIR = os.path.join(ROOT, 'website', 'chrome')

def chrome_groups():
    """Groups for site CHROME — nav, footer — which are not sections.

    A section is a fragment with {{tokens}} that the plugin fills. Chrome is generated by
    PHP, so its fields are read directly with get_field() instead. That difference matters
    for --check: a chrome slot has no {{token}} to verify, so the coupling to prove is the
    one fc-brands names as the thing that broke them twice — a field with no READER. The
    editor types, saves, sees no change, and gets no error.

    Declared in website/chrome/<id>/slots.json, one sub-page each, same as a page group.
    """
    if not os.path.isdir(CHROME_DIR):
        return []
    out = []
    for cid in sorted(os.listdir(CHROME_DIR)):
        f = os.path.join(CHROME_DIR, cid, 'slots.json')
        if not os.path.exists(f):
            continue
        decl = {k: v for k, v in (json.load(open(f, encoding='utf-8')) or {}).items()
                if not k.startswith('_')}
        if not decl:
            continue
        label = decl.pop('_label', None) or cid.replace('-', ' ').title()
        out.append((cid, label, decl))
    return out

def page_of(section):
    """Which page a section belongs to, and what that page is called.

    Derived, not listed. The id prefix is the page ('community-partner' -> 'community')
    and the label is the common prefix of the section titles ('Community — hero' ->
    'Community'), so adding a page or renaming one needs no edit here. A hardcoded list
    would be a second home for something sections.json already knows.
    """
    sid = section['id']
    known = ('our-restaurants', 'home', 'team', 'community', 'careers', 'contact')
    page = next((k for k in known if sid == k or sid.startswith(k + '-')), sid.split('-')[0])
    title = section.get('title', sid)
    label = title.split('—')[0].strip() if '—' in title else page.replace('-', ' ').title()
    return page, label

def tab_label(section):
    """The bit of the title after the em dash — 'Home — hero' -> 'Hero'."""
    t = section.get('title', section['id'])
    # Upper-case the first letter only. .capitalize() lower-cases the rest, which turned
    # 'born in San Diego' into 'Born in san diego' — proper nouns are the point of a label.
    lbl = (t.split('—', 1)[1].strip() if '—' in t else section['id'].replace('-', ' '))
    return lbl[:1].upper() + lbl[1:] if lbl else section['id']

def page_group(page, label, sections, first=False):
    """ONE field group per page, with a TAB per section inside it.

    Nineteen groups on one screen is nineteen boxes to scroll past. Six, each with a tab
    per section, is the shape Sean asked for and the shape fc-brands uses.

    THIS DOES NOT MOVE ANY DATA, and that is the whole reason it is safe. ACF stores an
    option by FIELD NAME — `options_brg_home_hero_heading` — and group membership is not
    part of the key. Field names are untouched here, so every value already typed is
    still found. That is precisely NOT true of ACF's `group` FIELD type, which restructures
    children to `{group}_{child}` and orphans everything already saved; fc-brands lost a
    screen's worth of content that way (their 56a8f5e) and calls it a data migration rather
    than a refactor. Tabs are presentation. Groups-of-fields are storage. Only one of them
    is safe to reach for.
    """
    # first page == the parent slug; the rest hang off it as sub-pages.
    sub_slug = OPTIONS_PAGE if first else OPTIONS_PAGE + '-' + page
    fields = [{
        'key': 'field_brg_page_' + page.replace('-', '_') + '_msg',
        'label': '', 'name': '', 'type': 'message',
        'message': admin_html(
            f"**{label}** — one tab per section. Edits fill that section's "
            f"`{{{{slots}}}}` on the live page. Shortcode attributes still override, and a "
            f"blank field falls back to the built-in default."),
        'new_lines': 'wpautop', 'esc_html': 0, 'required': 0, 'conditional_logic': 0,
        'wrapper': {'width': '', 'class': '', 'id': ''},
    }]
    for sec in sections:
        sid = sec['id']
        slots, _ = slots_for(sec)
        if not slots:
            continue
        fields.append({
            'key': 'field_brg_tab_' + sid.replace('-', '_'),
            'label': tab_label(sec), 'name': '', 'type': 'tab',
            'placement': 'top', 'endpoint': 0,
            'instructions': '', 'required': 0, 'conditional_logic': 0,
            'wrapper': {'width': '', 'class': '', 'id': ''},
        })
        fields.extend(field(sid, k, v) for k, v in slots.items())
    return {
        'key': 'group_brg_page_' + page.replace('-', '_'),
        'title': f"{label} — Content",
        'fields': fields,
        # Each page is its OWN options sub-page, so the admin sidebar becomes the
        # navigation instead of one long screen. The FIRST page shares the parent slug —
        # standard WP pattern — so clicking "Section Content" lands on Home rather than
        # an empty parent, and the sidebar reads Home / Brands / Team / … with no
        # duplicate entry. The loader derives every sub-page from these values, so this
        # line is the only place the page set is decided.
        'location': [[{'param': 'options_page', 'operator': '==', 'value': sub_slug}]],
        'menu_order': 0, 'position': 'normal', 'style': 'default', 'label_placement': 'top',
        'instruction_placement': 'label', 'hide_on_screen': '', 'active': True,
        'description': (f"Editable content for the {label} page, one tab per section. "
                        f"Generated — edit website/sections/<id>/slots.json and rerun "
                        f"kit/build-acf.py."),
    }

def check():
    """Every declared slot must have a matching {{token}} in its fragment, and vice versa.

    This is the one coupling the generator cannot enforce by construction: sections.json and
    the fragment are edited by different people in different clones, and both halves fail
    SILENTLY. A slot with no token produces a working WordPress field that edits nothing —
    the editor types, saves, sees no change, and has no error to go on. A token with no slot
    is worse: the plugin strips leftover {{tokens}} on render, so the copy just vanishes.

    (fc-brands hits the same class of bug and checks it with tools/acf-readers.py --strict.
    Their coupling is field → PHP reader; ours is slot → {{token}}, because BRG needs no
    per-section PHP.)

    Returns the number of mismatches. Exit code 1 when non-zero.
    """
    data = json.load(open(SECTIONS))
    bad = 0
    for s in data.get('sections', []):
        frag = os.path.join(ROOT, 'website', 'sections', s['id'], 'embed.html')
        html = open(frag, encoding='utf-8').read() if os.path.exists(frag) else ''
        declared_map, origin = slots_for(s)
        declared = set(declared_map.keys())
        # `-` is in the class so --check can SEE a hyphenated token at all. Slot names are
        # underscores by convention, so any hyphenated token is orphaned by construction and
        # gets reported below. Grammar is defined in kit/README.md; four sites must agree.
        used = set(re.findall(r'\{\{([a-z0-9_-]+)\}\}', html))

        # Repeaters are declared by a <!--brg:repeat name--> BLOCK, not a {{name}} token,
        # and their contents are {{name.sub}}. Checked here and removed from the scalar sets,
        # because checking a repeater as a scalar reports every correctly-wired one as an
        # unwired slot — a check that cries wolf on correct work gets muted, and this is the
        # only thing standing between a slot and a field that edits nothing.
        for k, d in list(declared_map.items()):
            if not (isinstance(d, dict) and d.get('type') == 'repeater'):
                continue
            declared.discard(k)
            if ('<!--brg:repeat ' + k + '-->') not in html:
                print(f"  ✗ {s['id']}: repeater '{k}' has no <!--brg:repeat {k}--> block in the "
                      f"fragment — the ACF field would accept rows that render nowhere.")
                bad += 1
            elif '<!--/brg:repeat-->' not in html:
                print(f"  ✗ {s['id']}: repeater '{k}' block is opened and never closed.")
                bad += 1
            for sk in (d.get('sub') or {}):
                if ('{{' + k + '.' + sk + '}}') not in html:
                    print(f"  ✗ {s['id']}: repeater sub-field '{k}.{sk}' has no "
                          f"{{{{{k}.{sk}}}}} in the fragment — that column would edit nothing.")
                    bad += 1
        # Sub-tokens are not orphans; drop them before the leftover-token check.
        used = {u for u in used if '.' not in u}
        for k in bad_slot_names(declared_map):
            print(f"  ✗ {s['id']}: slot name '{k}' is not [a-z0-9_] — it becomes the ACF field "
                  f"brg_{s['id'].replace('-', '_')}_{k}, and a hyphen in a meta key breaks "
                  f"get_field(). --check would otherwise pass this: since v2.6.1 both sides "
                  f"match hyphens, so the slot and its token agree with each other perfectly.")
            bad += 1
        if origin == 'both':
            print(f"  ✗ {s['id']}: slots declared in BOTH sections/{s['id']}/slots.json and "
                  f"sections.json — slots.json wins, so the sections.json copy is dead text "
                  f"that still reads as the source. Delete the inline one.")
            bad += 1
        if not declared and not used:
            continue
        for slot in sorted(declared - used):
            print(f"  ✗ {s['id']}: slot '{slot}' has no {{{{{slot}}}}} in the fragment — "
                  f"the ACF field will edit nothing")
            bad += 1
        for tok in sorted(used - declared):
            print(f"  ✗ {s['id']}: token {{{{{tok}}}}} is declared nowhere — "
                  f"the plugin strips it, so that copy disappears on render")
            bad += 1
    if bad:
        print(f"\n{bad} problem(s). A slot and its {{{{token}}}} ship together — declare slots in "
              f"website/sections/<id>/slots.json, beside the fragment that uses them.")
    else:
        print("acf slots ↔ fragment tokens: OK")

    # Chrome slots have no fragment and no {{token}}. The coupling that can silently fail
    # is field -> READER: the plugin must actually call get_field() for each one, or the
    # editor gets a field that edits nothing. This is fc-brands' tools/acf-readers.py,
    # scoped to the two or three chrome groups we have rather than every section.
    php_path = os.path.join(ROOT, 'website', 'wp-mu-plugin', 'vc-clients-embed.php')
    php = open(php_path, encoding='utf-8').read() if os.path.exists(php_path) else ''
    for cid, label, decl in chrome_groups():
        for k in decl:
            fname = 'brg_' + cid.replace('-', '_') + '_' + k
            if fname not in php:
                print(f"  ✗ chrome/{cid}: slot '{k}' is never read — nothing in "
                      f"vc-clients-embed.php mentions {fname}, so the field would accept "
                      f"input that changes nothing on the page.")
                bad += 1

    return bad


def existing_group_ids():
    """Section ids that already have a generated field group on disk.

    This is what a shrink would destroy, so it is read BEFORE anything is written.
    """
    if not os.path.isdir(OUTDIR):
        return set()
    return {f[len('brg-'):-len('.acf.json')] for f in os.listdir(OUTDIR)
            if f.startswith('brg-') and f.endswith('.acf.json')}

def assert_tree_visible():
    """Refuse to proceed when this process cannot see the section tree.

    A missing slots.json reaches os.path.exists() and returns a silent False, which is
    indistinguishable from a section that declares none. So if sections.json names N
    sections and NOT ONE of their directories is on disk, the honest reading is "I cannot
    see the tree" — never "nobody declared anything".

    This runs for --check TOO, and that placement is the whole point. Both guards route
    through slots_for(), so one blind read poisons both: with zero sections visible,
    "every slot has a token and every token a slot" is VACUOUSLY TRUE and --check reports
    OK. Two guards that look independent — pre-push runs them as separate steps, for
    separate reasons — are one guard wearing two names if they share a discovery step.
    Guarding the discovery is one fix; guarding each consumer would have been two patches
    for one fault, and would have left the next consumer exposed. (Expo's catch: my first
    version put this after the --check early return, so --check stayed blind and I had
    reported it fixed.)
    """
    assert_options_page_agrees()
    data = json.load(open(SECTIONS))
    # position in sections.json becomes menu_order, so the admin screen reads in page order
    for i, sec in enumerate(data.get('sections', [])):
        sec['_order'] = i
    listed = [s['id'] for s in data.get('sections', [])]
    secdir = os.path.join(ROOT, 'website', 'sections')
    if listed and not any(os.path.isdir(os.path.join(secdir, i)) for i in listed):
        sys.exit(f"refusing to run: sections.json lists {len(listed)} section(s) and none of "
                 f"their directories exist under {secdir}.\nThat is this script failing to "
                 f"find the tree, not the tree being empty — check ROOT and your cwd.")
    return data

def main():
    refuse_if_worktree('kit/build-acf.py')
    data = assert_tree_visible()
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)

    # ── Compute everything BEFORE writing anything ──────────────────────────────────
    # The old loop wrote inside itself, so a guard could only ever fire after the damage.
    from collections import OrderedDict
    pages = OrderedDict()
    for sec in data.get('sections', []):
        slots = slots_for(sec)[0]
        if not slots:
            continue
        illegal = bad_slot_names(slots)
        if illegal:
            sys.exit(f"refusing to generate {sec['id']}: slot name(s) {illegal} are not "
                     f"[a-z0-9_]; they would become ACF field names containing a hyphen.")
        page, label = page_of(sec)
        pages.setdefault(page, {'label': label, 'sections': []})['sections'].append(sec)

    wanted = []
    for order, (page, info) in enumerate(pages.items()):
        g = page_group(page, info['label'], info['sections'], first=(order == 0))
        g['menu_order'] = order          # page order on the admin screen
        wanted.append(('page-' + page, g, sum(len(slots_for(x)[0]) for x in info['sections'])))

    before = existing_group_ids()
    now = {sid for sid, _, _ in wanted}
    lost = sorted(before - now)

    if not wanted and before:
        sys.exit(f"refusing to write an empty field registry over {len(before)} existing "
                 f"group(s).\nEvery section came back with no slots, which is far more "
                 f"likely to be this script than the repo.")

    if lost and '--allow-shrink' not in sys.argv:
        sys.exit(f"refusing to drop {len(lost)} existing field group(s): {', '.join(lost)}\n"
                 f"If this is the per-section -> per-page restructure, that is expected: the "
                 f"19 per-section groups become 6 per-page ones. NO VALUES MOVE — ACF keys "
                 f"options by FIELD NAME and those are unchanged — but the old files must go.\n"
                 f"Re-run with --allow-shrink, and delete the stale website/acf/brg-<id>.acf.json.")

    os.makedirs(OUTDIR, exist_ok=True)
    made = []
    for sid, grp, n in wanted:
        out = os.path.join(OUTDIR, f"brg-{sid}.acf.json")
        json.dump([grp], open(out, 'w'), indent=4, ensure_ascii=False)
        open(out, 'a').write('\n')
        made.append((sid, os.path.relpath(out, ROOT), n))
    json.dump([g for _, g, _ in wanted],
              open(os.path.join(OUTDIR, 'all.acf.json'), 'w'), indent=2, ensure_ascii=False)
    open(os.path.join(OUTDIR, 'all.acf.json'), 'a').write('\n')

    if lost:
        print(f"  dropped (--allow-shrink): {', '.join(lost)}")
    if not made:
        print("No sections declare slots yet — add website/sections/<id>/slots.json next to a fragment.")
    for sid, path, n in made:
        print(f"  {sid:22} {n} field(s) -> {path}")
    print(f"\n{len(made)} field group(s) → also combined into website/acf/all.acf.json "
          f"(the auto-loader fetches this; no manual import).")

if __name__ == '__main__':
    main()
