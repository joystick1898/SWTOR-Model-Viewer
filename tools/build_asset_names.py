"""Join verified local item/NPC labels to model paths without changing asset identity."""
import json
import os
from collections import defaultdict
from pathlib import Path

from runtime_paths import DATA
OUT = DATA
names = defaultdict(set)
sources = ['equipment/catalog.json', 'local-npcs/catalog.json']

def add(model, labels):
    model = model.replace('\\', '/').lstrip('/').lower()
    if model.endswith('.gr2'):
        names[model].update(labels)

equipment = json.loads((OUT / sources[0]).read_text(encoding='utf-8'))
for item in equipment['items']:
    # Internal references and resource stems are not localized item names.
    labels = [s for s in item['aliases'] if s and not s.startswith(('ipp.', 'itm.')) and '_' not in s]
    for model in item['models'] + [r for r in item['references'] if r.startswith('art/') and r.endswith('.gr2')]:
        for body in ['bma', 'bmn', 'bms', 'bmf', 'bfa', 'bfn', 'bfs', 'bfb']:
            add(model.replace('[bt]', body).replace('[gen]', 'f' if body.startswith('bf') else 'm'), labels)

npcs = json.loads((OUT / sources[1]).read_text(encoding='utf-8'))
appearances = defaultdict(set)
for npc in npcs['items']:
    if npc['localized'] and npc['ready']:
        appearances[npc['appearanceId']].add(npc['name'])
for ident, labels in appearances.items():
    file = OUT / 'local-npcs/appearances' / (ident + '.json')
    appearance = json.loads(file.read_text(encoding='utf-8'))
    for slot in appearance['slots']:
        # An assembled character's head/chest is not a complete named NPC.
        if slot['slotName'] == 'creature':
            for model in slot['models']:
                add(model, labels)

result = {k: sorted(v, key=lambda s: (s.startswith('['), s.casefold())) for k, v in sorted(names.items()) if v}
signature = {s: (OUT / s).stat().st_mtime_ns // 1000000 for s in sources}
temporary = OUT / ('asset-names.' + str(os.getpid()) + '.tmp')
temporary.write_text(json.dumps({'version': 1, 'sources': signature, 'names': result}, ensure_ascii=False), encoding='utf-8')
temporary.replace(OUT / 'asset-names.json')
print(json.dumps({'namedModelPaths': len(result), 'uniqueLabels': len({n for v in result.values() for n in v})}))
