"""Offline equipment index. Exact signatures collapse aliases, never recolors."""
import sys,json,hashlib,collections,copy,re
from pathlib import Path
from build_local_npcs import Builder,F,ROOT
from runtime_paths import DATA, REPORTS
OUT=DATA/'equipment'
def run():
 b=Builder();OUT.mkdir(exist_ok=True);groups={};refs={};errors={};items=0
 def add(payload,name,ref,category):
  signature=json.dumps(payload,sort_keys=True,separators=(',',':'));key=hashlib.sha256(signature.encode()).hexdigest()[:24]
  r=groups.setdefault(key,dict(id=key,name=name,category=category,aliases=[],references=[],**payload))
  if name not in r['aliases']:r['aliases'].append(name)
  if ref not in r['references']:r['references'].append(ref)
  refs[ref]=key;return r
 for n,i in b.g.names.items():
  if not n.startswith('ipp.'):continue
  d=b.node(i);a=b.assets.get(d.get(F['asset']));mid=d.get(F['mat'])
  if a is None:errors[n]='No native base asset';continue
  try:
   model=a.findtext('BaseFile','').lstrip('/');category=model.split('/')[2] if model else a.findtext('ArtName','').split('_')[0]
   if category not in ['face','chest','bracer','hand','waist','leg','boot']:continue
   mat=b.mats.get(mid) if mid else a.find('Materials/Material')
   if mat is None:raise ValueError('Missing material '+str(mid))
   def material_for(gender):
    info=copy.deepcopy(b.material(mat.get('filename').replace('[gen]',gender)))
    for idx,key in [(1,'p1'),(2,'p2')]:b.apply_palette(info,d.get(F[key]),idx)
    info['otherValues']['materialSkinIndex']=int(a.findtext('SkinMaterialIndex','-1'))
    overrides={}
    for o in mat.findall('MaterialOverrides/MaterialOverride'):
     if int(o.get('index'))>=0:overrides[o.get('index')]=copy.deepcopy(b.material(o.get('filename').replace('[gen]',gender)))
    if overrides:info['materialOverrides']=overrides
    return info
   info=material_for('m')
   variants={'m':info,'f':material_for('f')} if '[gen]' in str(mat.get('filename')) or any('[gen]' in o.get('filename') for o in mat.findall('MaterialOverrides/MaterialOverride')) else None
   models=[model] if model.endswith('.gr2') else [];warnings=[]
   for aid in d.get(F['attach'],[]):
    if aid in b.attach:
     p=b.attach[aid].get('filename').lstrip('/');models.append(p if p.endswith('.gr2') else p+'.gr2')
    else:warnings.append('Missing native attachment '+str(aid))
   if not models:continue
   payload=dict(kind='armor',models=models,materialInfo=info,slot=category,warnings=warnings)
   if variants:payload['materialByGender']=variants
   add(payload,n,n,category)
  except Exception as e:errors[n]=str(e)
 print('Armor appearances',len(groups),flush=True)
 paths=list((ROOT/'art/dynamic/weapon').rglob('*.gr2'))
 paths+=list((ROOT/'art/static/vehicle/player_mount').glob('*jetpack*.gr2'))
 paths+=list((ROOT/'art/fx/geometry/bountyhunter').glob('*jetpack*.gr2'))
 hashes={};raw=0;by_stem={}
 for p in paths:
  if any(x.startswith('___') for x in p.parts) or re.search(r'lod\d',p.stem,re.I):continue
  raw+=1;h=hashlib.sha256(p.read_bytes()).hexdigest();relative=p.relative_to(ROOT).as_posix()
  if h in hashes:
   r=hashes[h];r['aliases'].append(p.stem);r['references'].append(relative);refs[relative]=r['id']
  else:
   category='jetpack' if 'jetpack' in p.stem else p.stem.split('_')[0]
   r=add(dict(kind='rigid',models=[relative],materialInfo=None,slot=None,warnings=[]),p.stem,relative,category);hashes[h]=r
  by_stem.setdefault(p.stem,[]).append(r)
 alias_matches=0;unmatched=[]
 for n,i in b.g.names.items():
  if not n.startswith('itm.'):continue
  items+=1;d=b.node(i);targets=set()
  for k in ['4611686088068670002','4611686030368870006','4611686033507470022']:
   v=d.get(k)
   if isinstance(v,int) and v in b.g.nodes:v=b.g.nodes[v][0]
   if v in refs:targets.add(refs[v])
   if isinstance(v,str):
    for r in by_stem.get(v.replace('.','_'),[]):targets.add(r['id'])
  for v in d.get('4611686088068670001',{}).values():
   ref=b.g.nodes.get(v,(None,))[0]
   if ref in refs:targets.add(refs[ref])
  if targets:
   label=b.name(d) or n;alias_matches+=1
   for key in targets:
    r=groups[key]
    if label not in r['aliases']:r['aliases'].append(label)
    if n not in r['references']:r['references'].append(n)
    if r['name'].startswith('ipp.') or r['name']==Path(r['models'][0]).stem:r['name']=label
  elif any('EquipHuman' in s for s in d.get('4611686030368870010',[])):unmatched.append(n)
 result=list(groups.values())
 for r in result:r['aliases']=sorted(set(r['aliases']));r['references']=sorted(set(r['references']))
 summary=dict(itemRecords=items,matchedItems=alias_matches,uniqueAppearances=len(result),armorAppearances=sum(r['kind']=='armor' for r in result),rigidAppearances=sum(r['kind']=='rigid' for r in result),rigidFiles=raw,duplicateRigidFiles=raw-len(hashes),unresolvedAppearanceRecords=len(errors),unmatchedEquippableItems=len(unmatched))
 (OUT/'catalog.json').write_text(json.dumps(dict(version=1,summary=summary,items=result),allow_nan=False),encoding='utf-8')
 (REPORTS/'equipment-catalog-audit.json').write_text(json.dumps(dict(**summary,appearanceErrors=errors,unmatchedItems=unmatched),indent=2),encoding='utf-8');print(json.dumps(summary,indent=2))
if __name__=='__main__':run()
