"""Legacy character metadata adapter; the existing preview pipeline is unchanged."""
import copy
import json
import math
import re
from pathlib import PurePosixPath

from zg_colors import translate_colors
from palette_controls import apply_selection

SLOTS = ('head', 'facehair', 'hair', 'face', 'chest', 'bracer', 'waist', 'hand', 'leg', 'boot', 'creature')
FAMILIES = ('SkinB', 'Eye', 'HairC', 'Garment', 'Uber', 'Creature')
TEXTURES = ('diffuseMap', 'rotationMap', 'glossMap', 'paletteMap', 'paletteMaskMap',
            'ageMap', 'complexionMap', 'facepaintMap', 'directionMap')


def game_path(value, extension=None):
    if not isinstance(value, str):
        raise ValueError('Missing game asset path')
    value = value.replace('\\', '/').lstrip('/')
    if (not value.startswith('art/') or any(p in ('', '.', '..') for p in value.split('/'))
            or any(c in value for c in ':\x00\r\n') or
            extension and not value.lower().endswith(extension)):
        raise ValueError('Invalid game asset path: ' + value)
    return '/' + value


def native_values(values):
    family = {'HighQualityCharacter': 'Creature', 'GarmentScrolling': 'Garment'}.get(
        values.get('derived'), values.get('derived'))
    if family not in FAMILIES:
        raise ValueError('Unsupported ZG shader: ' + str(family))
    # These are the defaults of the viewer's HeroEngine node, not invented dyes.
    result = {'derived': family}
    defaults = {'palette1': [0, .5, 0, 1], 'palette2': [0, .5, 0, 1],
                'palette1Specular': [0, .5, 0], 'palette2Specular': [0, .5, 0],
                'palette1MetallicSpecular': [0, .5, 0], 'palette2MetallicSpecular': [0, .5, 0],
                'flush': [0, 0, 0], 'fleshBrightness': 0}
    for key, default in defaults.items():
        value = values.get(key, default)
        if isinstance(default, list):
            if not isinstance(value, (list, tuple)) or len(value) != len(default):
                # Legacy empty arrays are unused for non-palette shader families.
                if value == [] and (family in ('Uber', 'Creature') or key.startswith('palette2') and family != 'Garment'):
                    value = default
                else:
                    raise ValueError('Invalid ' + key + ' for ' + family)
            value = [float(v) for v in value]
        else:
            value = float(value)
        if not all(math.isfinite(v) for v in (value if isinstance(value, list) else [value])):
            raise ValueError('Non-finite ' + key)
        result[key] = value
    skin = values.get('materialSkinIndex', -1)
    if isinstance(skin, bool) or float(skin) != int(skin) or int(skin) < -1:
        raise ValueError('Invalid skin material index')
    result['materialSkinIndex'] = str(int(skin))
    return result


def legacy_material(info, eye=False):
    result = {'ddsPaths': {}, 'otherValues': native_values(info.get('otherValues', {}))}
    mat = info.get('matPath') or info.get('materialInfo', {}).get('matPath')
    if mat or not eye:
        result['matPath'] = game_path(mat, '.mat')
    for key, value in info.get('ddsPaths', {}).items():
        if key not in TEXTURES:
            continue
        if value in ('/.dds', '.dds'):
            continue  # unused legacy placeholders; required maps are checked below
        result['ddsPaths'][key] = game_path(value, '.dds')
    required = ['diffuseMap', 'rotationMap', 'glossMap']
    family = result['otherValues']['derived']
    if family in ('SkinB', 'Eye', 'HairC', 'Garment'):
        required += ['paletteMap', 'paletteMaskMap']
    if family == 'Creature':
        required += ['paletteMaskMap']
    missing = [key for key in required if key not in result['ddsPaths']]
    if missing:
        raise ValueError(f"{family} material lacks required maps: {', '.join(missing)}")
    if info.get('eyeMatInfo'):
        result['eyeMatInfo'] = legacy_material(info['eyeMatInfo'], eye=True)
    return result


