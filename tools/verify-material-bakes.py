"""Run with Blender --background --python ... -- request.json output-directory."""
import sys,json,addon_utils,bpy
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
from materials import MaterialPipeline,save_texture
from asset_materials import resolve_material
request_path,output=sys.argv[sys.argv.index('--')+1:]
output=str(Path(output).resolve())
request=json.loads(Path(request_path).read_text());sys.path.insert(0,request['addons'])
addon_utils.enable('io_scene_gr2',default_set=False,persistent=False)
Path(output).mkdir(parents=True,exist_ok=True)
# Packed alpha must not brighten RGB, and rectangular images retain orientation.
probe=bpy.data.images.new('Packed probe',width=2,height=3,alpha=True,float_buffer=True)
expected=np.array([[.1,.2,.3,a] for a in [0,.1,.2,.5,.8,1]],dtype=np.float32)
probe.pixels.foreach_set(expected.ravel());save_texture(probe,Path(output)/'packed-probe.png')
check=bpy.data.images.load(str(Path(output)/'packed-probe.png'),check_existing=False);check.alpha_mode='CHANNEL_PACKED'
assert tuple(check.size)==(2,3)
encoded=expected.copy();encoded[:,:3]=1.055*np.power(encoded[:,:3],1/2.4)-.055
# Blender's byte-image pixels expose encoded values, unlike float bake buffers.
assert np.max(np.abs(np.array(check.pixels[:]).reshape(-1,4)-encoded))<.005
bpy.data.images.remove(probe);bpy.data.images.remove(check)
pipeline=MaterialPipeline(request['resources'],Path(output)/'cache')
overlay,_=resolve_material(request['resources'],'weapon_saber_mtx06_a01_v01_suv',{'materials':[]},None,'saber_mtx06_a01_v01.gr2')
assert overlay['otherValues']['derived']=='EmissiveOnly' and overlay['portableAlphaMode']=='additive'
pipeline.make('Defiant emitter overlay',overlay)
slots=request['assembly']['slots']
garment=next(s['materialInfo'] for s in slots if s.get('materialInfo',{}).get('otherValues',{}).get('derived')=='Garment')
results=[]
for family in ['Garment','Creature','Uber','EmissiveOnly']:
    info={**garment,'otherValues':{**garment['otherValues'],'derived':family}}
    if family in ['Creature','Uber','EmissiveOnly']:
        info['ddsPaths']={k:v for k,v in info['ddsPaths'].items() if k in ['diffuseMap','rotationMap','glossMap']}
    mat=pipeline.make(family,info);record=pipeline.records[-1]
    assert set(record['textures'])=={'base','normal','emission'}
    assert record['specular']==0
    assert not mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].is_linked
    for channel,file in record['textures'].items():
        image=bpy.data.images.load(file,check_existing=False)
        image.alpha_mode='CHANNEL_PACKED'
        if channel in ['normal','roughness']:image.colorspace_settings.name='Non-Color'
        assert tuple(image.size)==tuple(record['textureDimensions'][channel]),(family,channel,image.size)
        pixels=np.array(image.pixels[:]).reshape(-1,4)
        assert np.isfinite(pixels).all()
        bpy.data.images.remove(image)
    assert pipeline.make(family,info)==mat
    results.append(record)
Path(output).mkdir(parents=True,exist_ok=True)
Path(output,'verified.json').write_text(json.dumps(results,indent=2))
print('MATERIAL_BAKES_PASS',len(results))
