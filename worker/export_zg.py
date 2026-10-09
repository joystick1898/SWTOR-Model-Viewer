"""Export resolved metadata for the unmodified ZG Character Assembler."""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import SimpleNamespace

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resource_source import source
from zg_export import build_package, game_path


def main():
    request = json.loads(Path(sys.argv[sys.argv.index('--') + 1]).read_text(encoding='utf-8'))
    sys.path.insert(0, request['addons'])
    from io_scene_gr2.ops.import_gr2 import read
    root = Path(request['resources']).resolve()
    dependencies = {}
    recovered = []

    def asset(relative):
        relative = game_path(relative).lstrip('/')
        file = source(root, relative)
        if not file.is_file():
            raise ValueError('Missing ZG dependency: ' + relative)
        dependencies[relative] = str(file)
        if not (root / relative).is_file() and relative not in recovered:
            recovered.append(relative)
        return file

    meshes = {}
    def mesh_names(relative):
        if relative not in meshes:
            def report(level, message):
                if 'ERROR' in level:
                    raise ValueError(message)
            mesh = read(SimpleNamespace(report=report), str(asset(relative)))
            if not mesh:
                raise ValueError('Cannot read model: ' + relative)
            entries = [m for m in mesh.mesh_buffer.values() if 'collision' not in m.name]
            if len(entries) != 1:
                raise ValueError('ZG legacy import requires a single visible mesh per file: ' + relative)
            meshes[relative] = entries
        # Preview workers use the bundled importer's internal mesh names.
        return [m.name for m in meshes[relative]]

    def pixels(relative):
        image = bpy.data.images.load(str(asset(relative)), check_existing=False)
        try:
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            return pixels.reshape(image.size[1],image.size[0],4)
        finally:
            bpy.data.images.remove(image)

    package = build_package(request['assembly'], request.get('state', {}), pixels, mesh_names)
    asset(package['skeleton']['path'])
    asset('/art/defaultassets/black.dds')
    modern = {'DiffuseMap': 'diffuseMap', 'RotationMap1': 'rotationMap', 'GlossMap': 'glossMap',
              'PaletteMap': 'paletteMap', 'PaletteMaskMap': 'paletteMaskMap'}
    def check_material(info):
        mat = info.get('matPath') or info.get('materialInfo', {}).get('matPath')
        xml = ET.parse(asset(mat)).getroot() if mat else ET.Element('Material')
        maps = info['ddsPaths']
        for item in xml.findall('input'):
            semantic, value = item.findtext('semantic'), item.findtext('value')
            if not value:
                continue
            if semantic in modern or semantic in ('DirectionMap', 'animatedWrinkleMap', 'animatedWrinkleMask'):
                relative = game_path(value + '.dds', '.dds')
                asset(relative)
                key = modern.get(semantic)
                if key in maps and maps[key].lower() != relative.lower():
                    raise ValueError('ZG would replace a preview texture with a different one: ' + mat + ' (' + key + '). Refresh the source materials before exporting.')
                if semantic == 'DirectionMap' and info['otherValues']['derived'] in ('HairC', 'Creature'):
                    maps['directionMap'] = relative
        for relative in maps.values():
            asset(relative)
        if info['otherValues']['derived'] == 'HairC' and 'directionMap' not in maps:
            raise ValueError('ZG requires a hair DirectionMap: ' + mat)
        if info.get('eyeMatInfo'):
            check_material(info['eyeMatInfo'])

    for slot in package['paths']:
        if slot['slotName'] == 'skinMats':
            for info in slot['materialInfo']['mats']:
                check_material(info)
            continue
        check_material(slot['materialInfo'])
        for model in slot['models']:
            mesh_names(model)
            entries = meshes.get(model) or meshes.get(model.lstrip('/'))
            count = len(entries[0].piece_header_buffer)
            if slot['slotName'] in ('head', 'creature') and count > 1 and not slot['materialInfo'].get('eyeMatInfo'):
                raise ValueError('Head has an eye material slot but no eye material metadata.')
    package['dependencies'] = dependencies
    package['recoveredResources'] = recovered
    Path(request['output']).write_text(json.dumps(package, indent=2, allow_nan=False), encoding='utf-8')
    print('ZG_EXPORT_READY', len(package['paths']), 'slots;', len(dependencies), 'dependencies')


if __name__ == '__main__':
    main()
