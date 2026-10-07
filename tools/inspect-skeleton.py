import sys, json
from pathlib import Path
import bpy, addon_utils
sys.dont_write_bytecode = True
sys.path.insert(0, r'C:\Users\BRShe\AppData\Roaming\Blender Foundation\Blender\4.3\scripts\addons')
addon_utils.enable('io_scene_gr2', default_set=True, persistent=False)
p = bpy.context.preferences.addons['io_scene_gr2'].preferences
p.gr2_scale_object = False
p.gr2_apply_axis_conversion = False
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_mesh.gr2(filepath=r'G:\Old Republic Assets\resources\art\dynamic\spec\bmnnew_skeleton.gr2')
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
bones = [{'name': b.name, 'parent': b.parent.name if b.parent else None, 'matrix_local': [list(row) for row in b.matrix_local]} for b in arm.data.bones]
legacy = json.loads(Path('reports/jba-pair.json').read_text())['legacyTrackNames']
names = [b['name'] for b in bones]
comparison = [{'track': i, 'legacy': n, 'skeleton_index': names.index('Bip01' if n == 'GOD' else n) if ('Bip01' if n == 'GOD' else n) in names else None} for i,n in enumerate(legacy)]
report = {'bones': bones, 'legacy_comparison': comparison, 'object_matrix': [list(row) for row in arm.matrix_world]}
Path('reports/skeleton-map.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'bone_count':len(bones),'mapping':comparison}))
