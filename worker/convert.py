import os
"""Isolated conversion worker. Source assets and Blender preferences remain read-only."""
import sys,json,math,xml.etree.ElementTree as ET
from pathlib import Path
import bpy,addon_utils
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path(__file__).parent))
from materials import MaterialPipeline
from equipment import attach_equipment
from secondary import anchor_hair,anchor_cloth,anchor_world
from resource_source import source as resource_source
request=json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text(encoding='utf-8'))
sys.dont_write_bytecode=True
sys.path.insert(0,request['addons']);addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
preferences=bpy.context.preferences.addons['io_scene_gr2'].preferences
preferences.gr2_scale_object=False;preferences.gr2_apply_axis_conversion=False
resources=Path(request['resources']).resolve();fixture=Path(request['fixture']);output=Path(request['output']);motion=request['motion'];state=request['state']
def source(relative):
    return str(resource_source(resources,relative))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
assembly=request['assembly']
bpy.ops.import_mesh.gr2(filepath=source(assembly['profile']['skeleton']))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[];parts=[];secondary=[]
pipeline=MaterialPipeline(resources,output.parent.parent/'material-cache')
definition=assembly['slots']
skins={m['slotName']:m for s in definition if s['slotName']=='skinMats' for m in s['materialInfo']['mats']}
replaced={e['slot'] for e in assembly.get('equipment',[]) if e['bone']=='@skin' and e.get('replaceSlot',True)}
for slot in definition:
    if slot['slotName'] in replaced:continue
    for relative in slot.get('models',[]):
        before=set(bpy.data.objects);bpy.ops.import_mesh.gr2(filepath=source(relative))
        for obj in set(bpy.data.objects)-before:
            if obj.type!='MESH':continue
            obj.modifiers.new('Native skeleton','ARMATURE').object=arm
            attachment=anchor_cloth(obj,arm,Path(source(relative)).with_suffix('.clo'))
            if attachment:secondary.append(attachment)
            attachment=anchor_world(obj,arm)
            if attachment:secondary.append(attachment)
            info=slot['materialInfo']
            for i in range(max(1,len(obj.data.materials))):
                selected=info
                if str(i) in info.get('materialOverrides',{}):selected=info['materialOverrides'][str(i)]
                elif i==1 and info.get('eyeMatInfo'):selected=info['eyeMatInfo']
                elif int(info.get('otherValues',{}).get('materialSkinIndex',-1))==i:selected=skins.get(slot['slotName'],info)
                material=pipeline.make(slot['slotName']+('_eye' if slot['slotName']=='head' and i==1 else ''),selected)
                if i<len(obj.data.materials):obj.data.materials[i]=material
                else:obj.data.materials.append(material)
            parts.append({'name':obj.name,'slot':slot['slotName'],'source':relative});meshes.append(obj)
if state.get('weapon','none')!='none':
    before=set(bpy.data.objects)
    bpy.ops.import_mesh.gr2(filepath=source('art/dynamic/weapon/blaster/blaster_high02_a03.gr2'))
    for obj in set(bpy.data.objects)-before:
        if obj.type!='MESH':continue
        for i,material in enumerate(obj.data.materials):
            metadata=ET.parse(source('art/shaders/materials/'+material.name+'.mat')).getroot()
            texture_props={'DiffuseMap':'diffuseMap','RotationMap1':'rotationMap','GlossMap':'glossMap','PaletteMaskMap':'paletteMaskMap'}
            info={'ddsPaths':{},'otherValues':{'derived':metadata.findtext('Derived')}}
            for entry in metadata.findall('input'):
                semantic=entry.findtext('semantic');value=entry.findtext('value')
                if semantic in texture_props:info['ddsPaths'][texture_props[semantic]]=value.replace('\\','/')+'.dds'
            obj.data.materials[i]=pipeline.make('mainhand',info)
        # Reference pistol grip: mesh +Z barrel maps to socket +Y, mesh -Y grip to +Z.
        # A fixed -90-degree X correction preserves handedness and stays attached
        # through animation. Other weapon families need their own grip profiles.
        grip=Matrix.Rotation(-math.pi/2,4,'X')
        obj.data.transform(arm.data.bones['RightWeapon'].matrix_local@grip)
        obj.matrix_world=arm.matrix_world.copy();obj.vertex_groups.clear()
        group=obj.vertex_groups.new(name='RightWeapon');group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
        obj.modifiers.new('Weapon socket','ARMATURE').object=arm
        meshes.append(obj);parts.append({'name':obj.name,'slot':'mainhand','bone':'RightWeapon'})
