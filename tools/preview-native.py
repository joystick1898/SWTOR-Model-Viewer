"""Native-key diagnostic assembly; legacy names are reference labels, not production mapping."""
import sys, json, math
from pathlib import Path
import bpy, addon_utils
from mathutils import Matrix, Quaternion, Vector
sys.dont_write_bytecode = True
sys.path.insert(0, r'C:\Users\BRShe\AppData\Roaming\Blender Foundation\Blender\4.3\scripts\addons')
addon_utils.enable('io_scene_gr2', default_set=True, persistent=False)
from io_scene_gr2.ops import import_jba
p=bpy.context.preferences.addons['io_scene_gr2'].preferences
p.gr2_scale_object=False
p.gr2_apply_axis_conversion=False
root=Path(r'G:\Old Republic Assets\resources')
fixture=Path(r'G:\Old Republic Assets\SWTOR Extracts-Main\AttonRand')
output=Path('output/native-atton'); output.mkdir(parents=True,exist_ok=True)
native=json.loads(Path('output/atton-native-motion.json').read_text())
class Reporter:
    def report(self, level, message): print(level, message)
legacy=import_jba.read(Reporter(),str(fixture/'cb_pistol_normal_to_combat.jba'))
translation_error=0.0; rotation_error=0.0
for i,track in enumerate(native['motion']):
    for f in range(native['frames']):
        translation_error=max(translation_error,(Vector(track['translations'][f])-legacy.bones[i].translations[f]).length)
        q=Quaternion(track['rotations'][f]); ref=legacy.bones[i].rotations[f]
        rotation_error=max(rotation_error,min((q-ref).magnitude,(q+ref).magnitude))
if translation_error>0.001 or rotation_error>0.0001: raise RuntimeError('Native/reference decode discrepancy')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_mesh.gr2(filepath=str(root/'art/dynamic/spec/bmnnew_skeleton.gr2'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[]
for slot in json.loads((fixture/'assets/paths_corrected.json').read_text()):
    for relative in slot.get('models',[]):
        before=set(bpy.data.objects)
        bpy.ops.import_mesh.gr2(filepath=str(root/relative.lstrip('/')))
        for mesh in set(bpy.data.objects)-before:
            if mesh.type!='MESH': continue
            mod=mesh.modifiers.new('Native animation diagnostic','ARMATURE'); mod.object=arm
            meshes.append(mesh)
missing=sorted(set(native['names'])-set(arm.pose.bones.keys()))
if missing: raise RuntimeError(f'Missing bones: {missing}')
space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
inv=space.inverted()
arm.animation_data_create(); arm.animation_data.action=bpy.data.actions.new('Native JAWB diagnostic')
for i,name in enumerate(native['names']):
    bone=arm.pose.bones[name]; bone.rotation_mode='QUATERNION'
    rest=bone.bone.matrix_local.copy()
    if bone.parent: rest=bone.parent.bone.matrix_local.inverted()@rest
    for frame in range(native['frames']):
        track=native['motion'][i]
        local=inv@Matrix.Translation(Vector(track['translations'][frame]))@Quaternion(track['rotations'][frame]).to_matrix().to_4x4()@space
        bone.matrix_basis=rest.inverted()@local
        bone.keyframe_insert('location',frame=frame+1)
        bone.keyframe_insert('rotation_quaternion',frame=frame+1)
for curve in arm.animation_data.action.fcurves:
    for key in curve.keyframe_points: key.interpolation='LINEAR'
scene=bpy.context.scene; scene.frame_start=1; scene.frame_end=native['frames']; scene.render.fps=round(native['fps'])
def bounds():
    dep=bpy.context.evaluated_depsgraph_get()
    vertices=[obj.matrix_world@v.co for m in meshes for obj in [m.evaluated_get(dep)] for v in obj.data.vertices]
    return {'min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]}
samples=[]
for frame in [1,5,9]:
    scene.frame_set(frame); bpy.context.view_layer.update(); samples.append({'frame':frame,**bounds()})
scene.frame_set(1)
lo=Vector(samples[0]['min']); hi=Vector(samples[0]['max']); center=(lo+hi)/2; height=max(hi-lo)
camera_data=bpy.data.cameras.new('Diagnostic Camera'); camera=bpy.data.objects.new('Diagnostic Camera',camera_data); scene.collection.objects.link(camera)
camera.location=center+Vector((height*1.2,-height*2,height*.35)); camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler(); camera_data.type='ORTHO'; camera_data.ortho_scale=height*1.4; camera_data.clip_start=.001; scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='SINGLE'; scene.display.shading.single_color=(.6,.65,.7); scene.display.shading.show_shadows=True
scene.render.resolution_x=700; scene.render.resolution_y=700; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
bpy.ops.wm.save_as_mainfile(filepath=str((output/'native-atton-diagnostic.blend').resolve()))
for frame in [1,5,9]:
    scene.frame_set(frame); scene.render.filepath=str((output/f'frame-{frame}.png').resolve()); bpy.ops.render.render(write_still=True)
report={'scope':'Native bone keys, legacy reference name mapping; untextured diagnostic, no world track or weapon attachment', 'mesh_objects':len(meshes),'tracks':len(native['names']),'frames':native['frames'],'max_translation_error_vs_legacy':translation_error,'max_quaternion_error_vs_legacy':rotation_error,'bounds':samples}
Path('reports/native-atton-preview.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report))
