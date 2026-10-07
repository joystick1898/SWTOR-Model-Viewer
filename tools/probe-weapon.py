import bpy,addon_utils,sys,json
from pathlib import Path
sys.dont_write_bytecode=True
addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences
p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
root=Path('G:/Old Republic Assets/resources')
bpy.ops.import_mesh.gr2(filepath=str(root/'art/dynamic/spec/bmnnew_skeleton.gr2'))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
bpy.ops.import_mesh.gr2(filepath=str(root/'art/dynamic/weapon/blaster/blaster_high02_a03.gr2'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
report={'bones':{b.name:{'matrix':[list(r) for r in b.matrix_local],'head':list(b.head_local),'tail':list(b.tail_local)} for b in arm.data.bones if 'Weapon' in b.name or 'Wrist' in b.name},'weapons':[{'name':o.name,'matrix':[list(r) for r in o.matrix_world],'bounds':[list(v) for v in o.bound_box],'materials':[m.name for m in o.data.materials],'groups':[g.name for g in o.vertex_groups]} for o in meshes]}
Path('reports/weapon-probe.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
