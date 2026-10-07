import bpy,sys,addon_utils,json
from pathlib import Path
sys.path.insert(0,str(Path('worker').resolve()));from sabers import sockets,emitters
sys.path.insert(0,'C:/Users/BRShe/AppData/Roaming/Blender Foundation/Blender/4.3/scripts/addons');addon_utils.enable('io_scene_gr2',default_set=True)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root=Path('G:/Old Republic Assets/resources')
for rel in ['art/dynamic/weapon/lightsaber/dualsaber_sithlow03_a01.gr2','art/dynamic/weapon/lightsaber/dualsaber_jedihigh01_a01_v01.gr2','art/dynamic/weapon/model/dualsaber_gs07_a01_v01.gr2']:
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete();bpy.ops.import_mesh.gr2(filepath=str(root/rel));o=next(o for o in bpy.data.objects if o.type=='MESH')
 print('INSPECT',rel,'bounds',[(min(v.co[i] for v in o.data.vertices),max(v.co[i] for v in o.data.vertices)) for i in range(3)],'matrix',list(o.matrix_world),'sockets',[(n,[list(row) for row in m]) for n,m in sockets(root/rel)])

