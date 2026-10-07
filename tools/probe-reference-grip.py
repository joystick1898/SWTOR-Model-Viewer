import bpy,json,numpy as np
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='F:/TTS Files/Unity Files/Tabletop-Simulator-Modding-master 2/Assets/StarWarsModels/TOR Extracts/Atton Rand/AttonRand.fbx')
report=[]
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        report.append({'name':o.name,'vertices':len(o.data.vertices),'parent':o.parent.name if o.parent else None,'parentBone':o.parent_bone,'groups':[g.name for g in o.vertex_groups][:12],'matrix':[list(r) for r in o.matrix_world]})
    if o.type=='ARMATURE':
        report.append({'rig':o.name,'bones':len(o.data.bones),'sockets':{b.name:[list(r) for r in o.matrix_world@b.matrix] for b in o.pose.bones if 'Weapon' in b.name or 'Wrist' in b.name}})
Path('reports/reference-grip.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
