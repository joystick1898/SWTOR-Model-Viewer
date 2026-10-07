import json
from pathlib import Path
from build_local_npcs import Builder
from assemble_designer import assemble
b=Builder();data=json.loads(Path('output/designer/catalog.json').read_text(encoding='utf-8'));results=[]
for p in data['profiles'].values():
 head=p['heads'][0];ids={'appSlotHead':head,**{k:v[0] for k,v in p['rules'][head].items() if v}}
 r=assemble(b,{'designer':{'body':p['body'],'colors':{}},'entries':{k:data['entries'][v]['entry'] for k,v in ids.items()}})
 slots={s['slotName']:s for s in r['slots']};assert all(k in slots for k in ['chest','leg','hand','boot'])
 assert ('underwear' if p['body'].startswith('bf') else 'naked') in slots['chest']['materialInfo']['matPath'];assert 'underwear' in slots['leg']['materialInfo']['matPath']
 results.append(p['id'])
Path('reports/underwear-reference-audit.json').write_text(json.dumps({'ok':True,'profiles':results},indent=2),encoding='utf-8');print('PASS',len(results))
