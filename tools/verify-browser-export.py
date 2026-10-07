import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
results=[]
all_profiles='--all-profiles' in sys.argv
report_file='reports/all-profile-export-smoke.json' if all_profiles else 'reports/browser-coverage-smoke.json'
for record in json.loads(Path(report_file).read_text())['results']:
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
 assert max(errors)<tolerance,(record['profile'],errors,tolerance)
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
 results.append({'profile':record['profile'],'maxPoseError':max(errors),'bones':len(arm.data.bones),'embeddedMaterials':len(materials),'manualPoseMotion':delta})
Path('reports/all-profile-fbx-roundtrip.json' if all_profiles else 'reports/browser-fbx-roundtrip.json').write_text(json.dumps({'ok':True,'results':results},indent=2));print('BROWSER_FBX_PASS',len(results))