equipment_meshes,equipment_parts=attach_equipment(assembly.get('equipment',[]),arm,source,pipeline,resources,skins)
meshes.extend(equipment_meshes);parts.extend(equipment_parts)
space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
def converted(t,q):return space.inverted()@Matrix.Translation(Vector(t))@Quaternion(q).normalized().to_matrix().to_4x4()@space
arm.animation_data_create();arm.animation_data.action=bpy.data.actions.new('Native animation')
unused_source_bones=[]
for i,name in enumerate(motion['names']):
    if name not in arm.pose.bones and name=='GOD':name='Bip01'
    if name not in arm.pose.bones:
        unused_source_bones.append(name);continue
    bone=arm.pose.bones[name];bone.rotation_mode='QUATERNION';bind=motion['sourceBind'][i];inverse=converted(bind['translation'],bind['rotation']).inverted()
    for frame in range(motion['frames']):
        bone.matrix_basis=inverse@converted(motion['motion'][i]['translations'][frame],motion['motion'][i]['rotations'][frame])
        bone.keyframe_insert('location',frame=frame+1);bone.keyframe_insert('rotation_quaternion',frame=frame+1)
# Native ad_face pose tracks are additive deltas, not absolute bind transforms.
expression=request.get('expression')
if state.get('expression')=='neutral':
    # Explicit neutral overrides facial tracks while preserving the body clip.
    for bone in arm.pose.bones:
        if not bone.name.startswith('fc_'):continue
        bone.rotation_mode='QUATERNION'
        for frame in range(motion['frames']):
            bone.location=(0,0,0);bone.rotation_quaternion=(1,0,0,0);bone.scale=(1,1,1)
            bone.keyframe_insert('location',frame=frame+1)
            bone.keyframe_insert('rotation_quaternion',frame=frame+1)
            bone.keyframe_insert('scale',frame=frame+1)
elif expression:
    base_poses={}
    for frame in range(motion['frames']):
        bpy.context.scene.frame_set(frame+1)
        base_poses[frame]={t['name']:arm.pose.bones[t['name']].matrix_basis.copy() for t in expression['tracks'] if t['name'] in arm.pose.bones}
    applied=0
    for track in expression['tracks']:
        bone=arm.pose.bones.get(track['name'])
        if bone is None:continue
        applied+=1;bone.rotation_mode='QUATERNION'
        delta=converted(track['translation'],track['rotation'])
        for frame in range(motion['frames']):
            bpy.context.scene.frame_set(frame+1)
            bone.matrix_basis=base_poses[frame][track['name']]
            bone.location=bone.location+delta.to_translation()
            bone.rotation_quaternion=bone.rotation_quaternion@delta.to_quaternion()
            bone.keyframe_insert('location',frame=frame+1)
            bone.keyframe_insert('rotation_quaternion',frame=frame+1)
    if not applied:raise ValueError('This skeleton has no compatible facial expression bones')
if len(unused_source_bones)==len(motion['names']):raise ValueError('Animation has no bones in the target skeleton')
root=bpy.data.objects.new('Character origin',None);bpy.context.scene.collection.objects.link(root)
axis=arm.matrix_world.copy()
for obj in [arm]+meshes:
    matrix=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=matrix
if state['rootMotion']:
    root.rotation_mode='QUATERNION';world=motion['world'];initial=converted(world['translations'][0],world['rotations'][0]).inverted()
    for frame in range(motion['frames']):
        root.matrix_world=axis@converted(world['translations'][frame],world['rotations'][frame])@initial@axis.inverted()
        root.keyframe_insert('location',frame=frame+1);root.keyframe_insert('rotation_quaternion',frame=frame+1)
