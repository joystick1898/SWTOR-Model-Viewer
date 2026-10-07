import bpy,addon_utils,json,time
from pathlib import Path
addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
root=Path('G:/Old Republic Assets/resources');results=[]
for index,asset in enumerate(json.loads(Path('output/all-npc-creature-files.json').read_text())):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 try:
  bpy.ops.import_mesh.gr2(filepath=str(root/asset['id']))
  meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bones=sorted({g.name for o in meshes for g in o.vertex_groups})
  results.append({'id':asset['id'],'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'bones':bones,'materials':sorted({m.name for o in meshes for m in o.data.materials})})
 except Exception as e:results.append({'id':asset['id'],'error':str(e)})
 if index%25==0:Path('reports/all-npc-creature-meshes.json').write_text(json.dumps(results,indent=2))
 bpy.ops.outliner.orphans_purge(do_recursive=True)
Path('reports/all-npc-creature-meshes.json').write_text(json.dumps(results,indent=2));print('ALL_MESH_SCAN',len(results))
