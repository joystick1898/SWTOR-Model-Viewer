"""Resolve only validated native selection records into a character assembly."""
import json,sys,copy,re
from pathlib import Path
from build_local_npcs import Builder,F

def assemble(b,r):
 d=r['designer'];body=d['body'];definition=copy.deepcopy(r.get('definition') or {})
 definition[F['body']]=body;groups=definition.setdefault(F['slots'],{})
 for key in ['Head','Hair','FaceHair','SkinColor','HairColor','EyeColor','Complexion','Age','FacePaint']:groups.pop('appSlot'+key,None)
 for key,entry in r['entries'].items():
  if entry:groups[key]=[entry]
 # Native unequipped garments, with exposed skin supplied by the selected head.
 # Imported NPCs retain their own outfit; new player characters start unequipped.
 if not r.get('definition'):
  for slot,asset in ([('Chest',1142671)] if body.startswith('bf') else [])+[('Leg',1142836)]:
   groups['appSlot'+slot]=[{F['asset']:asset}]
 result=b.assemble(None,definition)
 if not r.get('definition'):
  skins={m['slotName']:m for slot in result['slots'] if slot['slotName']=='skinMats' for m in slot['materialInfo']['mats']}
  for slot in ['hand','boot']+([] if body.startswith('bf') else ['chest']):
   model=f'art/dynamic/{slot}/model/{slot}_naked_{body}_archetype.gr2';b.source(model)
   if slot not in skins:raise ValueError('No native unequipped skin material for '+slot)
   info=copy.deepcopy(skins[slot]);info['otherValues']['materialSkinIndex']=-1
   result['slots'].append({'slotName':slot,'models':[model],'materialInfo':info})
 # Split material instances by model so pauldrons, sleeves, cuffs, etc. can be dyed independently.
 slots=[]
 for slot in result['slots']:
  if not slot['models']:slots.append(slot);continue
  for model in slot['models']:
   piece=copy.deepcopy(slot);piece['models']=[model]
   color=d['colors'].get(model,d['colors'].get(slot['slotName'],{}))
   for channel,index in [('primary',1),('secondary',2)]:
    if color.get(channel):
     piece['materialInfo']['otherValues']['palette'+str(index)+'Color']=color[channel]
     for override in piece['materialInfo'].get('materialOverrides',{}).values():
      if override['otherValues']['derived'] not in ['Eye','SkinB']:override['otherValues']['palette'+str(index)+'Color']=color[channel]
   slots.append(piece)
 result['slots']=slots
 # Shared skin and eye swatches affect every dependent material, including exposed skin on clothing.
 def visit(info):
  if not isinstance(info,dict):return
  family=info.get('otherValues',{}).get('derived')
  color=d['colors'].get('eyes' if family=='Eye' else 'skin' if family=='SkinB' else 'hair' if family=='HairC' else '',{})
  if color.get('primary') and not info['otherValues'].get('palette1Color'):info['otherValues']['palette1Color']=color['primary']
  if info.get('skinPaletteIndex') and not info.get('otherValues',{}).get('palette'+str(info['skinPaletteIndex'])+'Color') and d['colors'].get('skin',{}).get('primary'):
   info['otherValues']['palette'+str(info['skinPaletteIndex'])+'Color']=d['colors']['skin']['primary']
  for value in info.values():
   if isinstance(value,dict):visit(value)
   elif isinstance(value,list):
    for v in value:visit(v)
 for slot in slots:visit(slot['materialInfo'])
 return result

if __name__=='__main__':
 r=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));result=assemble(Builder(),r)
 Path(r['output']).write_text(json.dumps(result,allow_nan=False),encoding='utf-8')
