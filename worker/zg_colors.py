"""Translate resolved viewer material colors to legacy SWTOR palette metadata.

This adapter does not change the preview pipeline or serialize a full paths.json.
The caller supplies pixels decoded exactly as MaterialPipeline.image() does.
Unsupported edits remain in the returned copy and block a lossless export.
"""
import copy
import math
import re
from collections import OrderedDict

import numpy as np

from palette import palette_offsets
from palette_controls import override_palette


PALETTE_CHANNELS = {'Garment': (1, 2), 'GarmentScrolling': (1, 2),
                    'Eye': (1,), 'SkinB': (1,), 'HairC': (1,)}


def translate_colors(definition, load_pixels):
    """Return {definition, ready, converted, diagnostics}; never mutate input.

    Accept a resolved assembly, slots array, or individual material. Recursion
    covers eyeMatInfo, skinMats, materialOverrides and resolved equipment. This
    only validates color representability, not geometry or slot compatibility.
    """
    result = copy.deepcopy(definition)
    diagnostics, converted = [], []
    cache = {}
    image_cache = OrderedDict()

    def image_pixels(texture):
        if texture not in image_cache:
            pixels = np.asarray(load_pixels(texture), dtype=np.float32)
            if pixels.size == 0 or pixels.size % 4 or not np.isfinite(pixels).all():
                raise ValueError('Palette image must contain finite RGBA pixels.')
            image_cache[texture] = pixels
            # Reuse a palette/mask pair across channels without retaining every
            # high-resolution texture in a large character assembly.
            if len(image_cache) > 2:
                image_cache.popitem(last=False)
        image_cache.move_to_end(texture)
        return image_cache[texture]

    def issue(location, code, message):
        diagnostics.append({'location': location, 'code': code, 'message': message})

    def visit(obj, location):
        if isinstance(obj, list):
            for index, value in enumerate(obj):
                visit(value, f'{location}/{index}')
            return
        if not isinstance(obj, dict):
            return
        values = obj.get('otherValues')
        if isinstance(values, dict):
            for index in (1, 2):
                key = f'palette{index}'
                swatch_key = key + 'Color'
                if swatch_key not in values:
                    continue
                where = f'{location}/otherValues/{swatch_key}'
                swatch = values[swatch_key]
                if not isinstance(swatch, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', swatch):
                    issue(where, 'invalid-swatch', 'Expected a six-digit RGB hex color.')
                    continue
                family = values.get('derived')
                if index not in PALETTE_CHANNELS.get(family, ()):
                    issue(where, 'unsupported-channel',
                          f'{family} does not expose palette {index} through the target JSON importer.')
                    continue
                texture = obj.get('ddsPaths', {}).get('paletteMap')
                if not isinstance(texture, str) or texture.replace('\\', '/') in ('', '/.dds', '.dds'):
                    issue(where, 'missing-palette-map',
                          'This tint has no usable palette map; native palette metadata cannot preserve it.')
                    continue
                vector = values.get(key, [0, 0, 0, 1])
                if (not isinstance(vector, (list, tuple)) or len(vector) != 4 or
                        any(isinstance(v, bool) or not isinstance(v, (float, int)) or
                            not math.isfinite(v) for v in vector)):
                    issue(where, 'invalid-palette', 'Expected four finite native palette numbers.')
                    continue
                contrast = float(vector[3])
                if not 0 <= contrast <= 3:
                    issue(where, 'invalid-contrast', 'Native palette contrast must be between 0 and 3.')
                    continue
                mask_path = obj.get('ddsPaths', {}).get('paletteMaskMap') if family in ('Garment', 'GarmentScrolling') else None
                cache_key = (texture, mask_path, index, swatch.upper(), contrast)
                try:
                    if cache_key not in cache:
                        pixels = image_pixels(texture)
                        mask = image_pixels(mask_path) if mask_path else None
                        if mask is not None and pixels.ndim == 3 and mask.ndim == 3 and pixels.shape != mask.shape:
                            mask = None
                        offsets = palette_offsets(swatch, pixels, contrast, mask, index)
                        if not all(math.isfinite(v) for v in offsets):
                            raise ValueError('Palette calibration produced non-finite values.')
                        # Blender FloatProperty stores float32; preserve the values
                        # actually assigned by the existing preview calibration.
                        cache[cache_key] = [float(np.float32(v)) for v in offsets]
                    values[key] = list(cache[cache_key])
                except (OSError, ValueError, RuntimeError) as error:
                    issue(where, 'palette-read-failed', str(error))
                    continue
                del values[swatch_key]
                converted.append({'location': where, 'swatch': swatch.upper(),
                                  'paletteMap': texture, 'palette': list(values[key])})
            for index in (1, 2):
                key = f'palette{index}'
                controls = values.get(key + 'Controls')
                if controls is None:
                    continue
                where = f'{location}/otherValues/{key}Controls'
                try:
                    if index not in PALETTE_CHANNELS.get(values.get('derived'), ()):
                        raise ValueError(f"{values.get('derived')} does not support native palette {index} controls")
                    vector = override_palette(values.get(key, [0, .5, 0, 1]), controls)
                    values[key] = [float(np.float32(v)) for v in vector]
                    del values[key + 'Controls']
                except (ValueError, TypeError) as error:
                    issue(where, 'invalid-native-controls', str(error))
        for key, value in obj.items():
            if key not in ('otherValues', 'ddsPaths'):
                escaped = str(key).replace('~', '~0').replace('/', '~1')
                visit(value, f'{location}/{escaped}')

    visit(result, '')
    return {'definition': result, 'ready': not diagnostics,
            'converted': converted, 'diagnostics': diagnostics}