def signature(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def effective_slots(assembly, state, mesh_names):
    """Apply worker/convert.py clothing replacement and visibility semantics."""
    slots = copy.deepcopy(assembly['slots'])
    equipment = assembly.get('equipment', [])
    warnings = []
    replaced = {e['slot'] for e in equipment if e['bone'] == '@skin' and e.get('replaceSlot', True)}
    slots = [s for s in slots if s['slotName'] not in replaced]
    preset = {}
    gear_entries = {}
    for entry in equipment:
        if entry['bone'] != '@skin':
            warnings.append('Not included: ' + entry.get('name', entry.get('item', 'bone-attached equipment')) + ' (bone attachment/effects).')
            continue
        if entry['kind'] != 'armor' or entry['slot'] not in SLOTS:
            raise ValueError('Unsupported clothing slot: ' + str(entry.get('slot')))
        for model in entry['models']:
            info = copy.deepcopy(entry['materialInfo'])
            color = entry.get('colors', {}).get(model, entry.get('colors', {}).get('*', {}))
            for selected in [info, *info.get('materialOverrides', {}).values()]:
                if selected.get('otherValues', {}).get('derived') != 'SkinB':
                    for channel, index in [('primary', 1), ('secondary', 2)]:
                        apply_selection(selected['otherValues'],color,channel,index)
            slots.append({'slotName': entry['slot'], 'models': [model], 'materialInfo': info,
                          '_equipmentLayer': entry['layer']})
        name = entry.get('name', entry['slot'])
        gear = {'name': name, 'slot': entry['slot']}
        refs = [r for r in entry.get('references', []) if r.startswith('ipp.')]
        if len(refs) == 1:
            gear['ippPath'] = refs[0]
        gear_entries[entry['layer']] = gear
    if state.get('weapon', 'none') != 'none':
        warnings.append('Not included: preview weapon (bone attachment).')
    omitted_prefixes = ['equipment_' + str(e['layer']) + '_' for e in equipment if e['bone'] != '@skin']
    hidden = {name for name in state.get('hidden', []) if not any(name.startswith(p) for p in omitted_prefixes)
              and not (state.get('weapon', 'none') != 'none' and name == state['weapon'])}
    if 'previewParts' in state:
        # The viewer only applies hidden flags to parts in the current preview.
        # Flags left behind by a removed/replaced item have no visible effect.
        hidden.intersection_update(p['name'] for p in state['previewParts'])
    preview_models = {}
    for part in state.get('previewParts', []):
        key = (game_path(part['source'], '.gr2').lower(), part.get('equipmentLayer'))
        preview_models.setdefault(key, []).append(part['name'])
    matched = set()
    visible_layers = set()
    for slot in slots:
        visible = []
        for model in slot.get('models', []):
            # Use the applied preview's source mapping when available. Object
            # naming can differ with importer versions and naming preferences.
            names = preview_models.get((game_path(model, '.gr2').lower(), slot.get('_equipmentLayer')))
            if not names:
                names = mesh_names(model)
                if '_equipmentLayer' in slot:
                    names = ['equipment_' + str(slot['_equipmentLayer']) + '_' + n for n in names]
            excluded = hidden.intersection(names)
            matched.update(excluded)
            if excluded and len(excluded) != len(names):
                raise ValueError('ZG cannot hide only part of model: ' + model)
            if not excluded:
                visible.append(model)
        slot['models'] = visible
        if visible and '_equipmentLayer' in slot:
            visible_layers.add(slot['_equipmentLayer'])
        slot.pop('_equipmentLayer', None)
    if hidden - matched:
        raise ValueError('Cannot map hidden parts to original assets: ' + ', '.join(sorted(hidden - matched)))
    for layer in sorted(visible_layers):
        gear = gear_entries[layer]
        key = gear['slot'] + 'Gear'
        if key in preset and preset[key]['name'] != gear['name']:
            raise ValueError('Multiple clothing layers in ' + gear['slot'] + ' cannot be named faithfully in the legacy format.')
        preset[key] = gear
    return slots, preset, warnings


def build_package(assembly, state, load_pixels, mesh_names):
    slots, preset, warnings = effective_slots(assembly, state, mesh_names)
    # Empty slots contain no rendered colors; do not block export on their unused swatches.
    slots = [s for s in slots if s['slotName'] == 'skinMats' or s.get('models')]
    colors = translate_colors(slots, load_pixels)
    if not colors['ready']:
        raise ValueError('ZG color export needs attention:\n' + '\n'.join(
            d['location'] + ': ' + d['message'] for d in colors['diagnostics']))
    slots = colors['definition']
    skin_records = [m for s in slots if s['slotName'] == 'skinMats' for m in s['materialInfo']['mats']]
    skins = {}
    for info in skin_records:
        name = info['slotName']
        if name not in SLOTS:
            raise ValueError('Unsupported skin slot: ' + name)
        normalized = legacy_material(info)
        skins[name] = {'slotName': name, 'materialInfo': {'matPath': normalized['matPath']},
                       'ddsPaths': normalized['ddsPaths'], 'otherValues': normalized['otherValues']}
    merged = {}
    for slot in slots:
        name = slot['slotName']
        if name == 'skinMats':
            continue
        if name not in SLOTS:
            raise ValueError('This character uses an unsupported legacy slot: ' + name)
        info = slot['materialInfo']
        base = legacy_material(info)
        for index, override in info.get('materialOverrides', {}).items():
            normalized = legacy_material(override, eye=name in ('head', 'creature') and index == '1')
            if name in ('head', 'creature') and index == '1' and normalized['otherValues']['derived'] == 'Eye':
                base['eyeMatInfo'] = normalized
            elif signature(normalized) != signature(base):
                raise ValueError(f'{name} has a distinct material override at index {index}; the legacy importer cannot preserve it.')
        if int(base['otherValues']['materialSkinIndex']) >= 0 and name not in skins:
            raise ValueError(name + ' refers to a skin material that is missing.')
        if name in merged and signature(merged[name]['materialInfo']) != signature(base):
            raise ValueError(name + ' pieces have different colors or materials. ZG shares one material per slot; use matching colors for these pieces.')
        target = merged.setdefault(name, {'slotName': name, 'models': [], 'materialInfo': base})
        for model in slot['models']:
            model = game_path(model, '.gr2')
            if model in target['models']:
                raise ValueError('A model is used more than once in ' + name + ': ' + model)
            target['models'].append(model)
    if not merged:
        raise ValueError('There are no visible character models to export.')
    paths = [merged[name] for name in SLOTS if name in merged]
    # The legacy importer always consults skinMats for SkinB, even when the
    # material is a naked body's primary material rather than a garment inset.
    for slot in paths:
        name, info = slot['slotName'], slot['materialInfo']
        if name in skins and info['otherValues']['derived'] == 'SkinB':
            skins[name] = {'slotName': name, 'materialInfo': {'matPath': info['matPath']},
                           'ddsPaths': copy.deepcopy(info['ddsPaths']), 'otherValues': copy.deepcopy(info['otherValues'])}
    paths.append({'slotName': 'skinMats', 'models': [], 'materialInfo': {'mats': list(skins.values())}})
    # The importer uses image basenames globally, and models in per-slot folders.
    images = {}
    def visit(obj):
        if isinstance(obj, dict):
            for texture in obj.get('ddsPaths', {}).values():
                basename = PurePosixPath(texture).name.lower()
                if basename in images and images[basename] != texture.lower():
                    raise ValueError('Conflicting texture filenames in ZG: ' + texture)
                images[basename] = texture.lower()
            for value in obj.values():
                visit(value)
        elif isinstance(obj, list):
            for value in obj:
                visit(value)
    visit(paths)
    model_names = set()
    for slot in paths:
        for model in slot['models']:
            basename = PurePosixPath(model).name.lower()
            if basename in model_names:
                raise ValueError('Conflicting model filenames in ZG: ' + model)
            model_names.add(basename)
    preset = {key: value for key, value in preset.items() if value['slot'] in merged}
    return {'paths': paths, 'skeleton': {'path': game_path(assembly['profile']['skeleton'], '.gr2')},
            'preset': preset, 'warnings': warnings, 'colorsTranslated': len(colors['converted'])}
