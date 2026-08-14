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

def field(section_id, slot, defn):
    name = 'brg_' + section_id.replace('-', '_') + '_' + slot
    t = TYPE.get(defn.get('type', 'text'), 'text')
    f = {
        'key': 'field_' + name, 'label': defn.get('label', slot.replace('_', ' ').title()),
        'name': name, 'type': t, 'instructions': defn.get('doc', ''), 'required': 0,
        'conditional_logic': 0, 'wrapper': {'width': '', 'class': '', 'id': ''},
        'default_value': defn.get('default', ''),
    }
    if t == 'image':
        f.update({'return_format': 'url', 'preview_size': 'medium', 'library': 'all'})
        f.pop('default_value', None)
    return f

def group(section):
    sid, title = section['id'], section.get('title', section['id'])
    slots, _ = slots_for(section)
    msg = {
        'key': 'field_brg_' + sid.replace('-', '_') + '_msg', 'label': '', 'name': '', 'type': 'message',
        'message': (f"**{title} — Content**\nSource: `brg-web/website/acf/brg-{sid}.acf.json` "
                    f"(generated). Edits here fill the section's `{{{{slots}}}}` "
                    f"— shortcode attributes still override, and blank falls back to the built-in default."),
        'new_lines': 'wpautop', 'esc_html': 0, 'required': 0, 'conditional_logic': 0,
        'wrapper': {'width': '', 'class': '', 'id': ''},
    }
    return {
        'key': 'group_brg_' + sid.replace('-', '_'),
        'title': f"{title} — Content",
        'fields': [msg] + [field(sid, k, v) for k, v in slots.items()],
        'location': [[{'param': 'options_page', 'operator': '==', 'value': OPTIONS_PAGE}]],
        'menu_order': 0, 'position': 'normal', 'style': 'default', 'label_placement': 'top',
        'instruction_placement': 'label', 'hide_on_screen': '', 'active': True,
        'description': f"Editable content for the {sid} section. Generated — do not hand-edit; edit sections/{sid}/slots.json + rerun kit/build-acf.py.",
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
    return bad


def main():
    refuse_if_worktree('kit/build-acf.py')
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)

    data = json.load(open(SECTIONS))
    os.makedirs(OUTDIR, exist_ok=True)
    made = []
    for s in data.get('sections', []):
        if not slots_for(s)[0]:
            continue
        illegal = bad_slot_names(slots_for(s)[0])
        if illegal:
            sys.exit(f"refusing to generate {s['id']}: slot name(s) {illegal} are not [a-z0-9_]; "
                     f"they would become ACF field names containing a hyphen. Run --check.")
        out = os.path.join(OUTDIR, f"brg-{s['id']}.acf.json")
        json.dump([group(s)], open(out, 'w'), indent=4, ensure_ascii=False)
        open(out, 'a').write('\n')
        made.append((s['id'], os.path.relpath(out, ROOT), len(slots_for(s)[0])))
    # Combined file the auto-loader (brg-acf.php) fetches from Netlify and registers — so
    # field changes go live on push, no manual import.
    all_groups = [group(s) for s in data.get('sections', []) if slots_for(s)[0]]
    json.dump(all_groups, open(os.path.join(OUTDIR, 'all.acf.json'), 'w'), indent=2, ensure_ascii=False)
    open(os.path.join(OUTDIR, 'all.acf.json'), 'a').write('\n')

    if not made:
        print("No sections declare slots yet — add website/sections/<id>/slots.json next to a fragment.")
    for sid, path, n in made:
        print(f"  {sid:22} {n} field(s) -> {path}")
    print(f"\n{len(made)} field group(s) → also combined into website/acf/all.acf.json "
          f"(the auto-loader fetches this; no manual import).")

if __name__ == '__main__':
    main()
