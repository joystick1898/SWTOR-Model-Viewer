"""Resolve native asset materials and validated animation profiles for browsing."""
import bpy,addon_utils,sys,json,xml.etree.ElementTree as ET
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
sys.path.insert(0,str(Path(__file__).parent))
from materials import MaterialPipeline
from equipment import attach_equipment
from export_pose import export_pose
from secondary import anchor_cloth,anchor_world
from asset_materials import resolve_material
from resource_source import source as resource_source
sys.dont_write_bytecode=True
r=json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
sys.path.insert(0,r['addons']);addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
resources=Path(r['resources']).resolve()
def source(relative):
    return resource_source(resources,relative)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_mesh.gr2(filepath=r['source'])
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not meshes:raise ValueError('This resource contains no previewable mesh')
pipeline=MaterialPipeline(resources,Path(r['output']).parents[2]/'material-cache')
warnings=[];textured=0;arm=None;secondary=[]
for o in meshes:
    if not len(o.data.materials):o.data.materials.append(bpy.data.materials.new('Geometry preview'))
    for i,original in enumerate(o.data.materials):
        try:
            info,relative=resolve_material(resources,original.name,r['metadata'],r['material'],r['source'])
            o.data.materials[i]=pipeline.make(original.name,info);textured+=1
        except (OSError,ValueError,KeyError,StopIteration) as e:
            mat=bpy.data.materials.new('Geometry preview');mat.use_nodes=True
            mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.36,.44,.5,1);o.data.materials[i]=mat
            warnings.append(str(e))
if r['metadata']['skeleton']:
    bpy.ops.import_mesh.gr2(filepath=str(source(r['metadata']['skeleton'])))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for o in meshes:o.modifiers.new('Native skeleton','ARMATURE').object=arm
    for o in meshes:
        attachment=anchor_cloth(o,arm,Path(r['source']).with_suffix('.clo'))
        if attachment:secondary.append(attachment)
        attachment=anchor_world(o,arm)
        if attachment:secondary.append(attachment)
equipment_meshes,equipment_parts=attach_equipment(r.get('equipment',[]),arm,source,pipeline,resources)
meshes.extend(equipment_meshes)
motion=r['motion'];unmapped=[];animated=0
if motion:
    space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
    def converted(t,q):return space.inverted()@Matrix.Translation(Vector(t))@Quaternion(q).normalized().to_matrix().to_4x4()@space
    arm.animation_data_create();arm.animation_data.action=bpy.data.actions.new('Native resource animation')
    for i,name in enumerate(motion['names']):
        if name not in arm.pose.bones and name=='GOD':name='Bip01'
        if name not in arm.pose.bones:unmapped.append(name);continue
        animated+=1
        bone=arm.pose.bones[name];bone.rotation_mode='QUATERNION';bind=motion['sourceBind'][i];inverse=converted(bind['translation'],bind['rotation']).inverted()
        for frame in range(motion['frames']):
            bone.matrix_basis=inverse@converted(motion['motion'][i]['translations'][frame],motion['motion'][i]['rotations'][frame])
            bone.keyframe_insert('location',frame=frame+1);bone.keyframe_insert('rotation_quaternion',frame=frame+1)
    for curve in arm.animation_data.action.fcurves:
        for key in curve.keyframe_points:key.interpolation='LINEAR'
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=motion['frames'];scene.render.fps=round(motion['fps']);scene.frame_set(1)
    if not animated:raise ValueError('Animation has no matching target bones')
rigged=bool(arm) and r.get('exportRig',True)
if r.get('mode','preview')=='fbx':export_pose(meshes,arm,motion,r.get('time',0),rigged,r['output'],pipeline.materials.values())
else:bpy.ops.export_scene.gltf(filepath=r['output'],export_format='GLB',export_animations=bool(motion),export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True)
report={'file':r['output'],'rigged':rigged,'parts':[{'name':o.name} for o in meshes],'profile':r['metadata']['profile'],'sourceAnimationProfile':motion['sourceProfile'] if motion else None,'clip':r.get('clip'),'materialDetails':pipeline.records,'textureFiles':sorted({p for m in pipeline.records for p in m['textures'].values()}),'animatedBones':animated,'unusedSourceBones':unmapped,'texturedMaterials':textured,'warnings':warnings,'duration':motion['duration'] if motion else 0,'boneCount':len(arm.data.bones) if rigged else 0,'frames':motion['frames'] if motion else 0}
report['secondaryAttachments']=secondary
report['equipment']= [{k:e[k] for k in ['item','bone','position','rotation','scale','blade'] if k in e} for e in r.get('equipment',[])]
report['equipmentComponents']={e['item']:e.get('modelTemplates',[]) for e in r.get('equipment',[])}
report['equipmentLabels']={e['item']:e['name'] for e in r.get('equipment',[])}
report['equipmentWarnings']=[w for e in r.get('equipment',[]) for w in e.get('warnings',[])]
report['bones']=[b.name for b in arm.data.bones] if arm else []
report['parts']=[p for p in report['parts'] if p['name'] not in {e['name'] for e in equipment_parts}]+equipment_parts
Path(r['output']).with_name('result.json').write_text(json.dumps(report,indent=2))
