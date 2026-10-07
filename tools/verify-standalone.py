"""Round-trip release fixtures using the bundled Blender, without the GR2 add-on."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
report=Path(sys.argv[sys.argv.index('--')+1]);results=[]
for record in json.loads(report.read_text(encoding='utf-8'))['results']:
    source=record['exported'];bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=record['destination'],use_image_search=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
    assert len(arms)==1 and len(arms[0].data.bones)==source['boneCount']
    expected=json.loads((Path(source['file']).parent/'expected-pose.json').read_text())
    dep=bpy.context.evaluated_depsgraph_get();errors=[]
    for obj in meshes:
        assert any(m.type=='ARMATURE' and m.object==arms[0] for m in obj.modifiers)
        tree=KDTree(len(expected[obj.name]))
        for i,v in enumerate(expected[obj.name]):tree.insert(Vector(v),i)
        tree.balance();errors.append(max(tree.find(obj.matrix_world@v.co)[2] for v in obj.evaluated_get(dep).data.vertices))
    assert max(errors)<.00001
    materials={m for o in meshes for m in o.data.materials}
    for mat in materials:
        if mat.name.startswith('Saber '):continue
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        assert bsdf.inputs['Base Color'].is_linked
        image=bsdf.inputs['Base Color'].links[0].from_node.image
        assert image.packed_file and image.packed_file.size>100
    def points():
        dep=bpy.context.evaluated_depsgraph_get()
        return [o.matrix_world@v.co for o in meshes for v in o.evaluated_get(dep).data.vertices]
    before=points();root=next(b for b in arms[0].pose.bones if not b.parent)
    root.location.x+=.1;bpy.context.view_layer.update()
    delta=max((a-b).length for a,b in zip(before,points()));assert delta>.00001
    results.append(dict(id=record['id'],bones=len(arms[0].data.bones),materials=len(materials),maxPoseError=max(errors),manualPoseMotion=delta))
report.with_name('standalone-roundtrip.json').write_text(json.dumps(dict(ok=True,results=results),indent=2))
print('STANDALONE_FBX_PASS',len(results))
