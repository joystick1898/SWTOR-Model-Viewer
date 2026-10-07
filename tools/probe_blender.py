"""Isolated geometry-only GR2 -> FBX -> Blender probe. No user preferences saved."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
import addon_utils

parser = argparse.ArgumentParser()
parser.add_argument('--addons', required=True)
parser.add_argument('--mesh', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(args.out).resolve()
mesh = Path(args.mesh).resolve()
if mesh.parent == out or mesh.is_relative_to(out):
    raise ValueError('Use a separate output directory')
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, args.addons)
sys.dont_write_bytecode = True
addon_utils.enable('io_scene_gr2', default_set=True, persistent=False)
import io_scene_gr2
prefs = bpy.context.preferences.addons['io_scene_gr2'].preferences
# Scripted calls in this importer use preferences rather than operator properties.
prefs.gr2_scale_object = False
prefs.gr2_scale_factor = 1.0
prefs.gr2_apply_axis_conversion = False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
result = bpy.ops.import_mesh.gr2(filepath=str(mesh))
if 'FINISHED' not in result:
    raise RuntimeError(f'Import failed: {result}')

def describe():
    return [{'name': o.name, 'type': o.type,
             'vertices': len(o.data.vertices) if o.type == 'MESH' else None,
             'polygons': len(o.data.polygons) if o.type == 'MESH' else None,
             'uv_layers': len(o.data.uv_layers) if o.type == 'MESH' else None,
             'vertex_groups': len(o.vertex_groups),
             'dimensions': list(o.dimensions),
             'materials': [m.name if m else None for m in o.data.materials] if o.type == 'MESH' else []}
            for o in bpy.context.scene.objects]

report = {'blender': bpy.app.version_string, 'importer': io_scene_gr2.bl_info['version'],
          'source': str(mesh), 'source_sha256': hashlib.sha256(mesh.read_bytes()).hexdigest(),
          'scope': 'Geometry-only probe; no material fidelity, rig, animation, Unity or TTS validation',
          'before': describe()}
if not any(o['vertices'] for o in report['before']):
    raise RuntimeError('No mesh geometry imported')
fbx = out / (mesh.stem + '.fbx')
bpy.ops.export_scene.fbx(filepath=str(fbx), use_selection=False, object_types={'MESH','ARMATURE'}, add_leaf_bones=False, bake_anim=False)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(fbx))
report['after'] = describe()
report['fbx'] = str(fbx)
report['fbx_bytes'] = fbx.stat().st_size
report['vertex_count_preserved'] = sum(o['vertices'] or 0 for o in report['before']) == sum(o['vertices'] or 0 for o in report['after'])
(out / 'probe.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('PROBE_RESULT ' + json.dumps(report))
if not report['vertex_count_preserved']:
    raise RuntimeError('FBX round trip changed vertex count')
