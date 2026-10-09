"""Integration check against unmodified matched ZG / GR2 release add-ons."""
import argparse
import json
import sys
from pathlib import Path

import bpy
import addon_utils


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', required=True)
    parser.add_argument('--zg-addons', required=True)
    parser.add_argument('--gr2-addons', required=True)
    parser.add_argument('--resources')
    parser.add_argument('--report', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    root = Path(__file__).resolve().parents[1]
    config = json.loads((root / 'development.local.json').read_text(encoding='utf-8'))
    folder = Path(args.package).resolve()
    resources = Path(args.resources or (folder / 'Resources' if (folder / 'Resources').exists() else config['resources']))
    # Never let upstream's legacy black.dds fix write into the original extraction.
    if not (resources / 'art/defaultassets/black.dds').exists():
        raise ValueError('Test Resources must already contain art/defaultassets/black.dds')
    sys.path[:0] = [args.gr2_addons, args.zg_addons]
    addon_utils.enable('io_scene_gr2', default_set=True, persistent=False)
    addon_utils.enable('zg_swtor_tools', default_set=True, persistent=False)
    import io_scene_gr2
    import zg_swtor_tools
    bpy.context.preferences.addons['zg_swtor_tools'].preferences.swtor_resources_folderpath = str(resources)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    paths_file = folder / 'assets/paths.json'
    paths = json.loads(paths_file.read_text(encoding='utf-8'))
    area = next(a for a in bpy.context.screen.areas if a.type == 'VIEW_3D')
    with bpy.context.temp_override(area=area):
        result = bpy.ops.zgswtor.character_assembler(filepath=str(paths_file),
            import_skeleton=True, bind_to_skeleton=True, collect=True,
            separate_eyes=False, correct_twilek_eyes_uv=False)
    assert result == {'FINISHED'}, result
    expected = [Path(p).stem for s in paths for p in s['models']]
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    assert set(expected) == {o.name for o in meshes}, (expected, [o.name for o in meshes])
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    assert len(armatures) == 1, len(armatures)
    skin = {m['slotName']: m for s in paths if s['slotName'] == 'skinMats' for m in s['materialInfo']['mats']}
    checks = []
    for slot in paths:
        for model in slot['models']:
            obj = bpy.data.objects[Path(model).stem]
            assert any(m.type == 'ARMATURE' and m.object == armatures[0] for m in obj.modifiers), obj.name
            assert any(g.name in armatures[0].data.bones for g in obj.vertex_groups), obj.name
            for index, material in enumerate(obj.data.materials):
                info = slot['materialInfo']
                if index == int(info['otherValues']['materialSkinIndex']):
                    info = skin[slot['slotName']]
                elif slot['slotName'] in ('head', 'creature') and index == 1:
                    info = info['eyeMatInfo']
                node = next(n for n in material.node_tree.nodes if n.bl_idname == 'ShaderNodeHeroEngine')
                assert node.derived == info['otherValues']['derived'].upper(), (obj.name, index, node.derived)
                for key in ('diffuseMap', 'rotationMap', 'glossMap', 'paletteMap', 'paletteMaskMap'):
                    if key in info['ddsPaths']:
                        image = getattr(node, key)
                        assert image is not None, (obj.name, key)
                        # Blender loads image pixels lazily in background mode.
                        assert len(image.pixels) > 0 and image.size[0] > 0, image.name
                for channel in ((1, 2) if node.derived == 'GARMENT' else (1,) if node.derived in ('SKINB','EYE','HAIRC') else ()):
                    actual = [getattr(node, f'palette{channel}_{p}') for p in ('hue','saturation','brightness','contrast')]
                    wanted = info['otherValues'][f'palette{channel}']
                    assert max(abs(a-b) for a,b in zip(actual,wanted)) < 1e-6, (obj.name, actual, wanted)
                checks.append({'object': obj.name, 'materialIndex': index, 'family': node.derived})
    report = {'passed': True, 'blender': bpy.app.version_string,
              'zg': list(zg_swtor_tools.bl_info['version']), 'gr2': list(io_scene_gr2.bl_info['version']),
              'models': len(meshes), 'bones': len(armatures[0].data.bones), 'materials': checks,
              'scope': 'Actual Character Assembler import; mesh set, shader families/palettes, loaded images, armature bindings.'}
    Path(args.report).write_text(json.dumps(report, indent=2), encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'verified.blend'))
    print('ZG_IMPORT_PASS', len(meshes), 'models')


if __name__ == '__main__':
    main()
