import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
r=json.loads(Path('reports/expression-smoke.json').read_text(encoding='utf-8'))
def poses(file):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=file)
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');result={}
 for frame in [1,8,17]:
  bpy.context.scene.frame_set(frame);result[frame]={b.name:[list(row) for row in b.matrix_basis] for b in arm.pose.bones}
 return result
neutral=poses(r['neutral']['file']);joy=poses(r['preview']['file'])
body=face=0
for frame in neutral:
 for name,a in neutral[frame].items():
  delta=max(abs(a[i][j]-joy[frame][name][i][j]) for i in range(4) for j in range(4))
  if name.startswith('fc_'):face=max(face,delta)
  else:body=max(body,delta)
assert body<1e-5,body
assert face>1e-4,face
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=r['exported']['file'],use_image_search=False)
expected=json.loads((Path(r['exported']['file']).parent/'expected-pose.json').read_text())
errors=[]
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 tree=KDTree(len(expected[obj.name]))
 for i,v in enumerate(expected[obj.name]):tree.insert(Vector(v),i)
 tree.balance();errors.append(max(tree.find(obj.matrix_world@v.co)[2] for v in obj.data.vertices))
assert max(errors)<1e-5,errors
Path('reports/expression-verification.json').write_text(json.dumps({'ok':True,'bodyTransformDifference':body,'facialTransformDifference':face,'fbxPoseError':max(errors)},indent=2))
print('EXPRESSION_PASS',body,face,max(errors))
