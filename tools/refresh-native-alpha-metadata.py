import json,sys
from pathlib import Path
sys.path.insert(0,'worker');from asset_materials import resolve_material
report=Path('reports/all-profile-export-smoke.json');data=json.loads(report.read_text());updated=0
for r in data['results']:
 source=Path(r['exported']['file']);request=json.loads(source.with_name('request.json').read_text());result=json.loads(source.with_name('result.json').read_text())
 for m in result['materialDetails']:
  info,_=resolve_material(request['resources'],m['name'].split(' — ')[0],request['metadata'],request['material'],request['source']);m['alphaMode']=info['portableAlphaMode'];m['alphaCutoff']=info['portableAlphaCutoff'];updated+=m['alphaMode']=='cutout'
 source.with_name('result.json').write_text(json.dumps(result,indent=2));r['exported']['materialDetails']=result['materialDetails']
report.write_text(json.dumps(data,indent=2));print('native cutout materials',updated)
