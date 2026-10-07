import bpy,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
results=[]
for r in json.loads(Path('reports/browser-extra-exports.json').read_text()):
 assert 'error' not in r,r
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=r['destination'],use_image_search=False)
 arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];assert len(arms)==int(r['rigged'])
 expected=json.loads((Path(r['file']).parent/'expected-pose.json').read_text());errors=[];dep=bpy.context.evaluated_depsgraph_get()
 for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  tree=KDTree(len(expected[o.name]));[tree.insert(Vector(v),i) for i,v in enumerate(expected[o.name])];tree.balance();errors.append(max(tree.find(o.matrix_world@v.co)[2] for v in o.evaluated_get(dep).data.vertices))
  for m in o.data.materials:
   bsdf=m.node_tree.nodes.get('Principled BSDF');assert bsdf.inputs['Base Color'].links[0].from_node.image.packed_file;assert bsdf.inputs['Normal'].is_linked
 assert max(errors)<.00001,(r['id'],errors)
 results.append({'id':r['id'],'rigged':bool(arms),'maxPoseError':max(errors)})
Path('reports/browser-extra-roundtrip.json').write_text(json.dumps({'ok':True,'results':results},indent=2));print('EXTRA_FBX_PASS',len(results))
