"""Resolve only validated native selection records into a character assembly."""
import json,sys,copy,re
from pathlib import Path
from build_local_npcs import Builder,F
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
from palette_controls import apply_selection

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
    apply_selection(piece['materialInfo']['otherValues'],color,channel,index)
    for override in piece['materialInfo'].get('materialOverrides',{}).values():
     if override['otherValues']['derived'] not in ['Eye','SkinB']:apply_selection(override['otherValues'],color,channel,index)
   slots.append(piece)
 result['slots']=slots
 # Shared skin and eye swatches affect every dependent material, including exposed skin on clothing.
 def visit(info):
  if not isinstance(info,dict):return
  family=info.get('otherValues',{}).get('derived')
  color=d['colors'].get('eyes' if family=='Eye' else 'skin' if family=='SkinB' else 'hair' if family=='HairC' else '',{})
  if color:apply_selection(info['otherValues'],color,'primary',1,fallback=True)
  if info.get('skinPaletteIndex'):
   apply_selection(info['otherValues'],d['colors'].get('skin',{}),'primary',info['skinPaletteIndex'],fallback=True)
  for value in info.values():
   if isinstance(value,dict):visit(value)
   elif isinstance(value,list):
    for v in value:visit(v)
 for slot in slots:visit(slot['materialInfo'])
 return result

if __name__=='__main__':
 r=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'));result=assemble(Builder(),r)
 Path(r['output']).write_text(json.dumps(result,allow_nan=False),encoding='utf-8')
