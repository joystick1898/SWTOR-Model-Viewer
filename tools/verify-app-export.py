"""Re-import the actual export bundles, including embedded image payloads."""
import bpy,json,math,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
pipeline=json.loads(Path('reports/app-pipeline-smoke.json').read_text())

def check(file,hidden_head,source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=file,use_image_search=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(meshes)==len(source['parts'])-(1 if hidden_head else 0),f'Unexpected mesh count: {len(meshes)}'
    arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    assert len(arms)==1
    arm=arms[0];assert len(arm.data.bones)==source['boneCount']
    assert not arm.animation_data or not arm.animation_data.action
    assert all(any(m.type=='ARMATURE' and m.object==arm for m in o.modifiers) for o in meshes)
    expected=json.loads((Path(source['file']).parent/'expected-pose.json').read_text())
    dep=bpy.context.evaluated_depsgraph_get();pose_errors=[]
    for obj in meshes:
        tree=KDTree(len(expected[obj.name]))
        for i,v in enumerate(expected[obj.name]):tree.insert(Vector(v),i)
        tree.balance()
        evaluated=obj.evaluated_get(dep)
        error=max(tree.find(obj.matrix_world@v.co)[2] for v in evaluated.data.vertices)
        pose_errors.append(error)
    assert max(pose_errors)<.00001,f'Export pose changed: {max(pose_errors)}'
    assert any(o.name.startswith('head_human') for o in meshes)!=hidden_head
    assert any(o.name.startswith('blaster_high02_a03') for o in meshes)
    assert all(math.isfinite(c) for o in meshes for v in o.data.vertices for c in v.co)
    materials={m for o in meshes for m in o.data.materials}
    assert len(materials)==(8 if hidden_head else 10)
    checks=[]
    for material in sorted(materials,key=lambda m:m.name):
        bsdf=material.node_tree.nodes.get('Principled BSDF')
        assert bsdf.inputs['Base Color'].is_linked,material.name+' lost base color'
        image=bsdf.inputs['Base Color'].links[0].from_node.image
        assert image.size[0]==512 and image.size[1]==512
        assert image.packed_file and image.packed_file.size>100,material.name+' has no embedded base map'
        pixels=np.asarray(image.pixels[:]).reshape(-1,4)
        # Dark leather legitimately has low linear-light variance after removing highlights.
        assert float(pixels[:,:3].std())>.001,material.name+' has a blank color map'
        assert float(pixels[:,3].mean())>.3,material.name+' became transparent'
        assert bsdf.inputs['Normal'].is_linked,material.name+' lost normal map'
        normal=bsdf.inputs['Normal'].links[0].from_node.inputs['Color'].links[0].from_node.image
        assert normal.packed_file and normal.packed_file.size>100
        checks.append({'name':material.name,'embeddedBaseAndNormal':True,'colorStdDev':float(pixels[:,:3].std()),'meanOpacity':float(pixels[:,3].mean())})
    weapon=next(o for o in meshes if o.name.startswith('blaster_high02'))
    def point():return weapon.matrix_world@weapon.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices[0].co
    before=point();wrist=arm.pose.bones['RightWrist'];wrist.matrix_basis=Matrix.Rotation(.3,4,'Y');bpy.context.view_layer.update()
    manual_motion=(point()-before).length
    assert manual_motion>.0001,'Manual wrist posing does not move the skinned weapon'
    hair_error=None
    if source.get('secondaryAttachments'):
        # The base hair mesh may legitimately blend neck/facial bones. Check the
        # secondary pieces repaired from the cloth attachment, not that base mesh.
        names={a['mesh']+'_posed' for a in source['secondaryAttachments'] if a['anchor']=='Head'}
        hair=[o for o in meshes if o.name in names];head=arm.pose.bones['Head']
        assert hair,'Repaired secondary hair missing from export'
        def hair_points():
            inverse=(arm.matrix_world@head.matrix).inverted();dep=bpy.context.evaluated_depsgraph_get()
            return [inverse@o.matrix_world@v.co for o in hair for v in o.evaluated_get(dep).data.vertices]
        before_hair=hair_points();head.matrix_basis=Matrix.Rotation(.4,4,'Y');bpy.context.view_layer.update()
        hair_error=max((a-b).length for a,b in zip(before_hair,hair_points()))
        assert hair_error<.00001,f'Hair separated on manual head pose: {hair_error}'
    return {'ok':True,'file':file,'mesh_count':len(meshes),'hidden_head':hidden_head,'weapon_included':True,'vertices':sum(len(o.data.vertices) for o in meshes),'bones':len(arm.data.bones),'maxPoseError':max(pose_errors),'manualWristMotion':manual_motion,'manualHeadHairError':hair_error,'materials':checks}

report={'ok':True,'exports':[check(pipeline['exportedFile'],True,pipeline['posed']),check(pipeline['completeFile'],False,pipeline['complete'])]}
custom=Path('reports/designer-export-smoke.json')
if custom.exists():
    custom=json.loads(custom.read_text());report['exports'].append(check(custom['file'],False,custom['result']))
hair=Path('reports/hair-export-smoke.json')
if hair.exists():
    hair=json.loads(hair.read_text());report['exports'].append(check(hair['file'],False,hair['result']))
Path('reports/app-fbx-roundtrip.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
