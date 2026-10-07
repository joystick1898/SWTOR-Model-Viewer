import bpy,json
from pathlib import Path
r=json.loads(Path('reports/equipment-pipeline-smoke.json').read_text())['results'][0]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=r['destination'],use_image_search=False)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
parts={p['name']+'_posed':p for p in r['exported']['parts'] if p.get('equipmentItem')}
objects=[bpy.data.objects[n] for n in parts]
def points():
 dep=bpy.context.evaluated_depsgraph_get();return {o.name:[o.matrix_world@v.co for v in o.evaluated_get(dep).data.vertices] for o in objects}
results=[]
for o in objects:
 bone=parts[o.name]['bone'];before=points();arm.pose.bones[bone].location.x+=.01;bpy.context.view_layer.update();after=points()
 deltas={n:max((a-b).length for a,b in zip(before[n],after[n])) for n in before}
 assert deltas[o.name]>.001,deltas
 assert all(v<1e-7 for n,v in deltas.items() if n!=o.name),deltas
 arm.pose.bones[bone].location.x-=.01;bpy.context.view_layer.update();results.append({'bone':bone,'deltas':deltas})
Path('reports/equipment-independent-posing.json').write_text(json.dumps({'ok':True,'results':results},indent=2));print('INDEPENDENT_EQUIPMENT_PASS')
