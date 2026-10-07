import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
p=json.loads(Path('reports/app-pipeline-smoke.json').read_text())
bpy.ops.import_scene.fbx(filepath=p['completeFile'])
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
socket=arm.pose.bones['RightWeapon'].matrix.inverted()
for b in arm.pose.bones:
    if b.name.startswith('Right') and any(n in b.name for n in ['Finger','Wrist','Weapon']):print(b.name, list(socket@b.head))
