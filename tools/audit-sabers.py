import sys,json,collections
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
from sabers import sockets,emitters
root=Path('G:/Old Republic Assets/resources');catalog=json.loads(Path('output/equipment/catalog.json').read_text(encoding='utf-8'));rows=[]
for r in catalog['items']:
 if r['category'] not in ('saber','dualsaber'):continue
 for rel in r['models']:
  points=emitters(root/rel,r['category'],root);rows.append(dict(item=r['id'],model=rel,category=r['category'],emitters=[dict(name=n,lengthScale=scale,matrix=[list(row) for row in m]) for n,m,scale in points],estimated=not points))
report=dict(total=len(rows),native=sum(not r['estimated'] for r in rows),estimated=sum(r['estimated'] for r in rows),results=rows)
Path('reports/saber-emitter-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print({k:v for k,v in report.items() if k!='results'})
