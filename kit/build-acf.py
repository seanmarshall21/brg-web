#!/usr/bin/env python3
"""Generate a per-section ACF field group (acf.json) from each section's `slots` in
website/sections.json. Pattern from fc-brands: each editable section ships an acf.json you
import once under ACF -> Tools; the fields attach to the ONE "Section Content" options page
(menu_slug must equal each group's location value). The plugin fills the fragment's {{slots}}
from these fields (attr > ACF option > default). Run: python3 kit/build-acf.py

  Field name convention (must match the plugin): brg_<section-id with _>_<slot>
  Location: options_page == brg-section-content  (see wp-snippets/brg-section-content-options.php)
"""
import json, os

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

def main():
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
    if not made:
        print("No sections declare slots yet — add a `slots` object to a section in website/sections.json.")
    for sid, path, n in made:
        print(f"  {sid:22} {n} field(s) -> {path}")
    print(f"\n{len(made)} field group(s) generated. Import each under ACF -> Tools -> Import Field Groups.")

if __name__ == '__main__':
    main()
