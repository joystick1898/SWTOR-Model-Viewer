"""Run in Blender: compare exported palettes with the actual preview shader.

Stops MaterialPipeline.bake immediately after its color setup, before baking or
editing shader graphs. Uses private Atton assets; no game data is committed.
Optional arguments after --: --addons PATH --output PATH.
"""
import argparse
import copy
import json
import sys
import tempfile
from pathlib import Path

import addon_utils
import bpy
import numpy as np

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / 'worker'))
from materials import MaterialPipeline
from zg_colors import translate_colors


class ColorSetupComplete(Exception):
    pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--addons')
    parser.add_argument('--output', default=str(PROJECT / 'reports/zg-color-parity.json'))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    config = json.loads((PROJECT / 'development.local.json').read_text(encoding='utf-8'))
    addons = args.addons or config['addons']
    sys.path.insert(0, addons)
    addon_utils.enable('io_scene_gr2', default_set=False, persistent=False)
    import io_scene_gr2
    slots = json.loads((Path(config['fixture']) / 'assets/paths_corrected.json').read_text(encoding='utf-8'))
    head = next(s['materialInfo'] for s in slots if s['slotName'] == 'head')
    samples = {'skin': head, 'eyes': head['eyeMatInfo'],
               'hair': next(s['materialInfo'] for s in slots if s['slotName'] == 'hair'),
               'armor': next(s['materialInfo'] for s in slots if s['slotName'] == 'chest')}
    records = []
    with tempfile.TemporaryDirectory(prefix='swtor-zg-colors-') as cache:
        pipeline = MaterialPipeline(Path(config['resources']), cache)

        def pixels(relative):
            return np.asarray(pipeline.image(relative).pixels[:], dtype=np.float32)

        for label, original in samples.items():
            for swatch in ('#8040C0', '#000000', '#FFFFFF', '#808080', '#20A060', '#FF0000', None):
                info = copy.deepcopy(original)
                info.pop('eyeMatInfo', None)
                info.pop('materialOverrides', None)
                channels = (1, 2) if label == 'armor' else (1,)
                for index in channels:
                    if swatch:
                        info['otherValues'][f'palette{index}Color'] = swatch
                    if swatch in ('#FF0000', None):
                        info['otherValues'][f'palette{index}Controls'] = {'hue': .9, 'saturation': 0, 'brightness': -.032, 'contrast': 1.029}
                result = translate_colors(info, pixels)
                assert result['ready'], result['diagnostics']
                captured = {}

                def trace(frame, event, arg):
                    if frame.f_code is MaterialPipeline.bake.__code__ and event == 'line':
                        # This line follows both palette calibrations in the real
                        # preview method. No copied calibration formula here.
                        import linecache
                        if linecache.getline(frame.f_code.co_filename, frame.f_lineno).strip() == 'group=shader.node_tree':
                            shader = frame.f_locals['shader']
                            for index in channels:
                                captured[index] = [getattr(shader, f'palette{index}_{p}')
                                                   for p in ('hue', 'saturation', 'brightness', 'contrast')]
                            raise ColorSetupComplete()
                    return trace

                previous = sys.gettrace()
                before = set(bpy.data.materials)
                try:
                    sys.settrace(trace)
                    # The matched importer's alpha callback expects a Blender
                    # editor context even in background mode. Supply one without
                    # patching the add-on or opening a visible application.
                    area = next(a for a in bpy.context.screen.areas if a.type == 'VIEW_3D')
                    with bpy.context.temp_override(area=area):
                        pipeline.bake(info, {}, {})
                    raise AssertionError('Preview color checkpoint was not reached')
                except ColorSetupComplete:
                    pass
                finally:
                    sys.settrace(previous)
                    for mat in set(bpy.data.materials) - before:
                        bpy.data.materials.remove(mat)
                for index in channels:
                    translated = result['definition']['otherValues'][f'palette{index}']
                    assert captured[index] == translated, (label, swatch, captured[index], translated)
                    records.append({'material': label, 'channel': index, 'swatch': swatch,
                                    'palette': translated, 'maxError': 0})

        # Produce a real request for the standalone color adapter too.
        folder = PROJECT / 'output/zg-color-check'
        folder.mkdir(parents=True, exist_ok=True)
        source = folder / 'source.json'
        source.write_text(json.dumps(info), encoding='utf-8')
        (folder / 'request.json').write_text(json.dumps({
            'input': str(source), 'output': str(folder / 'translated.json'),
            'resources': config['resources']}), encoding='utf-8')
    report = {'blender': bpy.app.version_string, 'importer': list(io_scene_gr2.bl_info['version']),
              'checks': len(records), 'passed': True, 'results': records,
              'scope': 'Exact shader parameter parity on real DDS inputs; full ZG import and visual parity not tested.'}
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f"ZG_COLOR_PARITY_PASS: {len(records)} shader palette comparisons")


if __name__ == '__main__':
    main()
