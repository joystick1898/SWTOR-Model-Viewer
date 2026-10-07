import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
results=[]
all_profiles='--all-profiles' in sys.argv
local='--legacy' not in sys.argv
equipment='--equipment' in sys.argv
gizmo='--gizmo' in sys.argv
designer='--designer' in sys.argv
underwear='--underwear' in sys.argv
saber='--saber' in sys.argv
alignment='--blade-alignment' in sys.argv
pike='--pike-ux' in sys.argv
report_file='reports/pike-ux-smoke.json' if pike else 'reports/blade-alignment-smoke.json' if alignment else 'reports/saber-pipeline-smoke.json' if saber else 'reports/underwear-pipeline-smoke.json' if underwear else 'reports/designer-pipeline-smoke.json' if designer else 'reports/equipment-gizmo-pipeline.json' if gizmo else 'reports/equipment-pipeline-smoke.json' if equipment else 'reports/local-npc-pipeline-smoke.json' if local else 'reports/npc-pipeline-smoke.json'
for record in json.loads(Path(report_file).read_text(encoding='utf-8'))['results']:
 assert record.get('ok'),record
 source=record['exported'];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=record['destination'],use_image_search=False)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];assert len(arms)==1
 arm=arms[0];assert len(arm.data.bones)==source['boneCount'];assert not arm.animation_data or not arm.animation_data.action
 expected=json.loads((Path(source['file']).parent/'expected-pose.json').read_text());errors=[];dep=bpy.context.evaluated_depsgraph_get()
 for o in meshes:
  assert any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers)
  tree=KDTree(len(expected[o.name]));[tree.insert(Vector(v),i) for i,v in enumerate(expected[o.name])];tree.balance()
  errors.append(max(tree.find(o.matrix_world@v.co)[2] for v in o.evaluated_get(dep).data.vertices))
 coordinate_scale=max(1,max(abs(c) for points in expected.values() for p in points for c in p))
 # FBX/Blender use float32 transforms; distant large bosses need a relative
 # tolerance as well as the small-character absolute tolerance.
 tolerance=max(.00001,coordinate_scale*.000001)
 assert max(errors)<tolerance,(record['id'],errors,tolerance)
 materials={m for o in meshes for m in o.data.materials}
 for m in materials:
  bsdf=m.node_tree.nodes.get('Principled BSDF');assert bsdf.inputs['Base Color'].is_linked
  image=bsdf.inputs['Base Color'].links[0].from_node.image;assert image.packed_file and image.packed_file.size>100
  assert bsdf.inputs['Normal'].is_linked
  normal=bsdf.inputs['Normal'].links[0].from_node.inputs['Color'].links[0].from_node.image;assert normal.packed_file
 # Move the common rig ancestor: every weighted mesh must remain poseable.
 def points():
  dep=bpy.context.evaluated_depsgraph_get();return [o.matrix_world@v.co for o in meshes for v in o.evaluated_get(dep).data.vertices]
 before=points();root=next(b for b in arm.pose.bones if not b.parent);root.location.x+=.1;bpy.context.view_layer.update();delta=max((a-b).length for a,b in zip(before,points()));assert delta>.00001
 results.append({'npc':record['id'],'maxPoseError':max(errors),'bones':len(arm.data.bones),'embeddedMaterials':len(materials),'manualPoseMotion':delta})
Path('reports/pike-ux-fbx-roundtrip.json' if pike else 'reports/blade-alignment-fbx-roundtrip.json' if alignment else 'reports/saber-fbx-roundtrip.json' if saber else 'reports/underwear-fbx-roundtrip.json' if underwear else 'reports/designer-fbx-roundtrip.json' if designer else 'reports/equipment-gizmo-fbx-roundtrip.json' if gizmo else 'reports/equipment-fbx-roundtrip.json' if equipment else 'reports/local-npc-fbx-roundtrip.json' if local else 'reports/npc-fbx-roundtrip.json').write_text(json.dumps({'ok':True,'results':results},indent=2));print('BROWSER_FBX_PASS',len(results))
