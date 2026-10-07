"""Blender integration: native texture recipes, UV frames, static FBX and GLB."""
import sys,json
from pathlib import Path
import bpy,addon_utils
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'worker'))
from materials import MaterialPipeline
from sabers import blades
from export_pose import export_pose
from saber_effects import PRESETS,preset
from saber_ribbons import material
config=json.loads((ROOT/'development.local.json').read_text())
sys.path.insert(0,config['addons']);addon_utils.enable('io_scene_gr2',default_set=True,persistent=False)
p=bpy.context.preferences.addons['io_scene_gr2'].preferences;p.gr2_scale_object=False;p.gr2_apply_axis_conversion=False
folder=ROOT/'output/persistent-sabers';folder.mkdir(parents=True,exist_ok=True)
resources=Path(config['resources']);pipeline=MaterialPipeline(resources,ROOT/'output/material-cache')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=resources/'art/dynamic/weapon/model/saber_unstable_vented_a01_v01.gr2'
bpy.ops.import_mesh.gr2(filepath=str(source));hilt=next(o for o in bpy.context.scene.objects if o.type=='MESH')
records=[];all_objects=[]
for i,family in enumerate([*PRESETS,'native']):
 settings=dict(enabled=True,effect=family,motion='animated',frame=3,core='#ffffff',glow='#a04cff',length=90,width=2,intensity=1.5)
 # Explicit single blade isolates the artwork families; Native also tests vents.
 if family!='native':
  settings['layout']=dict(single=True,dual=False,straight=False,diagonal=False)
  settings['elements']={'single':dict(settings,position=[0,0,0],rotation=[0,0,0])}
 entry=dict(layer=i,category='saber',blade=settings)
 start=len(pipeline.records);objects=blades(entry,str(source),source,pipeline,hilt)
 assert objects,(family,'missing geometry')
 assert all(len(o.data.uv_layers)>0 for o in objects)
 for obj in objects:
  obj.data.transform(Matrix.Translation((i*.03,0,0)))
  assert len(obj.data.polygons)>100 if obj.name.endswith('solid_core') else len(obj.data.polygons) in (6,30)
 all_objects.extend(objects)
 records.append(dict(family=family,meshes=len(objects),warnings=entry.get('warnings',[]),materials=[m['name'] for m in pipeline.records[start:]]))
# Verify all manual elements retain separate placement, color and effect artwork.
settings=dict(enabled=True,effect='native',motion='static',frame=31,core='#ffffff',glow='#a04cff',length=90,width=2,intensity=1.5,
 layout=dict(single=True,dual=True,straight=True,diagonal=True))
settings['elements']={name:dict(position=[0,0,0],rotation=[0,0,0],length=90 if name in ('single','dual') else 13.5,width=2,core='#ffffff',glow='#a04cff',intensity=1.5) for name in ('single','dual','straightLeft','straightRight','diagonalLeft','diagonalRight')}
settings['elements']['diagonalLeft']['position']=[2,3,-1]
entry=dict(layer=20,category='saber',blade=settings)
objects=blades(entry,str(source),source,pipeline,hilt)
assert {o['saberElement'] for o in objects}==set(settings['elements'])
guard_materials=[o.data.materials[0] for o in objects if o['saberElement']=='straightLeft']
assert any('unstable_dynamic_saber_vent' in json.loads(m['saberFX'])['texture'] for m in guard_materials)
assert all(not json.loads(o.data.materials[0]['saberFX'])['animated'] for o in objects)
for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
entry['blade']['enabled']=False;assert blades(entry,str(source),source,pipeline,hilt)==[]
entry['blade']={k:v for k,v in settings.items() if k not in ('layout','elements')};entry['blade'].update(enabled=True,effect='standard')
objects=blades(entry,str(source),source,pipeline,hilt)
assert {o['saberElement'] for o in objects}>={'fx_saber','dummy_vent_blade_01_loc','dummy_vent_blade_02_loc'}
for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
# Tau's color-independent white tip must also be present in the static PNG,
# rather than existing only in the viewer shader.
for color,dominant in [('#ff0000',0),('#00ff00',1),('#0000ff',2)]:
 settings=dict(effect='tau',motion='static',frame=0)
 element=dict(core='#ffffff',glow=color,intensity=1.5)
 layer={**preset(resources,'tau')[0],'base':True}
 mat=material(pipeline,layer,element,settings)
 image=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE')
 w,h=image.size
 def sample(y):
  offset=(int(y*(h-1))*w+w//2)*4
  return image.pixels[offset:offset+4]
 bottom,tip=sample(.1),sample(.98)
 assert bottom[dominant]>.9 and all(bottom[i]<.01 for i in range(3) if i!=dominant),(color,bottom)
 assert min(tip[:3])>.9 and max(tip[:3])-min(tip[:3])<.001,(color,tip)
# Do not export unused materials from the manual-control/color checks.
used={o.data.materials[0].name for o in all_objects};pipeline.records=[m for m in pipeline.records if m['name'] in used]
bpy.data.objects.remove(hilt,do_unlink=True)
bpy.ops.export_scene.gltf(filepath=str(folder/'persistent.glb'),export_format='GLB',export_extras=True)
export_pose(all_objects,None,None,0,False,str(folder/'persistent.fbx'),pipeline.materials.values())
report=dict(ok=True,file=str(folder/'persistent.fbx'),materialDetails=pipeline.records,textureFiles=sorted({p for m in pipeline.records for p in m['textures'].values()}),families=records,rigged=False,parts=[o.name for o in all_objects])
(folder/'result.json').write_text(json.dumps(report,indent=2))
print('PERSISTENT_SABERS_PASS',[(r['family'],r['meshes']) for r in records])
