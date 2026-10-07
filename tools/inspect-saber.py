import bpy,json,sys,addon_utils
from pathlib import Path
sys.path.insert(0,'C:/Users/BRShe/AppData/Roaming/Blender Foundation/Blender/4.3/scripts/addons');addon_utils.enable('io_scene_gr2',default_set=True,persistent=False);p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root='G:/Old Republic Assets/resources/'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
from io_scene_gr2.ops.import_gr2 import read
from mathutils import Matrix
for name in ['saber_gs07_a01_v01','dualsaber_gs07_a01_v01']:
 g=read(None,root+'art/dynamic/weapon/model/'+name+'.gr2')
 print(name,'bones',len(g.bone_buffer))
 for b in g.bone_buffer.values():
  print(b.name, getattr(b,'root_to_bone',None))
