"""Portable selected-pose FBX with optional editable source skeleton."""
import bpy,json
from pathlib import Path

def export_pose(meshes,arm,motion,time,rigged,output,materials):
    scene=bpy.context.scene
    frame=1+time*(motion['fps'] if motion else 1)
    scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
    for mat in materials:
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        if bsdf and bsdf.inputs['Base Color'].is_linked:
            node=bsdf.inputs['Base Color'].links[0].from_node
            if 'Alpha' in node.outputs:mat.node_tree.links.new(node.outputs['Alpha'],bsdf.inputs['Alpha'])
    dep=bpy.context.evaluated_depsgraph_get();copies=[];expected={}
    for obj in meshes:
        data=bpy.data.meshes.new_from_object(obj.evaluated_get(dep),depsgraph=dep)
        posed=bpy.data.objects.new(obj.name+'_posed',data);scene.collection.objects.link(posed);posed.matrix_world=obj.matrix_world.copy();copies.append(posed)
        expected[posed.name]=[list(posed.matrix_world@v.co) for v in data.vertices]
        if rigged:
            for group in obj.vertex_groups:posed.vertex_groups.new(name=group.name)
            posed.modifiers.new('Editable skeleton','ARMATURE').object=arm
    if rigged:
        arm.animation_data_clear();bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
        bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
        for obj in copies:
            matrix=obj.matrix_world.copy();obj.parent=arm;obj.matrix_world=matrix
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies:obj.select_set(True)
    if rigged:arm.select_set(True)
    bpy.ops.export_scene.fbx(filepath=str(output),use_selection=True,object_types={'MESH','ARMATURE'} if rigged else {'MESH'},use_armature_deform_only=False,bake_anim=False,add_leaf_bones=False,path_mode='COPY',embed_textures=True)
    Path(output).with_name('expected-pose.json').write_text(json.dumps(expected))
