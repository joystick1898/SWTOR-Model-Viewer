"""Read-only model availability audit across every catalog appearance/body."""
import json, os
from pathlib import Path
from local_tor import Archives, file_hash

project = Path(__file__).resolve().parents[1]
settings = json.loads((Path(os.environ['APPDATA']) / 'SWTOR Model Viewer/settings.json').read_text())
data = Path(settings['data'])
root = Path(settings['resources'])
catalog = json.loads((data / 'equipment/catalog.json').read_text(encoding='utf-8'))
archives = Archives(Path(settings['game']) / 'Assets')
cache = {}

def availability(relative):
    if relative not in cache:
        if (root / relative).is_file(): status = 'extracted'
        elif (data / 'npc-resources' / relative).is_file(): status = 'recovered'
        elif file_hash('/resources/' + relative) in archives.entries: status = 'archive'
        else: status = 'missing'
        cache[relative] = status
    return cache[relative]

affected = []
for item in catalog['items']:
    missing = []
    for body in (['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'] if item['kind'] == 'armor' else ['bmn']):
        for index, template in enumerate(item['models']):
            relative = template.replace('[bt]',body).replace('[gen]','f' if body.startswith('bf') else 'm')
            if availability(relative) == 'missing':
                missing.append(dict(body=body,role='base' if index == 0 else 'attachment',path=relative))
    if missing:
        affected.append(dict(id=item['id'],name=item['name'],aliases=item['aliases'],kind=item['kind'],category=item['category'],missing=missing))
summary = dict(appearances=len(catalog['items']),uniqueModels=len(cache),availability={status:sum(v==status for v in cache.values()) for status in ['extracted','recovered','archive','missing']},affectedAppearances=len(affected),missingBaseAppearances=sum(any(m['role']=='base' for m in r['missing']) for r in affected),attachmentOnlyAppearances=sum(all(m['role']=='attachment' for m in r['missing']) for r in affected))
report = project / 'reports/equipment-resource-audit.json'
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(dict(summary=summary,resources=str(root),game=settings['game'],affected=affected),indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
print('Report:',report)
