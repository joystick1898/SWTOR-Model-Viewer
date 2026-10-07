import json,copy,time,traceback
from collections import Counter
from pathlib import Path
from build_local_npcs import Builder,F
from assemble_designer import assemble
b=Builder();data=json.loads(Path('output/designer/catalog.json').read_text());results=[];errors=[];warnings=[];tested=set();start=time.time()
for key,p in data['profiles'].items():
 count=0
 for head in p['heads']:
  choices={'appSlotHead':head,**{slot:ids[0] for slot,ids in p['rules'][head].items() if ids}}
  def check(current,kind,uid):
   global count
   sig=(p['body'],kind,uid)
   if sig in tested:return
   tested.add(sig);definition={F['body']:p['body'],F['slots']:{slot:[data['entries'][ident]['entry']] for slot,ident in current.items()}}
   try:
    result=b.assemble(None,definition)
    for warning in result['warnings']:warnings.append({'profile':key,'head':head,'slot':kind,'choice':uid,'warning':warning})
   except Exception as e:errors.append({'profile':key,'head':head,'slot':kind,'choice':uid,'error':str(e)})
   count+=1
  check(choices,'appSlotHead',head)
  for slot,ids in p['rules'][head].items():
   for uid in ids:check({**choices,slot:uid},slot,uid)
 results.append({'profile':key,'checked':count});print(key,count,'errors',len(errors),flush=True)
report={'profiles':len(results),'referenceChecks':len(tested),'seconds':time.time()-start,'errors':errors,'warnings':warnings,'results':results}
Path('reports/designer-reference-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('DONE',len(tested),len(errors),flush=True)
