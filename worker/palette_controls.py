"""Shared native palette overrides, applied after optional wheel calibration."""
import math
import json

PROPERTIES = ('hue', 'saturation', 'brightness', 'contrast')
LIMITS = ((0, 1), (0, 1), (-1, 1), (0, 3))


def material_palettes(materials):
    return [json.loads(material['nativePaletteInfo']) for material in materials
            if material is not None and material.get('nativePaletteInfo')]


def apply_selection(values, color, channel, index, fallback=False):
    key = f'palette{index}'
    if fallback and (values.get(key + 'Color') or values.get(key + 'Controls')):
        return
    if color.get(channel):
        values[key + 'Color'] = color[channel]
    if color.get(channel + 'Palette'):
        values[key + 'Controls'] = dict(color[channel + 'Palette'])


def override_palette(vector, controls):
    if not isinstance(controls, dict) or any(k not in PROPERTIES for k in controls):
        raise ValueError('Invalid native palette controls')
    if (not isinstance(vector, (list, tuple)) or len(vector) != 4 or
            any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v) for v in vector)):
        raise ValueError('Expected four finite native palette numbers')
    # Blender clamps each source property before applying fine-tuning.
    result = [max(low, min(high, value)) for value, (low, high) in zip(vector, LIMITS)]
    for i, (name, (low, high)) in enumerate(zip(PROPERTIES, LIMITS)):
        if name not in controls:
            continue
        value = controls[name]
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f'Native {name} must be between {low} and {high}')
        result[i] = value
    return result
