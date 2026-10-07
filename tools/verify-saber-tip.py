"""Blender geometry regression: glow encloses the tip on native single/dual/guard blades."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
import bpy
from mathutils import Matrix
import sabers
root=Path(__file__).resolve().parents[1]
config=json.loads((root/'development.local.json').read_text())
catalog=json.loads((root/'output/equipment/catalog.json').read_text())
class Pipeline:
    resources=Path(config['resources'])
pipeline=Pipeline()
# This test isolates geometry; shader/material imports are exercised in Unity.
sabers.material=lambda *args:bpy.data.materials.new('test')
checks=[]
for name,category in [('saber_gs07_a01_v01','saber'),('dualsaber_gs07_a01_v01','dualsaber'),('saber_mtx06_a01_v01','saber'),('dualsaber_mtx06_a01_v01','dualsaber'),('saber_mtx11_a01_v01','saber')]:
    relative=next(m for item in catalog['items'] for m in item['models'] if m.endswith('/'+name+'.gr2'))
    file=pipeline.resources/relative
    points=sabers.emitters(file,category,pipeline.resources)
    entry={'category':category,'layer':0,'blade':{'enabled':True,'length':90,'width':2,'core':'#ffffff','glow':'#00aaff','effect':'standard'}}
    objects=sabers.blades(entry,relative,file,pipeline,None)
    assert len(objects)==len(points)*2 and len(points)>0
    for index,(socket,matrix,scale) in enumerate(points):
        inverse=matrix.inverted();core,glow=objects[index*2:index*2+2]
        core_y=[(inverse@v.co).y for v in core.data.vertices];glow_y=[(inverse@v.co).y for v in glow.data.vertices]
        length=.09*scale;extension=min(.004,length/2)
        assert abs(max(core_y)-length)<1e-6,(name,socket,'core changed')
        assert abs(min(core_y))<1e-6 and abs(min(glow_y))<1e-6,(name,socket,'emitter moved')
        assert abs(max(glow_y)-max(core_y)-extension)<1e-6,(name,socket,'glow tip')
        checks.append({'model':name,'socket':socket,'extension':extension,'lengthScale':scale,'direction':list(matrix.col[1][:3])})
    for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
(root/'output/material-review/saber-tip-check.json').write_text(json.dumps(checks,indent=2))
print('SABER_TIP_PASS',len(checks))
