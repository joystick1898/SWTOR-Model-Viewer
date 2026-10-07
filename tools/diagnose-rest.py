import bpy, struct, json
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
bpy.ops.wm.open_mainfile(filepath=str(Path('output/native-atton/native-atton-diagnostic.blend').resolve()),load_ui=False)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
b=Path(r'G:\Old Republic Assets\resources\anim\humanoid\bmnnew\anim_library.mph').read_bytes()
u=lambda p:struct.unpack_from('<I',b,p)[0]
f=lambda p:struct.unpack_from('<4f',b,p)
names=[]; p=1408
for _ in range(106):
    end=b.index(0,p);names.append(b[p:end].decode());p=end+1
space=Matrix(((1000,0,0,0),(0,0,-1000,0),(0,1000,0,0),(0,0,0,1)))
result=[]
for name in ['Root','Pelvis','RightHip','RightKnee','RightAnkle','Head','fc_eye_left','fc_jaw','fc_lip_center_top']:
    i=names.index(name);t=f(2872+i*16);q=f(4568+i*16)
    bone=arm.data.bones[name];rest=bone.matrix_local.copy()
    if bone.parent:rest=bone.parent.matrix_local.inverted()@rest
    source=space.inverted()@Matrix.Translation(Vector(t[:3]))@Quaternion((q[3],*q[:3])).to_matrix().to_4x4()@space
    result.append({'name':name,'native_t':t,'native_q_xyzw':q,'converted_t':list(source.translation),'gr2_t':list(rest.translation),'position_difference':(source.translation-rest.translation).length,'rotation_difference_degrees':source.to_quaternion().rotation_difference(rest.to_quaternion()).angle*57.29578})
Path('reports/rest-comparison.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

