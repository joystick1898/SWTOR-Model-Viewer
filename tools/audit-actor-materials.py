import json,sys
from pathlib import Path
sys.path.insert(0,'worker');from asset_materials import resolve_material
r=json.loads(Path('output/all-actor-validation-input.json').read_text());meshes={m['id']:m for m in json.loads(Path('reports/all-npc-creature-meshes.json').read_text())};results=[]
for a in r['assets']:
 row={'id':a['id'],'mapped':bool(a['skeleton']),'materials':[]}
 for original in meshes[a['id']]['materials']:
  try:
   info,source=resolve_material(r['resources'],original,a,None,a['id']);row['materials'].append({'source':source,'family':info['otherValues']['derived'],'textures':list(info['ddsPaths'].values())})
  except Exception as e:row['materials'].append({'error':str(e),'original':original})
 results.append(row)
Path('reports/all-actor-material-audit.json').write_text(json.dumps(results,indent=2));problems=[r for r in results if r['mapped'] and any(m.get('error') for m in r['materials'])];print('mapped problems',len(problems));print(json.dumps(problems,indent=1))