for action in bpy.data.actions:
    for curve in action.fcurves:
        for key in curve.keyframe_points:key.interpolation='LINEAR'
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=motion['frames'];scene.render.fps=round(motion['fps']);scene.frame_set(1)
if request['mode']=='preview':
    result=output/'preview.glb'
    bpy.ops.export_scene.gltf(filepath=str(result),export_format='GLB',export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_extras=True)
else:
    # FBX's material wrapper reads direct texture alpha; the GLB exporter above
    # recognizes the explicit cutout node. The manifest records the cutoff.
    for mat in pipeline.materials.values():
        bsdf=mat.node_tree.nodes.get('Principled BSDF')
        base=bsdf.inputs['Base Color'].links[0].from_node
        mat.node_tree.links.new(base.outputs['Alpha'],bsdf.inputs['Alpha'])
    frame=1+state['time']*motion['fps'];scene.frame_set(int(frame),subframe=frame-int(frame));bpy.context.view_layer.update()
    dep=bpy.context.evaluated_depsgraph_get();copies=[]
    expected={}
    for obj in meshes:
        if obj.name in state['hidden']:continue
        evaluated=obj.evaluated_get(dep);data=bpy.data.meshes.new_from_object(evaluated,depsgraph=dep)
        posed=bpy.data.objects.new(obj.name+'_posed',data);scene.collection.objects.link(posed);posed.matrix_world=obj.matrix_world.copy();copies.append(posed)
        expected[posed.name]=[list(posed.matrix_world@v.co) for v in data.vertices]
        if state['exportRig']:
            for group in obj.vertex_groups:posed.vertex_groups.new(name=group.name)
            posed.modifiers.new('Editable skeleton','ARMATURE').object=arm
    if not copies:raise ValueError('At least one visible part is required for export')
    if state['exportRig']:
        # The selected pose becomes the new bind pose. Preserve skin weights so
        # manual bone edits work without an Animator resetting the chosen pose.
        arm.animation_data_clear();root.animation_data_clear()
        bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
        bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
        for obj in copies:
            world=obj.matrix_world.copy();obj.parent=arm;obj.matrix_world=world
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies:obj.select_set(True)
    if state['exportRig']:arm.select_set(True);root.select_set(True)
    result=output/'posed-character.fbx'
    bpy.ops.export_scene.fbx(filepath=str(result),use_selection=True,object_types={'MESH','ARMATURE','EMPTY'} if state['exportRig'] else {'MESH'},use_armature_deform_only=False,bake_anim=False,add_leaf_bones=False,path_mode='COPY',embed_textures=True)
    (output/'expected-pose.json').write_text(json.dumps(expected))
report={'file':str(result),'clip':state['clip'],'duration':motion['duration'],'fps':motion['fps'],'frames':motion['frames'],'parts':parts,'materials':'baked-portable','materialDetails':pipeline.records,'textureFiles':sorted({p for m in pipeline.records for p in m['textures'].values()}),'profile':'bmnnew-102','rootMotion':state['rootMotion'],'mode':request['mode']}
report['rigged']=state['exportRig'] if request['mode']=='fbx' else True
report['boneCount']=len(arm.data.bones) if report['rigged'] else 0
report['profile']=assembly['profile']['rig']+'-'+str(len(motion['names']));report['appearance']=assembly['appearance']
report['sourceAnimationProfile']=motion['sourceProfile']
report['secondaryAttachments']=secondary
report['unusedSourceBones']=unused_source_bones
report['equipment']=state.get('equipment',[])
report['equipmentComponents']={e['item']:e.get('modelTemplates',[]) for e in assembly.get('equipment',[])}
report['equipmentLabels']={e['item']:e['name'] for e in assembly.get('equipment',[])}
report['equipmentWarnings']=[w for e in assembly.get('equipment',[]) for w in e.get('warnings',[])]
report['bones']=[b.name for b in arm.data.bones]
report['sockets']=[b.name for b in arm.data.bones if any(s in b.name.lower() for s in ['weapon','saber','rifle','holster','attach','mount'])]
(output/'result.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

