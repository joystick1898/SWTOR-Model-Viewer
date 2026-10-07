import bpy,json,sys,addon_utils
from pathlib import Path
sys.path.insert(0,'C:/Users/BRShe/AppData/Roaming/Blender Foundation/Blender/4.3/scripts/addons');addon_utils.enable('io_scene_gr2',default_set=True,persistent=False);p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root='G:/Old Republic Assets/resources/'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for rel in ['art/dynamic/spec/bmnnew_skeleton.gr2','art/dynamic/weapon/model/rifle_gs04_a01_v01.gr2','art/dynamic/weapon/blaster/blaster_high02_a03.gr2','art/dynamic/weapon/model/rifle_high08_a03_v01.gr2']:
 before=set(bpy.data.objects);bpy.ops.import_mesh.gr2(filepath=root+rel)
 for o in set(bpy.data.objects)-before:
  if o.type=='MESH':print('OBJECT',o.name,'DIM',list(o.dimensions),'BBOX',[list(v) for v in o.bound_box],'MATRIX',[list(v) for v in o.matrix_world])
  if o.type=='ARMATURE':
   for name in ['RightWeapon','socket_saber_left','socket_saber_right','vfx_jetpack_back']:print('BONE',name,[list(v) for v in o.data.bones[name].matrix_local])
