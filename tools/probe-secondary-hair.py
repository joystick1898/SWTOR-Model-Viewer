import bpy,addon_utils,json
from pathlib import Path
addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root=Path('G:/Old Republic Assets/resources')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_mesh.gr2(filepath=str(root/'art/dynamic/spec/bfnnew_skeleton.gr2'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
records=[]
for part in ['', '_sides','_ponytail']:
    file=root/f'art/dynamic/hair/model/hair_human_bfn_non_a05{part}.gr2'
    before=set(bpy.data.objects);bpy.ops.import_mesh.gr2(filepath=str(file))
    for o in set(bpy.data.objects)-before:
        if o.type!='MESH':continue
        records.append({'mesh':o.name,'groups':[{'name':g.name,'inSkeleton':g.name in arm.data.bones,'vertices':sum(any(w.group==g.index and w.weight>.001 for w in v.groups) for v in o.data.vertices)} for g in o.vertex_groups]})
Path('reports/hair-weight-probe.json').write_text(json.dumps(records,indent=2));print(json.dumps(records))
