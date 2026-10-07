"""Build the complete offline NPC catalog from local GOM, art indexes and STB.
Run with Python 3.14 (stdlib zstd). Never writes into the game or source extraction.
"""
import json,collections,copy,xml.etree.ElementTree as ET,sys,time,re,math
from pathlib import Path
from functools import lru_cache
from local_gom import GOM
from local_tor import Archives,strings
from runtime_paths import DATA, REPORTS, setting
ROOT=setting('resources')
GAME=setting('game')/'Assets'
OUT=DATA/'local-npcs'
OVERLAY=OUT.parent/'npc-resources'
F={'body':'4611686025952330048','slots':'4611686042464870000','asset':'4611686031694070055','mat':'4611686031694070056','attach':'4611686031694070057','p1':'4611686031694070058','p2':'4611686031694070059','variants':'4611686053557231201','npp':'4611686063308331199'}
TEXTURES={'DiffuseMap':'diffuseMap','RotationMap1':'rotationMap','GlossMap':'glossMap','PaletteMaskMap':'paletteMaskMap','PaletteMap':'paletteMap','AgeMap':'ageMap','ComplexionMap':'complexionMap','FacepaintMap':'facepaintMap'}
class Builder:
    def __init__(self):
        self.archives=Archives(GAME);self.g=GOM(ROOT,self.archives.read);self.assets={};self.mats={};self.attach={};self.recovered=set()
        indexes={file.relative_to(ROOT).as_posix() for file in (ROOT/'art/dynamic').glob('*/index.xml')}
        try:
            master=self.archives.read('art/dynamic/index.xml')
            for entry in ET.fromstring(master).findall('AssetIndexFile'):
                relative=(entry.text or '').replace('\\','/').lstrip('/')
                if relative.startswith('art/dynamic/') and '..' not in relative.split('/') and ':' not in relative:indexes.add(relative)
        except FileNotFoundError:pass
        for relative in sorted(indexes):
            file=ROOT/relative
            try:
                content=self.archives.read(file.relative_to(ROOT).as_posix())
                destination=OVERLAY/file.relative_to(ROOT);destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(content)
                xml=ET.fromstring(content)
            except FileNotFoundError:
                if not file.is_file():continue
                xml=ET.parse(file).getroot()
            for a in xml.findall('Asset'):
                ident=int(a.findtext('ID'));self.assets[ident]=a
                for m in a.findall('Materials/Material'):self.mats[int(m.get('id'))]=m
                for m in a.findall('Attachments/Attachment'):self.attach[int(m.get('id'))]=m
        self.tables={};self.gcache={}
    def node(self,i):
        if i not in self.gcache:self.gcache[i]=self.g.decode(i)
        return self.gcache[i]
    @lru_cache(maxsize=None)
    def source(self,relative):
        relative=relative.lstrip('/').replace('\\','/')
        if '..' in relative.split('/') or ':' in relative:raise ValueError('Invalid resource path')
        p=ROOT/relative
        if p.is_file():return p
        p=OVERLAY/relative
        if not p.is_file():
            b=self.archives.read(relative);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);self.recovered.add(relative)
        return p
    def asset(self,i):
        if not i:return None
        if i not in self.assets:raise ValueError('Unknown native asset ID '+str(i))
        return self.assets[i]
    @lru_cache(maxsize=None)
    def palette(self,i):
        a=self.asset(i)
        if a is None:return None
        relative=a.findtext('BaseFile');name='dynamic.'+relative.split('/')[-2]+'.'+a.findtext('ArtName')
        if name in self.g.names:
            d=self.node(self.g.names[name]);v=[d.get(str(n),default) for n,default in [(4611686029845070019,0),(4611686029845070016,.5),(4611686029845070018,0),(4611686029845070017,1)]]
            color=lambda k:[d.get(k,{}).get(str(n),1) for n in range(3775000026,3775000029)]
            return [v,color('4611686030221870000'),color('4611686031694070046')]
        xml=ET.parse(self.source(relative)).getroot()
        return [[float(xml.findtext(n,default)) for n,default in [('Hue','0'),('Saturation','.5'),('Brightness','0'),('Contrast','1')]],*[list(map(float,xml.findtext(n,'1,1,1').split(',')))[:3] for n in ['Specular','Metallicspecular']]]
    @lru_cache(maxsize=None)
    def material(self,relative):
        relative=relative.lstrip('/');xml=ET.parse(self.source(relative)).getroot();family=xml.findtext('Derived')
        if family=='HighQualityCharacter':family='Creature'
        if family=='GarmentScrolling':family='Garment'
        if family not in ['Creature','Eye','Garment','SkinB','HairC','Uber','EmissiveOnly']:raise ValueError('Unsupported native shader '+str(family))
        info={'matPath':relative,'ddsPaths':{},'otherValues':{'derived':family},'portableAlphaMode':'cutout' if xml.findtext('AlphaMode')=='Test' or family=='HairC' else 'opaque','portableAlphaCutoff':.75 if family=='HairC' else float(xml.findtext('AlphaTestValue','.5'))}
        if not math.isfinite(info['portableAlphaCutoff']):info['portableAlphaCutoff']=.5
        for e in xml.findall('input'):
            k=e.findtext('semantic');v=e.findtext('value')
            if not v:continue
            if k in TEXTURES:
                p=v.replace('\\','/').lstrip('/')+'.dds';self.source(p);info['ddsPaths'][TEXTURES[k]]=p
            elif k in ['Palette1','Palette2','Palette1Specular','Palette2Specular','Palette1MetallicSpecular','Palette2MetallicSpecular']:
                vals=list(map(float,v.split(',')));info['otherValues'][k[0].lower()+k[1:]]=vals[:3] if 'Specular' in k else vals
            elif k=='FleshBrightness':info['otherValues']['fleshBrightness']=float(v)
            elif k=='FlushTone':info['otherValues']['flush']=list(map(float,v.split(',')))[:3]
        return info
    def apply_palette(self,info,ident,index):
        if not ident:return
        values,spec,metal=self.palette(ident);key='palette'+str(index)
        info['otherValues'].update({key:values,key+'Specular':spec,key+'MetallicSpecular':metal})
    @lru_cache(maxsize=None)
    def profile(self,body):
        rig=body+'new' if body in ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb'] else body
        dyc=self.source('art/dynamic/spec/'+rig+'.dyc').read_text()
        dat=self.source('art/dynamic/spec/'+rig+'.dat').read_text()
        skeleton='art/dynamic/spec/'+re.search(r'^\s*Skeleton=(\S+)',dyc,re.M)[1]
        directory=re.search(r'^\s*AnimNetworkFolder=(\S+)',dat,re.M)[1].replace('\\','/').rstrip('/')
        self.source(skeleton)
        macros=dict(re.findall(r'^\s*(bt|gen)=(\S+)',dyc,re.M))
        if body in ['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb']:macros['bt']=body
        return {'id':body,'rig':rig,'skeleton':skeleton,'animationDirectory':directory},macros
    def assemble(self,i,definition=None):
        d=definition if definition is not None else self.node(i);body=d.get(F['body']);groups=d.get(F['slots'],{})
        if not body or not groups:raise ValueError('No renderable appearance slots')
        profile,macros=self.profile(body)
        selected={k:v[0] for k,v in groups.items() if v}
        # More than one candidate is a native randomized appearance, not multiple meshes.
        variations={k:len(v) for k,v in groups.items() if len(v)>1}
        skins=[];slots=[];headasset=None;warnings=[]
        get=lambda slot: selected.get('appSlot'+slot,{}).get(F['asset'])
        skin=get('SkinColor');hair=get('HairColor');eye=get('EyeColor')
        subst=lambda p:p.replace('[bt]',macros.get('bt',body)).replace('[gen]',macros.get('gen','f' if body.startswith('bf') else 'm')).replace('\\','/').lstrip('/')
        for key,entry in selected.items():
            asset=self.asset(entry.get(F['asset']))
            if asset is None:continue
            base=asset.findtext('BaseFile','');slot=key.removeprefix('appSlot').lower()
            models=[]
            if base.endswith('.gr2'):
                relative=subst(base);self.source(relative);models.append(relative)
            for aid in entry.get(F['attach'],[]):
                if aid not in self.attach:
                    warnings.append('Obsolete attachment ID '+str(aid)+' is absent from the installed art index and was omitted');continue
                p=subst(self.attach[aid].get('filename'))
                if not Path(p).suffix:p+='.gr2'
                try:self.source(p);models.append(p)
                except FileNotFoundError:warnings.append('Attachment file absent from both extraction and installed archives: '+p)
            if not models:continue
            mid=entry.get(F['mat']);mat=self.mats.get(mid) if mid else asset.find('Materials/Material')
            if mat is None:raise ValueError('Unknown material ID '+str(mid))
            info=copy.deepcopy(self.material(subst(mat.get('filename'))))
            info['otherValues']['materialSkinIndex']=int(asset.findtext('SkinMaterialIndex','-1'))
            for index,k in [(1,'p1'),(2,'p2')]:self.apply_palette(info,entry.get(F[k]),index)
            skinindex=int(asset.findtext('SkinHueIndex','-1'))
            info['skinPaletteIndex']=skinindex+1 if skinindex>=0 else None
            if skinindex>=0:self.apply_palette(info,skin,skinindex+1)
            if slot in ('hair','facehair'):self.apply_palette(info,hair,1)
            overrides={}
            for override in mat.findall('MaterialOverrides/MaterialOverride'):
                p=subst(override.get('filename'));mi=copy.deepcopy(self.material(p));index=int(override.get('index'))
                if mi['otherValues']['derived']=='Eye':info['eyeMatInfo']=mi;self.apply_palette(mi,eye,1);index=1 if index<0 else index
                if index>=0:overrides[str(index)]=mi
            if overrides:info['materialOverrides']=overrides
            if slot=='head':
                headasset=asset
                for source,target in [('Complexion','complexionMap'),('Age','ageMap'),('FacePaint','facepaintMap')]:
                    ref=self.asset(get(source))
                    if ref is not None:
                        p=subst(ref.findtext('BaseFile'));self.source(p);info['ddsPaths'][target]=p
            slots.append({'slotName':slot,'models':models,'materialInfo':info})
        if headasset is not None:
            for item in headasset.findall('CustomData/SkinMaterials/SkinMaterial'):
                info=copy.deepcopy(self.material(subst(item.get('filename'))));self.apply_palette(info,skin,1);info['slotName']=item.get('slot');skins.append(info)
        if not slots:raise ValueError('No renderable meshes')
        slots.append({'slotName':'skinMats','models':[],'materialInfo':{'mats':skins}})
        return {'body':body,'profile':profile,'slots':slots,'randomizedSlots':variations,'warnings':warnings,'nativeDefinition':d}
    def name(self,d):
        labels=d.get('4611686102842470023',{});ref=labels.get('15685385242400905286',{})
        ident=ref.get('4611686093000569992');table=ref.get('4611686093000569993','str.npc')
        if table not in self.tables:
            try:self.tables[table]=strings(self.archives.read('en-us/'+table.replace('.','/')+'.stb'))
            except FileNotFoundError:self.tables[table]={}
        return self.tables[table].get(ident)
    def run(self):
        OUT.mkdir(parents=True,exist_ok=True);(OUT/'appearances').mkdir(exist_ok=True)
        catalog=[];appearances={};errors=[];no_name=0;variants=0
        for name,i in self.g.names.items():
            if not name.startswith('npc.'):continue
            d=self.node(i);label=self.name(d)
            if not label:no_name+=1
            rows=d.get(F['variants'],[]);refs=[]
            for row in rows:
                ref=row.get(F['npp'])
                if ref and ref not in refs:refs.append(ref)
            if not refs:refs=[None]
            for variant,ref in enumerate(refs):
                if ref and ref not in appearances:
                    try:
                        assembled=self.assemble(ref);assembled.update({'fqn':self.g.nodes[ref][0],'id':str(ref)})
                        (OUT/'appearances'/f'{ref}.json').write_text(json.dumps(assembled,allow_nan=False),encoding='utf-8');appearances[ref]={'ready':True,'body':assembled['body'],'randomizedSlots':assembled['randomizedSlots'],'warnings':assembled['warnings']}
                    except Exception as e:appearances[ref]={'ready':False,'error':str(e)}
                status=appearances.get(ref,{'ready':False,'error':'NPC has no appearance reference'})
                catalog.append({'id':str(i)+'-'+str(variant),'npcId':str(i),'name':label or name.removeprefix('npc.').replace('_',' '),'localized':bool(label),'fqn':name,'appearanceId':str(ref) if ref else None,'variant':variant+1,'variants':len(refs),'level':str(d.get('4611686019094126923',''))+'-'+str(d.get('4611686019094126924','')),'body':status.get('body'),'ready':status['ready'],'error':status.get('error'),'source':'Local game files','warnings':status.get('warnings',[])})
            variants+=len(refs)
            if len(catalog)%2000< len(refs):print('Indexed',len(catalog),'entries;',len(appearances),'appearances',flush=True)
        summary={'npcRecords':sum(n.startswith('npc.') for n in self.g.names),'variants':variants,'appearanceRecords':len(appearances),'readyAppearances':sum(a['ready'] for a in appearances.values()),'readyNpcVariants':sum(a['ready'] for a in catalog),'appearancesWithWarnings':sum(bool(a.get('warnings')) for a in appearances.values()),'missingLocalizedNames':no_name,'recoveredFiles':len(self.recovered),'appearanceErrors':{str(k):v['error'] for k,v in appearances.items() if not v['ready']}}
        (OUT/'catalog.json').write_text(json.dumps({'version':1,'summary':summary,'items':catalog}),encoding='utf-8')
        (REPORTS/'local-npc-audit.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
        print(json.dumps({k:v for k,v in summary.items() if k!='appearanceErrors'},indent=2))
if __name__=='__main__':Builder().run()
