#!/usr/bin/env python3
"""Generate a per-section ACF field group (acf.json) from each section's `slots` in
website/sections.json. Pattern from fc-brands: each editable section ships an acf.json you
import once under ACF -> Tools; the fields attach to the ONE "Section Content" options page
(menu_slug must equal each group's location value). The plugin fills the fragment's {{slots}}
from these fields (attr > ACF option > default). Run: python3 kit/build-acf.py

  Field name convention (must match the plugin): brg_<section-id with _>_<slot>
  Location: options_page == brg-section-content  (see wp-snippets/brg-section-content-options.php)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS = os.path.join(ROOT, 'website', 'sections.json')
OUTDIR   = os.path.join(ROOT, 'website', 'acf')
OPTIONS_PAGE = 'brg-section-content'

# slot type -> ACF field type
TYPE = {'text': 'text', 'textarea': 'textarea', 'url': 'url', 'image': 'image', 'html': 'wysiwyg'}

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
    slots = section.get('slots', {})
    msg = {
        'key': 'field_brg_' + sid.replace('-', '_') + '_msg', 'label': '', 'name': '', 'type': 'message',
        'message': (f"**{title} — Content**\nSource: `brg-web/website/acf/brg-{sid}.acf.json` "
                    f"(generated from sections.json). Edits here fill the section's `{{{{slots}}}}` "
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
        'description': f"Editable content for the {sid} section. Generated — do not hand-edit; edit sections.json + rerun kit/build-acf.py.",
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
        declared = set((s.get('slots') or {}).keys())
        used = set(re.findall(r'\{\{([a-z0-9_]+)\}\}', html))
        if not declared and not used:
            continue
        for slot in sorted(declared - used):
            print(f"  ✗ {s['id']}: slot '{slot}' has no {{{{{slot}}}}} in the fragment — "
                  f"the ACF field will edit nothing")
            bad += 1
        for tok in sorted(used - declared):
            print(f"  ✗ {s['id']}: token {{{{{tok}}}}} has no slot in sections.json — "
                  f"the plugin strips it, so that copy disappears on render")
            bad += 1
    if bad:
        print(f"\n{bad} slot/token mismatch(es). Fix by adding the {{{{token}}}} to the fragment "
              f"(Finn) or the slot to website/sections.json (Conti) — they ship together.")
    else:
        print("acf slots ↔ fragment tokens: OK")
    return bad


def main():
    if '--check' in sys.argv:
        sys.exit(1 if check() else 0)

    data = json.load(open(SECTIONS))
    os.makedirs(OUTDIR, exist_ok=True)
    made = []
    for s in data.get('sections', []):
        if not s.get('slots'):
            continue
        out = os.path.join(OUTDIR, f"brg-{s['id']}.acf.json")
        json.dump([group(s)], open(out, 'w'), indent=4, ensure_ascii=False)
        open(out, 'a').write('\n')
        made.append((s['id'], os.path.relpath(out, ROOT), len(s['slots'])))
    # Combined file the auto-loader (brg-acf.php) fetches from Netlify and registers — so
    # field changes go live on push, no manual import.
    all_groups = [group(s) for s in data.get('sections', []) if s.get('slots')]
    json.dump(all_groups, open(os.path.join(OUTDIR, 'all.acf.json'), 'w'), indent=2, ensure_ascii=False)
    open(os.path.join(OUTDIR, 'all.acf.json'), 'a').write('\n')

    if not made:
        print("No sections declare slots yet — add a `slots` object to a section in website/sections.json.")
    for sid, path, n in made:
        print(f"  {sid:22} {n} field(s) -> {path}")
    print(f"\n{len(made)} field group(s) → also combined into website/acf/all.acf.json "
          f"(the auto-loader fetches this; no manual import).")

if __name__ == '__main__':
    main()
