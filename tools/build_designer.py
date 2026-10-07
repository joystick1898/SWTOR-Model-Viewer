"""Catalog native player creation options, including head-dependent choices.

Class/unlock restrictions are deliberately not enforced in this offline editor.
IDs identify appearance content, not labels or slider positions.
"""
import json,hashlib,collections,copy,re
from pathlib import Path
from build_local_npcs import Builder,F
from local_tor import strings

from runtime_paths import DATA, REPORTS
OUT=DATA/'designer'
ENTRIES='4611686034028470000'
RULES='4611686034054470003'
BODIES=['bma','bmn','bms','bmf','bfa','bfn','bfs','bfb']
SLOT='4611686031694070054'
LABELS={'human':'Human','cyborg':'Cyborg','chiss':'Chiss','rattataki':'Rattataki','sith':'Sith Pureblood','mirialan':'Mirialan','miralukan':'Miraluka','twilek':"Twi’lek",'zabrak':'Zabrak (Republic)','zabrak_imp':'Zabrak (Imperial)','cathar':'Cathar','togruta':'Togruta','nautolan':'Nautolan'}

def identity(entry):
    content={k:entry[k] for k in [F[x] for x in ['asset','mat','attach','p1','p2']] if k in entry}
    return hashlib.sha256(json.dumps(content,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:24]

def run():
    b=Builder();OUT.mkdir(parents=True,exist_ok=True)
    labels=strings(b.archives.read('en-us/str/pcs.stb'))
    entries={};profiles={};errors=[];sources=[]
    for name,ident in sorted(b.g.names.items()):
        parts=name.split('.')
        if len(parts)!=4 or parts[0]!='pcs' or parts[2] not in ['male','female']:continue
        d=b.node(ident)
        if ENTRIES not in d or RULES not in d:continue
        species=parts[3].removesuffix('_legacy')
        if species=='cyborg_imp':species='cyborg'
        if species=='zabrak_rep':species='zabrak'
        elif species=='zabrak' and parts[1] in ['sith_warrior','sith_inquisitor','bounty_hunter','imperial_agent']:species='zabrak_imp'
        if not re.fullmatch(r'[a-z_]+',species):errors.append({'source':name,'error':'Unsupported species identifier '+species});continue
        # New records using the supported creation schema do not require a code
        # release merely to add a species name. Mark the fallback as source text.
        LABELS.setdefault(species,species.replace('_',' ').title()+' (source name)')
        sources.append(name);raw=d[ENTRIES];lookup={}
        for key,entry in raw.items():
            uid=identity(entry);lookup[key]=uid
            if uid not in entries:
                a=b.assets.get(entry.get(F['asset']));title=a.findtext('ArtName') if a is not None else 'Empty'
                attachments=[b.attach[x].get('filename','').split('/')[-1].removesuffix('.gr2') for x in entry.get(F['attach'],[]) if x in b.attach]
                entries[uid]={'id':uid,'name':title,'attachments':attachments,'entry':entry}
        bodyheads=d.get('4611686086145961605',{});order=d.get('4611686088523270013',[])
        for index,bkey in enumerate(order):
            if index>3:continue
            body=BODIES[index+(4 if parts[2]=='female' else 0)]
            key=species+':'+body
            profile=profiles.setdefault(key,{'id':key,'species':species,'body':body,'gender':parts[2],'bodyType':index+1,'heads':[],'rules':{},'labels':{},'sources':[]})
            profile['sources'].append(name)
            profile['labels'].update({k:labels.get(v,k.removeprefix('appSlot')) for k,v in d.get('4611686093953769991',{}).items()})
            for hid in bodyheads.get(str(bkey),[]):
                uid=lookup.get(str(hid))
                if not uid:errors.append({'source':name,'error':'Missing head '+str(hid)});continue
                if uid not in profile['heads']:profile['heads'].append(uid)
                rules=profile['rules'].setdefault(uid,{})
                for slot,ids in d[RULES].get(str(hid),{}).items():
                    values=rules.setdefault(slot,[])
                    for oid in ids:
                        opt=lookup.get(str(oid))
                        if not opt:errors.append({'source':name,'error':'Missing option '+str(oid)});continue
                        if opt not in values:values.append(opt)
    reachable={uid for p in profiles.values() for uid in p['heads']}|{uid for p in profiles.values() for rules in p['rules'].values() for ids in rules.values() for uid in ids}
    summary={'reachableOptions':len(reachable),'unreferencedOptions':len(entries)-len(reachable),'productionRecords':len(sources),'speciesVariants':len(set(p['species'] for p in profiles.values())),'bodyProfiles':len(profiles),'uniqueOptions':len(entries),'errors':errors}
    data={'version':1,'species':[{'id':s,'name':LABELS[s]} for s in LABELS if any(p['species']==s for p in profiles.values())],'profiles':profiles,'entries':entries,'summary':summary}
    (OUT/'catalog.json').write_text(json.dumps(data,allow_nan=False),encoding='utf-8')
    (REPORTS/'designer-catalog-audit.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary))

if __name__=='__main__':run()
