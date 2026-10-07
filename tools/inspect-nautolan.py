from build_local_npcs import Builder,F
from pathlib import Path
import json,xml.etree.ElementTree as E
b=Builder();data=json.loads(Path('output/designer/catalog.json').read_text(encoding='utf-8'));p=data['profiles']['nautolan:bmn'];
for hid in p['heads'][:4]:
 e=data['entries'][hid];a=b.assets[e['entry'][F['asset']]];print(e['name'],e['entry']);print(E.tostring(a,encoding='unicode')[:5000])
 print('dynamic?',[(n,b.node(i)) for n,i in b.g.names.items() if n=='dynamic.head.'+e['name']])
