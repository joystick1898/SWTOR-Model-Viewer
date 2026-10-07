"""Compare absolute legacy-style application with native-bind-relative retargeting."""
import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
bpy.ops.wm.open_mainfile(filepath=str(Path('output/native-atton/native-atton-diagnostic.blend').resolve()),load_ui=False)
out=Path('output/atton-retarget');out.mkdir(parents=True,exist_ok=True)
native=json.loads(Path('output/atton-native-motion.json').read_text())
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE'); scene=bpy.context.scene
baseline=arm.animation_data.action
corrected=bpy.data.actions.new('Native bind-relative motion')
arm.animation_data.action=corrected
space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
def converted(t,q):return space.inverted()@Matrix.Translation(Vector(t))@Quaternion(q).normalized().to_matrix().to_4x4()@space
identity_error=0.0
for i,name in enumerate(native['names']):
    bone=arm.pose.bones[name]; src=native['sourceBind'][i]; bind=converted(src['translation'],src['rotation'])
    neutral=bind.inverted()@bind
    identity_error=max(identity_error,max(abs(neutral[r][c]-(1 if r==c else 0)) for r in range(4) for c in range(4)))
    for f in range(native['frames']):
        bone.matrix_basis=bind.inverted()@converted(native['motion'][i]['translations'][f],native['motion'][i]['rotations'][f])
        bone.keyframe_insert('location',frame=f+1);bone.keyframe_insert('rotation_quaternion',frame=f+1)
for c in corrected.fcurves:
    for k in c.keyframe_points:k.interpolation='LINEAR'
# The decoded world track is applied relative to its first sample, in the importer's
# object coordinate system. This avoids shifting the model's user-chosen origin.
root=bpy.data.objects.new('Native root motion (relative to first sample)',None);scene.collection.objects.link(root)
for obj in [arm]+[o for o in scene.objects if o.type=='MESH']:
    matrix=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=matrix
axis=arm.matrix_world.copy();w=native['world'];initial=converted(w['translations'][0],w['rotations'][0])
root.rotation_mode='QUATERNION'
for f in range(native['frames']):
    delta=converted(w['translations'][f],w['rotations'][f])@initial.inverted()
    root.matrix_world=axis@delta@axis.inverted()
    root.keyframe_insert('location',frame=f+1);root.keyframe_insert('rotation_quaternion',frame=f+1)
for c in root.animation_data.action.fcurves:
    for k in c.keyframe_points:k.interpolation='LINEAR'
camera=scene.camera;camera.data.type='ORTHO';camera.data.ortho_scale=.25
scene.render.resolution_x=700;scene.render.resolution_y=900;scene.render.resolution_percentage=100
measurements=[]
for label,action in [('before',baseline),('after',corrected)]:
    arm.animation_data.action=action
    for frame in [1,9]:
        scene.frame_set(frame);bpy.context.view_layer.update()
        measurements.append({'variant':label,'frame':frame,'bone_heads':{name:list(arm.matrix_world@arm.pose.bones[name].head) for name in ['Pelvis','RightHip','RightKnee','RightAnkle','LeftHip','LeftKnee','LeftAnkle','fc_eye_left','fc_jaw']}})
        if label=='before' and frame==9:continue
        for view,direction in [('front',(0,1,0)),('side',(1,0,0)),('face',(0,1,0))]:
            center=Vector((0,0,.10))
            camera.data.ortho_scale=.25
            if view=='face':
                center=arm.matrix_world@arm.pose.bones['Head'].head+Vector((0,0,.012));camera.data.ortho_scale=.047
            camera.location=center+Vector(direction)*(.5 if label=='before' else -.5)
            camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str((out/f'{label}-{view}-{frame}.png').resolve());bpy.ops.render.render(write_still=True)
arm.animation_data.action=corrected;scene.frame_set(1)
camera.data.ortho_scale=.25;center=Vector((0,0,.1));camera.location=center+Vector((0,.5,0));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str((out/'atton-native-retarget.blend').resolve()))
report={'method':'inverse(native bind local) * native animated local as target bone basis','native_mapping':native['mappingSource'],'bind_identity_max_error':identity_error,'root_mode':'relative to first sample; needs moving-clip validation','measurements':measurements}
Path('reports/retarget-comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps({'bind_identity_max_error':identity_error,'output':str(out)}))
