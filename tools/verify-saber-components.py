"""Verify reused physical emitter meshes retain distinct native placements."""
import sys,json
from pathlib import Path
from collections import Counter
from mathutils import Matrix
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'worker'))
import sabers
resources=Path('G:/Old Republic Assets/resources')
results=[]
for stem in ['saber_mtx06_a01_v01','dualsaber_mtx06_a01_v01']:
 file=resources/'art/dynamic/weapon/model'/(stem+'.gr2')
 components=sabers.effect_components(file,resources)
 emitters=[(p,m) for p,m in components if p.endswith('_emitter.gr2')]
 assert len(emitters)==(2 if stem.startswith('saber_') else 0),(stem,len(emitters))
 assert len({tuple(round(v,7) for row in m for v in row) for p,m in emitters})==len(emitters)
 results.append({'hilt':stem,'components':len(components),'emitterInstances':len(emitters),'positions':[list(m.translation) for p,m in emitters]})
# Synthetic fixture proves general behavior, including identical loop instances.
original_rows=sabers.effect_rows;original_matching=sabers.matching_effects;original_sockets=sabers.sockets
file=resources/'art/dynamic/weapon/model/saber_mtx06_a01_v01.gr2'
relative='art/dynamic/weapon/saber/___model/saber_mtx06_a01_v01_emitter.gr2'
rows=tuple({'_fxName':n,'_fxResourceName':relative,'_fxAttachPosition':p} for n,p in [('left','(-1,0,0)'),('right','(1,0,0)'),('duplicate','(1,0,0)')])
sabers.effect_components.cache_clear();sabers.matching_effects=lambda *args:[file];sabers.effect_rows=lambda *args:rows;sabers.sockets=lambda *args,**kwargs:[]
assert len(sabers.effect_components(file,resources))==2
folder=root/'output/saber-layout-review';folder.mkdir(parents=True,exist_ok=True)
(folder/'component-check.json').write_text(json.dumps({'ok':True,'nativeHilts':results,'duplicateCheck':True},indent=2))
print('SABER_COMPONENTS_PASS',json.dumps(results))
