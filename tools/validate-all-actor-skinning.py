import bpy,addon_utils,json,sys,math,time
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path('worker').resolve()))
from secondary import anchor_cloth,anchor_world
addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
r=json.loads(Path('output/all-actor-validation-input.json').read_text());root=Path(r['resources']);results=[]
previous=json.loads(Path('reports/all-actor-skinning-validation.json').read_text())['results'] if '--repair-only' in sys.argv else []
repair_ids={a['id'] for a in previous if a.get('unboundWeightFraction',0)>0 or not a.get('ok')}
if previous:results=[a for a in previous if a['id'] not in repair_ids]
space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
def converted(t,q):return space.inverted()@Matrix.Translation(Vector(t))@Quaternion(q).normalized().to_matrix().to_4x4()@space
for i,asset in enumerate(r['assets']):
 if not asset['skeleton'] or (previous and asset['id'] not in repair_ids):continue
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 result={'id':asset['id'],'profile':asset['profile']}
 try:
  bpy.ops.import_mesh.gr2(filepath=str(root/asset['id']));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.import_mesh.gr2(filepath=str(root/asset['skeleton']));arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
  attachments=[];missing={};weighted=0;unbound=0
  for o in meshes:
   o.modifiers.new('Native skeleton','ARMATURE').object=arm
   attach=anchor_cloth(o,arm,(root/asset['id']).with_suffix('.clo'))
   if attach:attachments.append(attach)
   attach=anchor_world(o,arm)
   if attach:attachments.append(attach)
   groups={g.index:g.name for g in o.vertex_groups}
   for v in o.data.vertices:
    for w in v.groups:
     if w.weight<.00001:continue
     weighted+=w.weight
     if groups[w.group] not in arm.data.bones:missing[groups[w.group]]=missing.get(groups[w.group],0)+1;unbound+=w.weight
  motion=r['motions'][asset['profile']]
  if 'error' in motion:raise ValueError(motion['error'])
  poses=[]
  for frame in range(3):
   for track,name in enumerate(motion['names']):
    if name=='GOD' and name not in arm.pose.bones:name='Bip01'
    if name not in arm.pose.bones:continue
    b=arm.pose.bones[name];bind=motion['sourceBind'][track];b.matrix_basis=converted(bind['translation'],bind['rotation']).inverted()@converted(motion['motion'][track]['translations'][frame],motion['motion'][track]['rotations'][frame])
   bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();points=[o.matrix_world@v.co for o in meshes for v in o.evaluated_get(dep).data.vertices];assert all(math.isfinite(c) for p in points for c in p)
   if frame==0:before=points
   poses.append(max(((a-b).length for a,b in zip(before,points)),default=0))
  result.update(ok=True,vertices=sum(len(o.data.vertices) for o in meshes),bones=len(arm.data.bones),unboundWeightFraction=unbound/max(weighted,1),missingGroups=missing,secondaryAttachments=attachments,motion=max(poses),clip=motion['clip'])
 except Exception as e:result.update(ok=False,error=str(e))
 results.append(result)
 if len(results)%20==0:Path('reports/all-actor-skinning-validation.json').write_text(json.dumps({'complete':False,'results':results},indent=2))
 bpy.ops.outliner.orphans_purge(do_recursive=True)
valid_ids={a['id'] for a in r['assets'] if a['skeleton']}
results=[a for a in results if a['id'] in valid_ids]
Path('reports/all-actor-skinning-validation.json').write_text(json.dumps({'complete':True,'results':results},indent=2));print('ALL_ACTOR_SKINNING_COMPLETE',len(results))

