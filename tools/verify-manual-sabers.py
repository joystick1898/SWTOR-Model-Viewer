"""Blender regression for unrestricted toggles and individual emitter transforms."""
import sys,json,copy,itertools,math
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'worker'))
import sabers
folder=root/'output/saber-layout-review';folder.mkdir(parents=True,exist_ok=True)
settings=json.loads((folder/'validated-blade.json').read_text())
bpy.ops.mesh.primitive_cube_add(size=1)
hilt=bpy.context.object
for v in hilt.data.vertices:v.co=Vector((v.co.x*.004,v.co.y*.025-.0125,v.co.z*.004))
frame=Matrix.Rotation(.4,4,'Z');points=[('fx_saber',frame,1)]
original=sabers.emitters;sabers.emitters=lambda *args:points
colors=[]
def material(pipeline,color,channel,effect,intensity=2):
    colors.append((color,channel));return bpy.data.materials.new(color+' '+channel)
sabers.material=material
class Pipeline:resources=root
entry={'category':'saber','layer':0}
counts=[]
for flags in itertools.product([False,True],repeat=4):
    b=copy.deepcopy(settings);b['layout']=dict(zip(['single','dual','straight','diagonal'],flags));b['enabled']=any(flags);entry['blade']=b
    objects=sabers.blades(entry,'fixture',Path('fixture'),Pipeline(),hilt)
    expected=2*(int(flags[0])+int(flags[1])+2*int(flags[2])+2*int(flags[3]))
    assert len(objects)==expected,(flags,len(objects))
    for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
    counts.append(expected)
b=copy.deepcopy(settings);b['layout']=dict.fromkeys(['single','dual','straight','diagonal'],True)
for element in b['elements'].values():element['position']=[0,0,0];element['rotation']=[0,0,0]
before={n:m for n,m,e in sabers.manual_emitters(hilt,points,b)}
assert len(before)==6
# Incomplete native crossguard metadata must never remove either manual side.
for native in [points,points+[('fx_saber_guard_a',frame, .15)],points+[('fx_saber_guard_b',frame,.15)]]:
    assert {n for n,m,e in sabers.manual_emitters(hilt,native,b)}==set(before)
for key,sign in [('straightLeft',-1),('straightRight',1)]:
    axis=frame.inverted().to_3x3()@before[key].to_3x3()@Vector((0,1,0));assert abs(axis.z+sign)<1e-6 and abs(axis.y)<1e-6
for key in ['diagonalLeft','diagonalRight']:
    axis=frame.inverted().to_3x3()@before[key].to_3x3()@Vector((0,1,0));assert abs(axis.y-math.sin(math.radians(30)))<1e-6
b['elements']['diagonalRight']['position']=[3,-2,1];b['elements']['diagonalRight']['rotation']=[0,0,30]
after={n:m for n,m,e in sabers.manual_emitters(hilt,points,b)}
b['elements']['diagonalRight']['rotation']=[0,0,0]
after_position={n:m for n,m,e in sabers.manual_emitters(hilt,points,b)}
delta=frame.inverted().to_3x3()@(after_position['diagonalRight'].translation-before['diagonalRight'].translation)
assert (delta-Vector((.003,-.002,.001))).length<1e-7
assert abs(after['diagonalRight'].to_quaternion().rotation_difference(before['diagonalRight'].to_quaternion()).angle-math.radians(30))<1e-5
for key in before:
    if key!='diagonalRight':assert before[key]==after[key]
entry['blade']=b;entry['blade']['enabled']=True;colors.clear()
objects=sabers.blades(entry,'fixture',Path('fixture'),Pipeline(),hilt)
for i,(key,matrix,element) in enumerate(sabers.manual_emitters(hilt,points,b)):
    core,glow=objects[i*2:i*2+2];inv=matrix.inverted();length=element['length']/1000
    assert abs(max((inv@v.co).y for v in core.data.vertices)-length)<1e-6
    assert max((inv@v.co).y for v in glow.data.vertices)>length
    assert colors[i*2]==(element['core'],'core') and colors[i*2+1]==(element['glow'],'glow')
(folder/'geometry-check.json').write_text(json.dumps({'ok':True,'combinations':16,'counts':counts,'independentTransforms':True,'independentColors':True},indent=2))
print('MANUAL_SABERS_PASS 16 combinations, six independent elements')
