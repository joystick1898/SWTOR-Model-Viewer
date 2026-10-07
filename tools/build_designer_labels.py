from runtime_paths import DATA, PROJECT, setting
import json,colorsys,re
from pathlib import Path
from build_local_npcs import Builder,F
b=Builder();p=(DATA/'designer/catalog.json');data=json.loads(p.read_text(encoding='utf-8'));labels={}
for uid,e in data['entries'].items():
 name=e['name'] or 'Empty';sources=e.get('attachments') or [name]
 def readable(s):
  s=s.rsplit('/',1)[-1].removesuffix('.gr2');s=re.sub(r'^(head|hair|facehair|skincolor|haircolor|eyecolor|comp|age|facepaint|pattern)_','',s)
  s=re.sub(r'_(?:bma|bmn|bms|bmf|bfa|bfn|bfs|bfb|non)(?=_|$)','',s)
  return s.replace('_',' ').strip().capitalize()
 label='None' if re.search(r'blank|_none|^Empty$',name,re.I) and not e.get('attachments') else ' + '.join(readable(s) for s in sources)
 item={'label':label,'source':name}
 if name.startswith(('skincolor_','haircolor_','eyecolor_')):
  try:
   values,_,_=b.palette(e['entry'][F['asset']]);h,s,v,c=values
   item['palette']=values
  except Exception as ex:item['paletteUnavailable']=str(ex)
 labels[uid]=item

# Find a real compatible material palette map for each color option.
for profile in data['profiles'].values():
 for head,rules in profile['rules'].items():
  needed=[(slot,uid) for slot,ids in rules.items() for uid in ids if uid in labels and 'palette' in labels[uid] and 'paletteMap' not in labels[uid]]
  if not needed:continue
  groups={'appSlotHead':[data['entries'][head]['entry']]}
  hair=rules.get('appSlotHair',[])
  if hair:groups['appSlotHair']=[data['entries'][hair[0]]['entry']]
  try:assembly=b.assemble(None,{F['body']:profile['body'],F['slots']:groups})
  except Exception:continue
  mats={slot['slotName']:slot['materialInfo'] for slot in assembly['slots']}
  for slot,uid in needed:
   info=mats.get('hair',{}) if slot=='appSlotHairColor' else mats.get('head',{})
   if slot=='appSlotEyeColor':info=info.get('eyeMatInfo',{})
   tex=info.get('ddsPaths',{}).get('paletteMap')
   if tex:
    labels[uid]['paletteMap']=str(b.source(tex));labels[uid]['family']=info['otherValues']['derived']
(DATA/'designer/labels.json').write_text(json.dumps(labels),encoding='utf-8')
print('LABELS',len(labels),'MAPPED PALETTES',sum('paletteMap' in x for x in labels.values()))

import subprocess
subprocess.run([str(setting('blender')),"--background","--factory-startup","--python-exit-code","1","--python",str(PROJECT/'tools/sample_designer_labels.py')],check=True,creationflags=0x08000000)
