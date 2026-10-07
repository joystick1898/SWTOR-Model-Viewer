import bpy,json,sys,addon_utils
from pathlib import Path
sys.path.insert(0,'C:/Users/BRShe/AppData/Roaming/Blender Foundation/Blender/4.3/scripts/addons');addon_utils.enable('io_scene_gr2',default_set=True,persistent=False);p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root='G:/Old Republic Assets/resources/'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
from io_scene_gr2.ops.import_gr2 import read
from mathutils import Matrix
sys.path.insert(0,'worker')
from sabers import sockets,emitters
p=Path(root+'art/dynamic/weapon/model/dualsaber_mtx06_a01_v01.gr2')
print([(n,tuple(m.to_3x3()@__import__('mathutils').Vector((0,1,0)))) for n,m in sockets(p)])
print([(n,v) for n,m,v in emitters(p,'dualsaber',Path(root))])
